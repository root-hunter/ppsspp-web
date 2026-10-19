import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from relay_auth import AuthError, KeyStore, RelayAuth


class AuthTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'auth.sqlite3'
        self.store = KeyStore(self.path)
        self.store.initialize()
        self.auth = RelayAuth('keys', self.store)

    def test_independent_keys_hash_storage_and_revocation(self):
        alice, key_a = self.store.issue('Alice')
        bob, key_b = self.store.issue('Bob')
        self.assertNotEqual(key_a, key_b)
        self.assertEqual(self.auth.authorize({'session_key': [key_a]}), alice)
        self.assertEqual(self.auth.authorize({'session_key': [key_b]}), bob)
        self.assertNotIn(key_a.encode(), self.path.read_bytes())
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        self.assertTrue(self.store.revoke(alice))
        self.assertFalse(self.auth.active(alice))
        self.assertTrue(self.auth.active(bob))
        with self.assertRaises(AuthError):
            self.auth.authorize({'session_key': [key_a]})
        self.assertEqual(self.auth.authorize({'session_key': [key_b]}), bob)

    def test_expiry_and_reopen_persist(self):
        with patch('relay_auth.time.time', return_value=1000):
            key_id, key = self.store.issue('Temporary', ttl_hours=1)
        reopened = RelayAuth('keys', KeyStore(self.path))
        with patch('relay_auth.time.time', return_value=4599):
            self.assertEqual(reopened.authorize({'session_key': [key]}), key_id)
        with patch('relay_auth.time.time', return_value=4600):
            with self.assertRaises(AuthError):
                reopened.authorize({'session_key': [key]})
            self.assertFalse(reopened.active(key_id))

    def test_reject_missing_duplicate_malformed_and_unknown_keys(self):
        _, key = self.store.issue('Alice')
        for values in ([], ['', key], [key, key], [''], ['x' * 9000], [key[:-1]], [key.replace('psp_', 'bad_')]):
            with self.subTest(values=values), self.assertRaises(AuthError):
                self.auth.authorize({'session_key': values})
        with self.assertRaises(ValueError):
            RelayAuth('typo', self.store)
        for ttl in (-1, 0, float('nan'), float('inf')):
            with self.assertRaises(ValueError):
                self.store.issue('Alice', ttl)

    def test_database_failure_fails_closed(self):
        key_id, key = self.store.issue('Alice')
        self.path.unlink()
        with self.assertRaises(AuthError):
            self.auth.authorize({'session_key': [key]})
        self.assertFalse(self.auth.active(key_id))
        self.assertFalse(self.path.exists())

    def test_cli_issue_list_revoke(self):
        def cli(*args):
            return subprocess.check_output([sys.executable, str(Path(__file__).resolve().parents[1] / 'relay_admin.py'),
                                            '--db', str(self.path), *args], text=True)
        issued = json.loads(cli('issue', '--user', 'Alice', '--ttl-hours', '24'))
        listed = cli('list')
        self.assertNotIn(issued['session_key'], listed)
        self.assertEqual(json.loads(listed)['status'], 'active')
        cli('revoke', issued['id'])
        self.assertEqual(json.loads(cli('list'))['status'], 'revoked')
        with self.assertRaises(AuthError):
            self.auth.authorize({'session_key': [issued['session_key']]})
