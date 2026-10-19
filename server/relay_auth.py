"""Relay authentication policy and persistent, hashed per-user credentials."""
import hashlib
from contextlib import contextmanager
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time


class AuthError(Exception):
    pass


class KeyStore:
    def __init__(self, path):
        self.path = str(path)

    def initialize(self):
        Path(self.path).parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        descriptor = os.open(self.path, os.O_CREAT | os.O_RDWR, 0o600)
        try:
            os.fchmod(descriptor, 0o600)
        finally:
            os.close(descriptor)
        with self.connect() as db:
            db.execute('''CREATE TABLE IF NOT EXISTS relay_keys (
                id TEXT PRIMARY KEY, user TEXT NOT NULL, digest TEXT NOT NULL,
                created REAL NOT NULL, expires REAL, revoked REAL)''')

    @contextmanager
    def connect(self):
        # mode=rw prevents a missing/mis-mounted database from silently creating
        # a fresh store during authentication.
        db = sqlite3.connect(Path(self.path).resolve().as_uri() + '?mode=rw', uri=True, timeout=5)
        try:
            with db:
                yield db
        finally:
            db.close()

    def issue(self, user, ttl_hours=None):
        if not user or len(user) > 128 or any(ord(c) < 32 for c in user):
            raise ValueError('User must contain 1–128 printable characters')
        if ttl_hours is not None and not 0 < ttl_hours <= 87600:
            raise ValueError('TTL must be positive and at most 87600 hours')
        key_id = secrets.token_hex(8)
        key = 'psp_' + key_id + '.' + secrets.token_urlsafe(32)
        now = time.time()
        expires = now + ttl_hours * 3600 if ttl_hours is not None else None
        with self.connect() as db:
            db.execute('INSERT INTO relay_keys VALUES (?, ?, ?, ?, ?, NULL)',
                       (key_id, user, hashlib.sha256(key.encode()).hexdigest(), now, expires))
        return key_id, key

    def authenticate(self, key):
        if not re.fullmatch(r'psp_[a-f0-9]{16}\.[A-Za-z0-9_-]{43}', key):
            raise AuthError('relay authentication required')
        key_id = key[4:20]
        with self.connect() as db:
            row = db.execute('SELECT digest, expires, revoked FROM relay_keys WHERE id=?', (key_id,)).fetchone()
        if (not row or not secrets.compare_digest(row[0], hashlib.sha256(key.encode()).hexdigest())
                or row[2] is not None or row[1] is not None and row[1] <= time.time()):
            raise AuthError('relay authentication required')
        return key_id

    def active(self, key_id):
        with self.connect() as db:
            row = db.execute('SELECT expires, revoked FROM relay_keys WHERE id=?', (key_id,)).fetchone()
        return bool(row and row[1] is None and (row[0] is None or row[0] > time.time()))

    def revoke(self, key_id):
        with self.connect() as db:
            return db.execute('UPDATE relay_keys SET revoked=? WHERE id=? AND revoked IS NULL',
                              (time.time(), key_id)).rowcount > 0

    def list(self):
        with self.connect() as db:
            return db.execute('SELECT id, user, created, expires, revoked FROM relay_keys ORDER BY created').fetchall()


class RelayAuth:
    def __init__(self, mode='open', store=None):
        if mode not in ('open', 'keys'):
            raise ValueError('RELAY_AUTH_MODE must be open or keys')
        if mode == 'keys' and store is None:
            raise ValueError('keys mode requires a key store')
        self.mode, self.store = mode, store

    @classmethod
    def from_env(cls):
        mode = os.getenv('RELAY_AUTH_MODE', 'open')
        store = None
        if mode == 'keys':
            store = KeyStore(os.getenv('RELAY_AUTH_DB', '/data/relay-auth.sqlite3'))
            store.initialize()
        return cls(mode, store)

    def authorize(self, params):
        if self.mode == 'open':
            return None
        supplied = params.get('session_key', [])
        if len(supplied) != 1:
            raise AuthError('relay authentication required')
        try:
            return self.store.authenticate(supplied[0])
        except (sqlite3.Error, OSError) as exc:
            raise AuthError('relay authentication unavailable') from exc

    def active(self, key_id):
        if self.mode == 'open':
            return True
        try:
            return self.store.active(key_id)
        except (sqlite3.Error, OSError):
            return False
