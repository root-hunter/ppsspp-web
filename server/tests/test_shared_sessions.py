"""Shared-session authorization and lifecycle over real WebSockets."""
import json
import unittest
import test_relay


class SharedSessionsTest(unittest.TestCase):
    setUp = test_relay.RelayTest.setUp
    tearDown = test_relay.RelayTest.tearDown
    client = test_relay.RelayTest.client
    def shared(self, room='public'):
        c = self.client('/sessions', room=room)
        welcome = self.receive(c, 'welcome')
        c.share_id = welcome['id']
        self.receive(c, 'sessions')
        return c

    def receive(self, client, kind):
        for _ in range(30):
            data = client.recv()
            self.assertIsNotNone(data)
            message = json.loads(data)
            if message['type'] == kind:
                return message
        self.fail('missing message ' + kind)

    def send(self, c, **message):
        c.send(json.dumps(message).encode())

    def publish(self, c, mode='play'):
        self.send(c, type='publish', title='Test game', mode=mode)
        self.receive(c, 'published')
        return self.receive(c, 'sessions')

    def test_shared_discovery_is_room_scoped_and_needs_no_game_login(self):
        host = self.shared()
        guest = self.shared()
        isolated = self.shared('private')
        sessions = self.publish(host)['sessions']
        self.assertEqual(sessions[0]['id'], host.share_id)
        self.assertNotIn('token', sessions[0])
        discovery = self.receive(guest, 'sessions')
        while not discovery['sessions']:
            discovery = self.receive(guest, 'sessions')
        self.assertEqual(discovery['sessions'][0]['title'], 'Test game')
        self.send(isolated, type='join', host=host.share_id)
        self.assertEqual(self.receive(isolated, 'error')['message'], 'Session is no longer available')

    def test_shared_control_revocation_and_member_departure(self):
        host, guest = self.shared(), self.shared()
        self.publish(host)
        self.send(guest, type='join', host=host.share_id)
        self.receive(guest, 'joined')
        self.assertIsNone(self.receive(guest, 'state')['controller'])
        self.send(host, type='control', peer=guest.share_id)
        self.assertEqual(self.receive(guest, 'state')['controller'], guest.share_id)
        self.send(host, type='control', peer=None)
        self.assertIsNone(self.receive(guest, 'state')['controller'])
        self.send(guest, type='leave')
        self.receive(guest, 'ended')
        self.receive(host, 'guest')
        self.receive(host, 'state')
        self.receive(host, 'state')
        self.receive(host, 'state')
        self.receive(host, 'departed')
        self.assertEqual(self.receive(host, 'state')['members'], [])

    def test_shared_signaling_requires_join_and_host_stop_ends_stream(self):
        host, guest, outsider = self.shared(), self.shared(), self.shared()
        self.publish(host)
        payload = {'description': {'type': 'offer', 'sdp': 'test SDP'}}
        self.send(outsider, type='signal', to=host.share_id, payload=payload)
        self.send(guest, type='join', host=host.share_id)
        self.receive(guest, 'joined')
        self.send(guest, type='signal', to=host.share_id, payload=payload)
        forwarded = self.receive(host, 'signal')
        self.assertEqual(forwarded['sender'], guest.share_id)
        self.assertEqual(forwarded['payload'], payload)
        self.send(host, type='leave')
        self.receive(guest, 'ended')
        self.assertEqual(self.receive(guest, 'sessions')['sessions'], [])

    def test_shared_watch_only_cannot_grant_control(self):
        host, guest = self.shared(), self.shared()
        self.publish(host, 'watch')
        self.send(guest, type='join', host=host.share_id)
        self.receive(guest, 'joined')
        self.send(host, type='control', peer=guest.share_id)
        self.receive(guest, 'ended')

    def test_shared_guest_cannot_grant_itself_control(self):
        host, guest = self.shared(), self.shared()
        self.publish(host)
        self.send(guest, type='join', host=host.share_id)
        self.receive(guest, 'joined')
        self.send(guest, type='control', peer=guest.share_id)
        self.receive(host, 'guest')
        self.receive(host, 'state')
        self.receive(host, 'departed')
        self.assertEqual(self.receive(host, 'state')['members'], [])

    def test_shared_host_disconnect_removes_publication_and_ends_guests(self):
        host, guest = self.shared(), self.shared()
        self.publish(host)
        self.send(guest, type='join', host=host.share_id)
        self.receive(guest, 'joined')
        host.close()
        self.receive(guest, 'ended')
        self.assertEqual(self.receive(guest, 'sessions')['sessions'], [])

    def test_shared_guest_limit_is_enforced(self):
        host = self.shared()
        self.publish(host)
        for _ in range(4):
            guest = self.shared()
            self.send(guest, type='join', host=host.share_id)
            self.receive(guest, 'joined')
        extra = self.shared()
        self.send(extra, type='join', host=host.share_id)
        self.assertIn('full', self.receive(extra, 'error')['message'])

    def test_shared_endpoint_requires_relay_credentials(self):
        import tempfile
        from pathlib import Path
        from relay_auth import KeyStore, RelayAuth
        with tempfile.TemporaryDirectory() as directory:
            store = KeyStore(Path(directory) / 'auth.db')
            store.initialize()
            _, key = store.issue('Viewer')
            self.server.relay_auth = RelayAuth('keys', store)
            for supplied in (None, 'wrong'):
                with self.assertRaisesRegex(ConnectionError, '401 Unauthorized'):
                    self.client('/sessions', session_key=supplied)
            guest = self.client('/sessions', session_key=key)
            self.assertTrue(self.receive(guest, 'welcome')['id'])
            guest.close()


if __name__ == '__main__':
    unittest.main()
