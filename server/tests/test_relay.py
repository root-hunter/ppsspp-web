"""Wire integration tests against the real relay, no emulated WebSockets.
Run: python3 -m unittest discover -s server/tests -v
"""
import base64
import os
import socket
import ssl
import struct
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from urllib.parse import urlencode
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import relay
from relay_auth import RelayAuth, KeyStore
from relay import AdhocWebSocketHandler, AdhocLobby, ThreadingAdhocWebSocketServer
from serve import WasmThreadingHandler, WasmThreadingServer
from functools import partial


class Client:
    def __init__(self, address, path='', token=None, mac=None, room='public', tls_context=None, session_key=None):
        self.token = token or os.urandom(16).hex()
        self.socket = socket.create_connection(address, timeout=2)
        if tls_context:
            try:
                self.socket = tls_context.wrap_socket(self.socket, server_hostname='localhost')
            except OSError as exc:
                self.socket.close()
                raise ConnectionError('TLS connection rejected') from exc
        self.reader = self.socket.makefile('rb')
        key = base64.b64encode(os.urandom(16)).decode()
        query = f'v=1&token={self.token}&room={room}'
        if session_key is not None:
            query += '&' + urlencode({'session_key': session_key})
        if mac:
            query += '&mac=' + mac.hex(':')
        self.socket.sendall((f'GET /adhoc{path}?{query} HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\n'
                             f'Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n'
                             'Sec-WebSocket-Protocol: binary\r\n\r\n').encode())
        line = self.reader.readline()
        if b'101' not in line:
            self.close()
            raise ConnectionError('upgrade rejected: ' + line.decode('ascii').strip())
        while self.reader.readline() != b'\r\n':
            pass

    def send(self, data, opcode=2, final=True):
        mask = os.urandom(4)
        n = len(data)
        header = bytes([(0x80 if final else 0) | opcode])
        if n < 126:
            header += bytes([0x80 | n])
        elif n < 65536:
            header += bytes([0x80 | 126]) + struct.pack('>H', n)
        else:
            header += bytes([0x80 | 127]) + struct.pack('>Q', n)
        self.socket.sendall(header + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv(self):
        h = self.reader.read(2)
        if not h:
            return None
        n = h[1] & 127
        if n == 126:
            n = struct.unpack('>H', self.reader.read(2))[0]
        elif n == 127:
            n = struct.unpack('>Q', self.reader.read(8))[0]
        data = self.reader.read(n)
        if h[0] & 15 == 9:
            self.send(data, 10)
            return self.recv()
        return data

    def close(self):
        try:
            self.socket.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        self.reader.close()
        self.socket.close()

    def login(self, mac, game=b'ULUS10466'):
        self.mac = mac
        self.send(struct.pack('<B6s128s9s', 1, mac, b'Player', game))
        ack = self.recv()
        if ack is None:
            return None
        assert ack[:3] == b'PA1'
        self.ip = socket.inet_ntoa(ack[3:])
        return self.ip

    def join(self, group=b'TEKKEN'):
        self.send(struct.pack('<B8s', 2, group))

    def datagram(self, host, port, payload):
        h = host.encode()
        self.send(b'PU1' + bytes([len(h)]) + h + struct.pack('>H', port) + payload)


class RelayTest(unittest.TestCase):
    def setUp(self):
        AdhocWebSocketHandler.lobby = AdhocLobby()
        self.server = ThreadingAdhocWebSocketServer(('127.0.0.1', 0), AdhocWebSocketHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.address = self.server.server_address
        self.clients = []

    def tearDown(self):
        for c in self.clients:
            c.close()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)

    def client(self, *args, **kwargs):
        kwargs['tls_context'] = getattr(self, 'tls_context', None)
        c = Client(self.address, *args, **kwargs)
        self.clients.append(c)
        return c

    def pair(self, second_game=b'ULUS10466', second_room='public'):
        a, b = self.client(), self.client(room=second_room)
        a.login(bytes.fromhex('020000000001'))
        b.login(bytes.fromhex('020000000002'), second_game)
        a.join(); self.assertEqual(a.recv()[0], 6)
        b.join()
        if second_game == b'ULUS10466' and second_room == 'public':
            self.assertEqual(a.recv()[0], 2)
            self.assertEqual(b.recv()[0], 2)
        self.assertEqual(b.recv()[0], 6)
        return a, b

    def data(self, owner, mode, port=3000, extra=''):
        # Client's path is inserted before ?v: include extra as part of query.
        path = f'/{mode}'
        c = Client.__new__(Client)
        # Keep the regular upgrade constructor and add data parameters to room.
        c.__init__(self.address, path, owner.token, owner.mac, f'public&port={port}{extra}',
                   tls_context=getattr(self, 'tls_context', None))
        self.clients.append(c)
        return c

    def test_session_key_required_on_every_endpoint(self):
        with tempfile.TemporaryDirectory() as directory:
            store = KeyStore(Path(directory) / 'auth.db')
            store.initialize()
            _, key = store.issue('Alice')
            self.server.relay_auth = RelayAuth('keys', store)
            for route in ('', '/udp', '/tcp-listen', '/tcp-connect'):
                for supplied in (None, 'wrong-key', key + 'x'):
                    with self.subTest(route=route, key=supplied), self.assertRaisesRegex(ConnectionError, '401 Unauthorized'):
                        self.client(path=route, session_key=supplied)
            with self.assertRaisesRegex(ConnectionError, '401 Unauthorized'):
                self.client(room='public&session_key=wrong', session_key=key)
            owner = self.client(session_key=key)
            owner.login(bytes.fromhex('020000000001'))
            data = self.client(path='/udp', token=owner.token, mac=owner.mac,
                               room='public&port=3000', session_key=key)
            self.assertIsNotNone(data)
            with self.assertRaisesRegex(ConnectionError, '401 Unauthorized'):
                self.client(path='/udp', token=owner.token, mac=owner.mac, room='public&port=3001')
            _, other_key = store.issue('Bob')
            with self.assertRaises(ConnectionError):
                self.client(path='/udp', token=owner.token, mac=owner.mac,
                            room='public&port=3001', session_key=other_key)
            # Close before deleting the store, so writer threads finish normally.
            for client in self.clients:
                client.close()
            self.clients.clear()

    def test_revoke_disconnects_only_affected_user_and_data(self):
        with tempfile.TemporaryDirectory() as directory:
            store = KeyStore(Path(directory) / 'auth.db')
            store.initialize()
            alice_id, alice_key = store.issue('Alice')
            _, bob_key = store.issue('Bob')
            self.server.relay_auth = RelayAuth('keys', store)
            alice = self.client(session_key=alice_key)
            alice.login(bytes.fromhex('020000000001'))
            data = self.client(path='/udp', token=alice.token, mac=alice.mac,
                               room='public&port=3000', session_key=alice_key)
            bob = self.client(session_key=bob_key)
            bob.login(bytes.fromhex('020000000002'))
            store.revoke(alice_id)
            self.assertIsNone(data.recv())
            self.assertIsNone(alice.recv())
            ping = b'PR1' + struct.pack('>d', 1)
            bob.send(ping)
            self.assertEqual(bob.recv(), ping)
            with self.assertRaisesRegex(ConnectionError, '401 Unauthorized'):
                self.client(session_key=alice_key)
            for client in self.clients:
                client.close()
            self.clients.clear()

    def test_open_mode_does_not_require_session_key(self):
        self.server.relay_auth = RelayAuth('open')
        self.client().login(bytes.fromhex('020000000001'))

    def test_discovery_and_heartbeat(self):
        a, b = self.pair()
        b.send(b'\x04')
        self.assertEqual(b.recv()[:9], b'\x04TEKKEN\x00\x00')
        self.assertEqual(b.recv(), b'\x05')
        ping = b'PR1' + struct.pack('>d', 1234.5)
        a.send(ping)
        self.assertEqual(a.recv(), ping)
        a.send(b'x', 9)
        self.assertEqual(a.recv(), b'x')

    def test_pdp_unicast_broadcast_order_and_boundaries(self):
        a, b = self.pair()
        da, db = self.data(a, 'udp'), self.data(b, 'udp')
        for i in range(20):
            da.datagram(b.ip, 3000, bytes([i]) * (i + 1))
        for i in range(20):
            p = db.recv(); n = p[3]
            self.assertEqual(p[4:4+n].decode(), a.ip)
            self.assertEqual(p[n+6:], bytes([i]) * (i + 1))
        da.datagram('255.255.255.255', 3000, b'broadcast')
        self.assertTrue(db.recv().endswith(b'broadcast'))

    def test_game_room_and_group_isolation(self):
        for game, room in ((b'OTHER0001', 'public'), (b'ULUS10466', 'private')):
            a, b = self.pair(game, room)
            da, db = self.data(a, 'udp'), self.data(b, 'udp')
            da.datagram(b.ip, 3000, b'forbidden')
            # Observe the actual server routing result without poisoning a timed-out buffered socket.
            time.sleep(.03)
            import select
            self.assertFalse(select.select([db.socket], [], [], .08)[0])
            for c in self.clients:
                c.close()
            self.clients.clear()
            time.sleep(.03)
        a, b = self.pair()
        da, db = self.data(a, 'udp'), self.data(b, 'udp')
        b.join(b'OTHER'); self.assertEqual(b.recv()[0], 6); self.assertEqual(a.recv()[0], 3)
        da.datagram(b.ip, 3000, b'forbidden')
        import select
        self.assertFalse(select.select([db.socket], [], [], .08)[0])

    def test_ptp_lifecycle_bidirectional_and_disconnect(self):
        a, b = self.pair()
        listener = self.data(b, 'tcp-listen', 4000)
        connector = self.data(a, 'tcp-connect', 5000, f'&dst={b.ip}&dstport=4000')
        opened = listener.recv()
        self.assertEqual(opened[:4], b'PT1\x01')
        conn = opened[4:8]
        connector.send(b'hello')
        self.assertEqual(listener.recv(), b'PT1\x02' + conn + b'hello')
        listener.send(b'PT1\x02' + conn + b'world')
        self.assertEqual(connector.recv(), b'world')
        listener.send(b'PT1\x03' + conn)
        self.assertIsNone(connector.recv())
        self.assertEqual(listener.recv(), b'PT1\x03' + conn)

    def test_control_disconnect_cleans_data_and_reconnect(self):
        a, b = self.pair()
        data = self.data(a, 'udp')
        a.close()
        self.clients.remove(a)
        self.assertEqual(b.recv()[0], 3)
        self.assertIsNone(data.recv())
        for _ in range(100):
            if a.token not in AdhocWebSocketHandler.lobby.users:
                break
            time.sleep(.01)
        replacement = self.client(token=a.token)
        self.assertIsNotNone(replacement.login(a.mac))
        self.assertNotEqual(replacement.ip, a.ip)

    def test_duplicate_mac_rejected_and_unauthorized_data(self):
        a = self.client(); a.login(bytes.fromhex('020000000001'))
        b = self.client(); self.assertIsNone(b.login(a.mac))
        with self.assertRaises(ConnectionError):
            self.client('/udp', mac=a.mac, room='public&port=3000')

    def test_failed_ptp_does_not_report_open(self):
        a, b = self.pair()
        with self.assertRaises(ConnectionError):
            self.data(a, 'tcp-connect', 5000, f'&dst={b.ip}&dstport=4000')

    def test_malformed_packets_and_frame_limits(self):
        a = self.client(); a.login(bytes.fromhex('020000000001'))
        a.send(b'\xff'); self.assertIsNone(a.recv())
        a = self.client(); a.login(bytes.fromhex('020000000003'))
        a.socket.sendall(bytes([0x82, 0xff]) + struct.pack('>Q', 2**40))
        self.assertIsNone(a.recv())
        a = self.client(); a.login(bytes.fromhex('020000000004'))
        data = self.data(a, 'udp'); data.send(b'PU2garbage'); self.assertIsNone(data.recv())
        a = self.client(); a.send(b'hello', 1); self.assertIsNone(a.recv())

    def test_idle_timeout_expires_control_and_owned_endpoints(self):
        old = relay.TTL
        relay.TTL = .15
        try:
            a = self.client(); a.login(bytes.fromhex('020000000001'))
            data = self.data(a, 'udp')
            self.assertIsNone(a.recv())
            self.assertIsNone(data.recv())
        finally:
            relay.TTL = old

    def test_fragmented_control_stream_and_login_validation(self):
        a = self.client()
        login = struct.pack('<B6s128s9s', 1, bytes.fromhex('020000000001'), b'Player', b'ULUS10466')
        a.send(login[:7]); a.send(login[7:])
        self.assertEqual(a.recv()[:3], b'PA1')
        a.send(login); self.assertIsNone(a.recv())
        b = self.client()
        b.send(struct.pack('<B6s128s9s', 1, bytes.fromhex('ff0000000001'), b'Player', b'ULUS10466'))
        self.assertIsNone(b.recv())

    def test_websocket_fragments_preserve_one_datagram(self):
        a, b = self.pair()
        da, db = self.data(a, 'udp'), self.data(b, 'udp')
        h = b.ip.encode()
        packet = b'PU1' + bytes([len(h)]) + h + struct.pack('>H', 3000) + b'fragmented'
        da.send(packet[:10], final=False)
        da.send(b'ping', opcode=9)
        self.assertEqual(da.recv(), b'ping')
        da.send(packet[10:], opcode=0)
        self.assertTrue(db.recv().endswith(b'fragmented'))
        da.send(struct.pack('>H', 1000), opcode=8)
        self.assertEqual(da.recv(), struct.pack('>H', 1000))

    def test_connection_limit_and_virtual_ip_wrap(self):
        old = relay.MAX_CONNECTIONS
        relay.MAX_CONNECTIONS = 1
        try:
            a = self.client(); a.login(bytes.fromhex('020000000001'))
            with self.assertRaises(ConnectionError):
                self.client()
        finally:
            relay.MAX_CONNECTIONS = old
        AdhocWebSocketHandler.lobby.next_ip = 2
        b = self.client(); b.login(bytes.fromhex('020000000002'))
        self.assertNotEqual(a.ip, b.ip)

    def test_artificial_latency_and_jitter_preserve_order(self):
        old = relay.LATENCY, relay.JITTER
        relay.LATENCY, relay.JITTER = .02, .01
        try:
            a, b = self.pair()
            da, db = self.data(a, 'udp'), self.data(b, 'udp')
            start = time.monotonic()
            for i in range(10):
                da.datagram(b.ip, 3000, bytes([i]))
            for i in range(10):
                self.assertEqual(db.recv()[-1:], bytes([i]))
            self.assertGreaterEqual(time.monotonic() - start, .009)
        finally:
            relay.LATENCY, relay.JITTER = old

    def test_busy_receive_only_pdp_keeps_heartbeat_and_survives_idle_deadline(self):
        old = relay.TTL, relay.HEARTBEAT_INTERVAL
        relay.TTL, relay.HEARTBEAT_INTERVAL = 2, .08
        try:
            a, b = self.pair()
            relay.TTL = .3
            sender, receiver = self.data(a, 'udp'), self.data(b, 'udp')
            start = time.monotonic()
            for i in range(30):
                sender.datagram(b.ip, 3000, bytes([i]))
                # recv responds to real WebSocket ping frames, like a browser.
                self.assertEqual(receiver.recv()[-1:], bytes([i]))
                time.sleep(.025)
            self.assertGreater(time.monotonic() - start, .6)
        finally:
            relay.TTL, relay.HEARTBEAT_INTERVAL = old

    def test_server_shutdown_closes_live_clients(self):
        a, b = self.pair()
        data = self.data(a, 'udp')
        self.server.shutdown(); self.server.server_close()
        self.assertIsNone(a.recv()); self.assertIsNone(data.recv())


class HTTPSRelayTest(RelayTest):
    """Run the wire suite through the same TLS/HTTP upgrade as Docker."""

    @classmethod
    def setUpClass(cls):
        cls.cert_dir = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.cert_dir.cleanup)
        cert = str(Path(cls.cert_dir.name) / 'cert.pem')
        key = str(Path(cls.cert_dir.name) / 'key.pem')
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                        '-keyout', key, '-out', cert, '-days', '1',
                        '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cls.server_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        cls.server_context.load_cert_chain(cert, key)
        cls.tls_context = ssl.create_default_context(cafile=cert)

    def setUp(self):
        AdhocWebSocketHandler.lobby = AdhocLobby()
        root = str(Path(__file__).resolve().parents[2])
        handler = partial(WasmThreadingHandler, web_root=root, wasm_root=root)
        self.server = WasmThreadingServer(('127.0.0.1', 0), handler)
        self.server.adhoc_enabled = True
        self.server.socket = self.server_context.wrap_socket(
            self.server.socket, server_side=True, do_handshake_on_connect=False)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.address = self.server.server_address
        self.clients = []


