import hashlib
import http.client
import json
from functools import partial
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from accounts import Accounts, AccountError
from serve import WasmThreadingHandler, WasmThreadingServer


class AccountsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.games = self.root / 'games'
        self.games.mkdir()
        self.store = Accounts(self.root / 'private', self.games, max_saves=4096)
        self.alice = self.store.set_password('alice', 'alice-password-123')
        self.bob = self.store.set_password('bob', 'bob-password-456')
        self.bundle = {'version': 1, 'files': [{'path': '/home/web_user/.config/ppsspp/PSP/SAVEDATA/TEST/DATA.BIN', 'data': 'YWxpY2U='}]}
        handler = partial(WasmThreadingHandler, web_root=str(self.root / 'web'), wasm_root=str(self.root / 'wasm'))
        self.server = WasmThreadingServer(('127.0.0.1', 0), handler)
        self.server.accounts = self.store
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop)

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, route, method='GET', body=None, token=None):
        connection = http.client.HTTPConnection(*self.server.server_address, timeout=5)
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        connection.request(method, '/api/account/' + route, body=json.dumps(body) if body is not None else None, headers=headers)
        response = connection.getresponse()
        raw = response.read()
        result = (response.status, dict(response.getheaders()), raw)
        connection.close()
        return result

    def login(self, name='alice', password='alice-password-123'):
        status, headers, body = self.request('login', 'POST', {'name': name, 'password': password})
        self.assertEqual(status, 200, body)
        return json.loads(body)['token']

    def test_accounts_are_private_and_survive_restart(self):
        a, b = self.login(), self.login('bob', 'bob-password-456')
        status, headers, raw = self.request('saves', 'PUT', {'revision': 0, 'bundle': self.bundle}, a)
        self.assertEqual(status, 200, raw)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.server.accounts = Accounts(self.store.root, self.games)
        status, _, body = self.request('saves', token=a)
        self.assertEqual(json.loads(body), {'revision': 1, 'bundle': self.bundle})
        status, _, body = self.request('saves', token=b)
        self.assertEqual(json.loads(body)['bundle']['files'], [])
        self.assertEqual(json.loads(body)['revision'], 0)
        self.assertNotIn(a.encode(), self.store.path.read_bytes())
        self.assertNotIn(b'alice-password-123', self.store.path.read_bytes())
        self.assertEqual(self.store.path.stat().st_mode & 0o777, 0o600)

    def test_stale_browser_cannot_overwrite_saves(self):
        a, second_browser = self.login(), self.login()
        self.assertEqual(self.request('saves', 'PUT', {'revision': 0, 'bundle': self.bundle}, a)[0], 200)
        stale = {'version': 1, 'files': []}
        self.assertEqual(self.request('saves', 'PUT', {'revision': 0, 'bundle': stale}, second_browser)[0], 409)
        self.assertEqual(self.store.snapshot(self.alice), (1, self.bundle))
        self.assertEqual(self.request('saves', 'PUT', {'revision': 1, 'bundle': stale}, second_browser)[0], 200)
        self.assertEqual(self.store.snapshot(self.alice), (2, stale))

    def test_parallel_writes_have_one_winner(self):
        results = []
        def put():
            try:
                results.append(self.store.put_snapshot(self.alice, 0, self.bundle))
            except AccountError as exc:
                results.append(exc.status)
        threads = [threading.Thread(target=put) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(sorted(results), [1, 409])

    def test_api_rejects_anonymous_including_head_and_logout_revokes(self):
        for endpoint in ('saves', 'games', 'me', 'unknown'):
            for method in ('GET', 'HEAD'):
                self.assertEqual(self.request(endpoint, method)[0], 401)
        token = self.login()
        self.assertEqual(self.request('logout', 'POST', {}, token)[0], 200)
        self.assertEqual(self.request('me', token=token)[0], 401)

    def test_password_reset_keeps_identity_and_saves_but_revokes_sessions(self):
        token = self.login()
        self.store.put_snapshot(self.alice, 0, self.bundle)
        self.assertEqual(self.store.set_password('alice', 'new-password-789'), self.alice)
        self.assertEqual(self.request('me', token=token)[0], 401)
        self.assertEqual(self.store.snapshot(self.alice)[1], self.bundle)
        self.login(password='new-password-789')
        token = self.login(password='new-password-789')
        with self.store.connect() as db:
            db.execute('UPDATE sessions SET expires=0')
        self.assertEqual(self.request('me', token=token)[0], 401)

    def test_login_rate_limit_and_invalid_input(self):
        for _ in range(10):
            self.assertEqual(self.request('login', 'POST', {'name': 'unknown', 'password': 'wrong'})[0], 401)
        self.assertEqual(self.request('login', 'POST', {'name': 'alice', 'password': 'alice-password-123'})[0], 429)
        self.assertEqual(self.request('login', 'POST', {'name': [], 'password': 'x'})[0], 400)
        with patch('accounts.time.time', return_value=time.time() + 901):
            self.login()

    def test_bad_paths_and_payloads_never_replace_snapshot(self):
        token = self.login()
        for path in ('/etc/passwd', '/home/web_user/.config/ppsspp/../secret',
                     '/home/web_user/.config/ppsspp/a//b', '/home/web_user/.config/ppsspp/a\\b',
                     '/home/web_user/.config/ppsspp/a\x00b'):
            bundle = {'version': 1, 'files': [{'path': path, 'data': 'YQ=='}]}
            self.assertEqual(self.request('saves', 'PUT', {'revision': 0, 'bundle': bundle}, token)[0], 400)
        for bundle in (None, [], {'version': 1, 'files': [None]}, {'version': 1, 'files': self.bundle['files'] * 2},
                       {'version': 1, 'files': [{'path': self.bundle['files'][0]['path'], 'data': '!!'}]}):
            self.assertEqual(self.request('saves', 'PUT', {'revision': 0, 'bundle': bundle}, token)[0], 400)
        self.assertEqual(self.request('saves', 'PUT', {'revision': True, 'bundle': self.bundle}, token)[0], 400)
        huge = {'version': 1, 'files': [{'path': self.bundle['files'][0]['path'], 'data': 'YQ==' * 2000}]}
        self.assertEqual(self.request('saves', 'PUT', {'revision': 0, 'bundle': huge}, token)[0], 413)
        self.assertEqual(self.store.snapshot(self.alice)[0], 0)

    def test_library_is_authenticated_and_cannot_escape_directory(self):
        (self.games / 'Game.iso').write_bytes(b'game image')
        (self.games / 'SECRET.txt').write_bytes(b'secret')
        (self.games / 'Link.iso').symlink_to(self.games / 'SECRET.txt')
        token = self.login()
        status, _, body = self.request('games', token=token)
        self.assertEqual(json.loads(body)['games'], [{'name': 'Game.iso', 'size': 10}])
        self.assertEqual(self.request('game', 'POST', {'name': 'Game.iso'})[0], 401)
        status, headers, body = self.request('game', 'POST', {'name': 'Game.iso'}, token)
        self.assertEqual((status, body), (200, b'game image'))
        self.assertEqual(headers['Cache-Control'], 'no-store')
        for name in ('../Game.iso', 'Link.iso', 'SECRET.txt', [], '/etc/passwd'):
            self.assertEqual(self.request('game', 'POST', {'name': name}, token)[0], 404)

    def test_disabled_and_unavailable_storage_fail_closed(self):
        self.server.accounts = None
        self.assertEqual(self.request('login', 'POST', {'name': 'alice', 'password': 'x'})[0], 404)
        self.server.accounts = self.store
        token = self.login()
        self.store.path.unlink()
        self.assertEqual(self.request('saves', token=token)[0], 503)
        self.assertFalse(self.store.path.exists())


if __name__ == '__main__':
    unittest.main()
