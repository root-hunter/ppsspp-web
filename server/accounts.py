"""Opt-in private-server accounts, sessions and revisioned save snapshots.

No public registration: provision users with account_admin.py. Game images are
managed by the operator in a separate, read-only library directory.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from urllib.parse import urlparse


class AccountError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


class Accounts:
    def __init__(self, data_dir, games_dir=None, max_saves=64 * 1024 * 1024):
        self.root = Path(data_dir).resolve()
        self.games = Path(games_dir).resolve() if games_dir else None
        self.max_saves = max_saves
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = self.root / 'accounts.sqlite3'
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR, 0o600)
        os.fchmod(fd, 0o600)
        os.close(fd)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL,
                    salt BLOB NOT NULL, password BLOB NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions (
                    digest TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS saves (
                    user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, body BLOB NOT NULL);
                CREATE TABLE IF NOT EXISTS login_limits (
                    peer TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset REAL NOT NULL);
            ''')

    @classmethod
    def from_env(cls):
        root = os.getenv('PPSSPP_ACCOUNT_DATA')
        return cls(root, os.getenv('PPSSPP_SERVER_GAMES')) if root else None

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path.as_uri() + '?mode=rw', uri=True, timeout=10)
        try:
            with db:
                yield db
        finally:
            db.close()

    def set_password(self, name, password):
        if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}', name):
            raise ValueError('Username must contain 1–64 letters, digits, dots, underscores or hyphens')
        if not 12 <= len(password) <= 1024:
            raise ValueError('Password must contain 12–1024 characters')
        salt = secrets.token_bytes(16)
        digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT id FROM users WHERE name=?', (name,)).fetchone()
            uid = row[0] if row else secrets.token_hex(16)
            db.execute('INSERT INTO users VALUES (?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET salt=excluded.salt, password=excluded.password',
                       (uid, name, salt, digest))
            db.execute('DELETE FROM sessions WHERE user_id=?', (uid,))
        return uid

    def login(self, name, password, peer):
        now = time.time()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM login_limits WHERE reset<=?', (now,))
            db.execute('DELETE FROM sessions WHERE expires<=?', (now,))
            row = db.execute('SELECT attempts FROM login_limits WHERE peer=?', (peer,)).fetchone()
            if row and row[0] >= 10:
                raise AccountError(429, 'Too many login attempts; retry in 15 minutes')
            db.execute('INSERT INTO login_limits VALUES (?, 1, ?) ON CONFLICT(peer) DO UPDATE SET attempts=attempts+1', (peer, now + 900))
            row = db.execute('SELECT id, salt, password FROM users WHERE name=?', (name,)).fetchone()
        digest = hashlib.scrypt(password.encode(), salt=row[1] if row else b'\0' * 16, n=16384, r=8, p=1)
        if not row or not secrets.compare_digest(row[2], digest):
            raise AccountError(401, 'Invalid username or password')
        token = secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            current = db.execute('SELECT password FROM users WHERE id=?', (row[0],)).fetchone()
            if not current or not secrets.compare_digest(current[0], row[2]):
                raise AccountError(401, 'Credentials changed; sign in again')
            db.execute('INSERT INTO sessions VALUES (?, ?, ?)', (hashlib.sha256(token.encode()).hexdigest(), row[0], now + 7 * 86400))
        return {'token': token, 'id': row[0], 'name': name}

    def user(self, authorization):
        token = authorization.removeprefix('Bearer ')
        if not authorization.startswith('Bearer ') or not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
            raise AccountError(401, 'Sign in required')
        digest = hashlib.sha256(token.encode()).hexdigest()
        with self.connect() as db:
            row = db.execute('SELECT u.id, u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.digest=? AND s.expires>?', (digest, time.time())).fetchone()
        if not row:
            raise AccountError(401, 'Session expired; sign in again')
        return {'id': row[0], 'name': row[1]}, digest

    def snapshot(self, uid):
        with self.connect() as db:
            row = db.execute('SELECT revision, body FROM saves WHERE user_id=?', (uid,)).fetchone()
        return (row[0], json.loads(row[1])) if row else (0, {'version': 1, 'files': []})

    def put_snapshot(self, uid, revision, bundle):
        self.validate_bundle(bundle)
        body = json.dumps(bundle, separators=(',', ':')).encode()
        if len(body) > self.max_saves:
            raise AccountError(413, 'Save snapshot exceeds the server limit')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT revision FROM saves WHERE user_id=?', (uid,)).fetchone()
            if revision != (row[0] if row else 0):
                raise AccountError(409, 'Saves changed in another browser. Export local saves before restoring the server copy.')
            db.execute('INSERT INTO saves VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision, body=excluded.body', (uid, revision + 1, body))
        return revision + 1

    @staticmethod
    def validate_bundle(bundle):
        if not isinstance(bundle, dict) or bundle.get('version') != 1 or not isinstance(bundle.get('files'), list) or len(bundle['files']) > 10000:
            raise AccountError(400, 'Invalid save snapshot')
        seen = set()
        for entry in bundle['files']:
            if not isinstance(entry, dict):
                raise AccountError(400, 'Invalid save entry')
            path, data = entry.get('path'), entry.get('data')
            roots = ('/home/web_user/.config/ppsspp/', '/root/.config/ppsspp/')
            if (not isinstance(path, str) or len(path) > 1024 or not path.startswith(roots)
                    or any(p in ('', '.', '..') for p in path[1:].split('/'))
                    or any(ord(c) < 32 or c == '\\' for c in path) or path in seen or not isinstance(data, str)):
                raise AccountError(400, 'Invalid save path or data')
            try:
                base64.b64decode(data, validate=True)
            except (ValueError, TypeError):
                raise AccountError(400, 'Invalid save encoding') from None
            seen.add(path)

    def library(self):
        if not self.games or not self.games.is_dir():
            return []
        return [{'name': p.name, 'size': p.stat().st_size} for p in sorted(self.games.iterdir())
                if self.game_path(p.name) is not None]

    def game_path(self, name):
        if not self.games or not re.fullmatch(r'[a-zA-Z0-9_][a-zA-Z0-9_. -]{0,199}\.(iso|cso|chd|pbp|elf|prx)', name, re.I):
            return None
        path = self.games / name
        if path.is_symlink() or not path.is_file() or path.resolve().parent != self.games:
            return None
        return path


def serve_accounts(handler):
    """Handle API requests only; all account responses bypass browser caches."""
    path = urlparse(handler.path).path
    if not path.startswith('/api/account/'):
        return False
    store = getattr(handler.server, 'accounts', None)

    def reply(status, body):
        data = json.dumps(body).encode()
        handler.send_response(status)
        handler.send_header('Content-Type', 'application/json')
        handler.send_header('Cache-Control', 'no-store')
        handler.send_header('X-Content-Type-Options', 'nosniff')
        handler.send_header('Content-Length', str(len(data)))
        handler.end_headers()
        if handler.command != 'HEAD':
            handler.wfile.write(data)

    def read_json(limit):
        if handler.headers.get('Transfer-Encoding') or handler.headers.get_content_type() != 'application/json':
            raise AccountError(400, 'Expected a JSON request with Content-Length')
        try:
            length = int(handler.headers.get('Content-Length', '-1'))
        except ValueError:
            raise AccountError(400, 'Invalid Content-Length') from None
        if not 0 <= length <= limit:
            raise AccountError(413, 'Request exceeds the server limit')
        handler.connection.settimeout(30)
        raw = handler.rfile.read(length)
        if len(raw) != length:
            raise AccountError(400, 'Incomplete request')
        try:
            result = json.loads(raw)
        except (ValueError, UnicodeError):
            raise AccountError(400, 'Invalid JSON') from None
        if not isinstance(result, dict):
            raise AccountError(400, 'Expected a JSON object')
        return result

    try:
        if not store:
            raise AccountError(404, 'Server accounts are disabled')
        method = handler.command
        if path == '/api/account/login' and method == 'POST':
            data = read_json(8192)
            name, password = data.get('name'), data.get('password')
            if not isinstance(name, str) or not isinstance(password, str) or len(name) > 64 or len(password) > 1024:
                raise AccountError(400, 'Invalid credentials')
            reply(200, store.login(name, password, handler.client_address[0]))
        else:
            user, digest = store.user(handler.headers.get('Authorization', ''))
            if path == '/api/account/me' and method == 'GET':
                reply(200, user)
            elif path == '/api/account/logout' and method == 'POST':
                with store.connect() as db:
                    db.execute('DELETE FROM sessions WHERE digest=?', (digest,))
                reply(200, {'ok': True})
            elif path == '/api/account/saves' and method == 'GET':
                revision, bundle = store.snapshot(user['id'])
                reply(200, {'revision': revision, 'bundle': bundle})
            elif path == '/api/account/saves' and method == 'PUT':
                data = read_json(store.max_saves + 1024)
                revision = data.get('revision')
                if type(revision) is not int or revision < 0:
                    raise AccountError(400, 'Invalid save revision')
                reply(200, {'revision': store.put_snapshot(user['id'], revision, data.get('bundle'))})
            elif path == '/api/account/games' and method == 'GET':
                reply(200, {'games': store.library()})
            elif path == '/api/account/game' and method == 'POST':
                data = read_json(8192)
                game = store.game_path(data.get('name', '')) if isinstance(data.get('name'), str) else None
                if game is None:
                    raise AccountError(404, 'Game not found')
                with game.open('rb') as source:
                    handler.send_response(200)
                    handler.send_header('Content-Type', 'application/octet-stream')
                    handler.send_header('Cache-Control', 'no-store')
                    handler.send_header('Content-Length', str(os.fstat(source.fileno()).st_size))
                    handler.end_headers()
                    import shutil
                    shutil.copyfileobj(source, handler.wfile, length=1024 * 1024)
            else:
                raise AccountError(404, 'Unknown account endpoint')
    except AccountError as exc:
        handler.close_connection = True
        reply(exc.status, {'error': exc.message})
    except (sqlite3.Error, OSError):
        handler.close_connection = True
        reply(503, {'error': 'Account storage unavailable'})
    return True