class FrameReaderTest(unittest.TestCase):
    def setUp(self):
        self.incoming, self.outgoing = socket.socketpair()
        self.incoming.setblocking(False)
        self.reader = self.incoming.makefile('rb', buffering=0)
        self.handler = object.__new__(AdhocWebSocketHandler)
        self.handler.request = self.incoming
        self.handler.reader = self.reader
        self.handler.alive = True
        self.handler.fragments = bytearray()
        self.handler.fragmenting = False

    def tearDown(self):
        self.reader.close()
        self.incoming.close()
        self.outgoing.close()

    def test_partial_frame_and_temporary_no_data_preserve_payload(self):
        self.assertIsNone(self.reader.read(1))
        payload = b'LAN payload' * 30
        mask = b'abcd'
        frame = b'\x82\xfe' + struct.pack('>H', len(payload)) + mask
        frame += bytes(b ^ mask[i % 4] for i, b in enumerate(payload))

        def deliver():
            # Split the header, extended length, mask and payload over reads.
            for start, end in ((0, 1), (1, 3), (3, 6), (6, 11), (11, len(frame))):
                time.sleep(.01)
                self.outgoing.sendall(frame[start:end])

        sender = threading.Thread(target=deliver)
        sender.start()
        try:
            self.assertEqual(self.handler._read_frame(), payload)
        finally:
            sender.join(2)

    def test_eof_mid_frame_is_protocol_error(self):
        self.outgoing.sendall(b'\x82')
        self.outgoing.shutdown(socket.SHUT_WR)
        with self.assertRaisesRegex(relay.ProtocolError, 'truncated frame'):
            self.handler._read_frame()

    def test_no_data_respects_timeout(self):
        old = relay.TTL
        relay.TTL = .03
        try:
            with self.assertRaisesRegex(TimeoutError, 'frame read timed out'):
                self.handler._read_frame()
        finally:
            relay.TTL = old

    def test_stopped_connection_does_not_wait_for_frame(self):
        self.handler.alive = False
        with self.assertRaisesRegex(relay.ProtocolError, 'connection stopped'):
            self.handler._read_frame()


if __name__ == '__main__':
    unittest.main()
