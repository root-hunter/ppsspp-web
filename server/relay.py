"""Browser Ad Hoc relay v1. PRO control + PU1 datagrams + PT1 streams.

A random per-browser capability binds all data sockets to their control login.
No game data, native sockets, or administrative API are exposed.
"""
import base64
import hashlib
import json
import os
import queue
import re
import secrets
import select
import socket
import socketserver
import ssl
import struct
import threading
import time
import random
from urllib.parse import parse_qs, urlparse
from relay_auth import RelayAuth, AuthError

MAX_PACKET = 65535 + 64
MAX_QUEUE = 1024 * 1024
MAX_CONNECTIONS = int(os.getenv('RELAY_MAX_CONNECTIONS', '512'))
TTL = float(os.getenv('RELAY_TIMEOUT', '60'))
HEARTBEAT_INTERVAL = max(.05, min(15, TTL / 3))
LATENCY = max(0, min(5000, float(os.getenv('RELAY_LATENCY_MS', '0')))) / 1000
JITTER = max(0, min(1000, float(os.getenv('RELAY_JITTER_MS', '0')))) / 1000
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'


def log(event, **fields):
    print(json.dumps(dict(event=event, **fields)), flush=True)


class ProtocolError(Exception):
    pass


class AdhocUser:
    def __init__(self, handler, token, room):
        self.handler, self.token, self.room = handler, token, room
        self.mac = self.name = self.game = b''
        self.group = None
        self.ip = 0
        self.rx = bytearray()

    @property
    def ip_text(self):
        return '10.%d.%d.%d' % ((self.ip >> 16) & 255, (self.ip >> 8) & 255, self.ip & 255)

    @property
    def ip_u32(self):
        return struct.unpack('<I', socket.inet_aton(self.ip_text))[0]

    def send(self, data):
        self.handler.send(data)

    def same_group(self, other):
        return (self.mac and other.mac and self.group is not None and
                (self.room, self.game, self.group) == (other.room, other.game, other.group))


class AdhocLobby:
    def __init__(self):
        self.lock = threading.RLock()
        self.users = {}  # capability -> current control connection
        self.endpoints = set()
        self.udp = {}
        self.listeners = {}
        self.next_ip = 2
        self.next_id = 1
        self.slots = threading.BoundedSemaphore(MAX_CONNECTIONS)

    def add(self, user):
        with self.lock:
            if user.token in self.users:
                raise ProtocolError('capability already connected')
            used = {u.ip for u in self.users.values()}
            while self.next_ip in used:
                self.next_ip = 2 if self.next_ip >= 0xfffffd else self.next_ip + 1
            user.ip = self.next_ip
            self.next_ip = 2 if self.next_ip >= 0xfffffd else self.next_ip + 1
            self.users[user.token] = user

    def remove(self, user):
        with self.lock:
            self.disconnect(user)
            if self.users.get(user.token) is user:
                del self.users[user.token]
            for endpoint in list(self.endpoints):
                if endpoint.owner is user:
                    endpoint.stop()

    def login(self, user, packet):
        with self.lock:
            mac = packet[1:7]
            if user.mac or not any(mac) or mac[0] & 1 or not re.fullmatch(rb'[A-Z0-9]{9}', packet[135:144]):
                raise ProtocolError('invalid or repeated login')
            if any(u.mac == mac and u.room == user.room for u in self.users.values()):
                raise ProtocolError('duplicate MAC in room; use an independent browser profile')
            user.mac, user.name, user.game = mac, packet[7:135], packet[135:144]
            # Transport-only acknowledgement; stripped before reaching PRO HLE.
            user.send(b'PA1' + socket.inet_aton(user.ip_text))
            log('login', game=user.game.decode('ascii'), mac=mac.hex(':'))

    def connect(self, user, group):
        if not user.mac:
            raise ProtocolError('login required')
        if not re.fullmatch(rb'[A-Za-z0-9]*\x00*', group) or len(group) != 8:
            raise ProtocolError('invalid group')
        with self.lock:
            self.disconnect(user)
            user.group = group
            peers = sorted((u for u in self.users.values() if u is not user and u.same_group(user)), key=lambda u: u.ip)
            bssid = peers[0].mac if peers else user.mac
            for peer in peers:
                peer.send(struct.pack('<B128s6sI', 2, user.name, user.mac, user.ip_u32))
                user.send(struct.pack('<B128s6sI', 2, peer.name, peer.mac, peer.ip_u32))
            user.send(struct.pack('<B6s', 6, bssid))
            log('join', game=user.game.decode('ascii'), group=group.rstrip(b'\0').decode('ascii'), peers=len(peers))

    def disconnect(self, user, notify=True):
        with self.lock:
            if user.group is None:
                return
            for peer in self.users.values():
                if peer is not user and user.same_group(peer):
                    peer.send(struct.pack('<BI', 3, user.ip_u32))
            user.group = None
            # No old stream may survive a group change.
            for endpoint in list(self.endpoints):
                if endpoint.owner is user and endpoint.mode.startswith('tcp'):
                    endpoint.stop()

    def scan(self, user):
        if not user.mac:
            raise ProtocolError('login required')
        with self.lock:
            seen = set()
            for peer in sorted(self.users.values(), key=lambda u: u.ip):
                if (peer.room, peer.game) == (user.room, user.game) and peer.group is not None and peer.group not in seen:
                    seen.add(peer.group)
                    user.send(struct.pack('<B8s6s', 4, peer.group, peer.mac))
            user.send(b'\x05')

    def chat(self, user, message):
        with self.lock:
            for peer in self.users.values():
                if peer is not user and user.same_group(peer):
                    peer.send(struct.pack('<B64s128s', 7, message, user.name))

    def owner(self, token, mac):
        user = self.users.get(token)
        if not user or not user.mac or user.mac.hex(':') != mac:
            raise ProtocolError('registered capability and MAC required')
        return user

    def relay_udp(self, source, host, port, payload):
        with self.lock:
            for (token, target_port), target in list(self.udp.items()):
                if target_port != port or not source.owner.same_group(target.owner):
                    continue
                if host == '255.255.255.255':
                    if target.owner is source.owner:
                        continue
                elif target.owner.ip_text != host:
                    continue
                h = source.owner.ip_text.encode('ascii')
                target.send(b'PU1' + bytes([len(h)]) + h + struct.pack('>H', source.port) + payload)

    def connect_tcp(self, source):
        with self.lock:
            target = next((h for h in self.listeners.values() if h.port == source.dstport and
                           h.owner.ip_text == source.dst and source.owner.same_group(h.owner)), None)
            if not target or len(target.peers) >= target.backlog:
                raise ProtocolError('no listener or accept backlog full')
            source.peer = target
            source.conn_id = self.next_id
            self.next_id = self.next_id % 0xffffffff + 1
            target.peers[source.conn_id] = source
            h = source.owner.ip_text.encode('ascii')
            target.send(b'PT1\x01' + struct.pack('>I', source.conn_id) + bytes([len(h)]) + h + struct.pack('>H', source.port))


class AdhocWebSocketHandler(socketserver.BaseRequestHandler):
    lobby = AdhocLobby()

    def setup(self):
        self.alive = True
        self.mode = 'control'
        self.owner = None
        self.user = None
        self.peer = None
        self.peers = {}
        self.conn_id = 0
        self.out = queue.Queue(maxsize=256)
        self.queued_bytes = 0
        self.send_lock = threading.Lock()
        self.reader = getattr(self, 'http_reader', None) or self.request.makefile('rb')
        self.writer = None
        self.fragments = bytearray()
        self.fragmenting = False
        self.close_sent = threading.Event()
        self.request.settimeout(TTL)
        self.request.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

    def stop(self):
        self.alive = False
        try:
            self.out.put_nowait(None)
        except queue.Full:
            pass
        try:
            self.request.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass

    def handle(self):
        if not self.lobby.slots.acquire(blocking=False):
            self.stop()
            return
        try:
            self._handshake()
            self.writer = threading.Thread(target=self._write_loop, daemon=True)
            self.writer.start()
            if self.mode == 'control':
                while self.alive:
                    data = self._read_frame()
                    if data is None:
                        break
                    if len(data) == 11 and data[:3] == b'PR1':
                        self.send(data)
                        continue
                    self.user.rx.extend(data)
                    if len(self.user.rx) > MAX_PACKET:
                        raise ProtocolError('control buffer limit')
                    self._drain_packets()
            else:
                self._data_loop()
        except (ProtocolError, OSError, ValueError, struct.error) as exc:
            log('connection_closed', mode=self.mode, reason=str(exc))
        finally:
            self.stop()
            with self.lobby.lock:
                if self.user:
                    self.lobby.remove(self.user)
                self.lobby.endpoints.discard(self)
                for registry in (self.lobby.udp, self.lobby.listeners):
                    for key, handler in list(registry.items()):
                        if handler is self:
                            del registry[key]
                if self.peer:
                    self.peer.send(b'PT1\x03' + struct.pack('>I', self.conn_id))
                    self.peer.peers.pop(self.conn_id, None)
                for peer in list(self.peers.values()):
                    peer.stop()
                self.peers.clear()
            if self.writer:
                self.writer.join(timeout=2)
            self.lobby.slots.release()

    def finish(self):
        if not getattr(self, 'http_reader', None):
            self.reader.close()

    def _handshake(self):
        if hasattr(self, 'http_headers'):
            headers, path = self.http_headers, self.http_path
        else:
            line = self.reader.readline(4097)
            if len(line) > 4096 or not line.startswith(b'GET '):
                raise ProtocolError('invalid upgrade request')
            path = line.decode('ascii').split(' ')[1]
            headers = {}
            size = len(line)
            while True:
                line = self.reader.readline(4097)
                size += len(line)
                if size > 16384 or not line:
                    raise ProtocolError('upgrade header limit')
                if line == b'\r\n':
                    break
                key, value = line.decode('ascii').split(':', 1)
                headers[key.lower()] = value.strip()
        headers = {k.lower(): v for k, v in headers.items()}
        if (headers.get('upgrade', '').lower() != 'websocket' or headers.get('sec-websocket-version') != '13' or
                'upgrade' not in headers.get('connection', '').lower() or
                'binary' not in [p.strip() for p in headers.get('sec-websocket-protocol', '').split(',')]):
            raise ProtocolError('WebSocket binary subprotocol required')
        key = headers.get('sec-websocket-key', '')
        if len(base64.b64decode(key, validate=True)) != 16:
            raise ProtocolError('invalid WebSocket key')
        parsed = urlparse(path)
        params = parse_qs(parsed.query)
        self.auth = getattr(self.server, 'relay_auth', None) or RelayAuth.from_env()
        try:
            self.key_id = self.auth.authorize(params)
        except AuthError as exc:
            self.request.sendall(b'HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
            raise ProtocolError(str(exc)) from exc
        token = params.get('token', [''])[0]
        if params.get('v') != ['1'] or not re.fullmatch('[a-f0-9]{32}', token):
            raise ProtocolError('relay v1 capability required')
        route = parsed.path.removeprefix('/adhoc').rstrip('/')
        with self.lobby.lock:
            if route == '':
                room = params.get('room', ['public'])[0]
                if not re.fullmatch('[A-Za-z0-9_-]{1,32}', room):
                    raise ProtocolError('invalid room')
                self.user = AdhocUser(self, token, room)
                self.user.key_id = self.key_id
                self.lobby.add(self.user)
            elif route in ('/udp', '/tcp-listen', '/tcp-connect'):
                self.mode = route[1:]
                self.owner = self.lobby.owner(token, params.get('mac', [''])[0])
                if self.owner.key_id != self.key_id:
                    raise ProtocolError('data credential must match control credential')
                self.port = int(params.get('port', ['0'])[0])
                if not 0 < self.port < 65536:
                    raise ProtocolError('invalid port')
                self.lobby.endpoints.add(self)
                if self.mode in ('udp', 'tcp-listen'):
                    registry = self.lobby.udp if self.mode == 'udp' else self.lobby.listeners
                    endpoint = (token, self.port)
                    if endpoint in registry:
                        raise ProtocolError('port already bound')
                    self.backlog = min(64, max(1, int(params.get('backlog', ['16'])[0])))
                    registry[endpoint] = self
                else:
                    self.dst = params.get('dst', [''])[0]
                    self.dstport = int(params.get('dstport', ['0'])[0])
                    self.lobby.connect_tcp(self)
            else:
                raise ProtocolError('unknown relay endpoint')
        accept = base64.b64encode(hashlib.sha1((key + GUID).encode('ascii')).digest()).decode('ascii')
        self.request.sendall(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                              f'Sec-WebSocket-Accept: {accept}\r\nSec-WebSocket-Protocol: binary\r\n\r\n').encode('ascii'))

    def _read_exact(self, length):
        # The HTTP upgrade reuses its reader. A read may be short, or return
        # None on temporary EAGAIN; neither means that the frame has ended.
        data = bytearray()
        deadline = time.monotonic() + TTL
        while len(data) < length:
            if not self.alive:
                raise ProtocolError('connection stopped')
            chunk = self.reader.read(length - len(data))
            if chunk is None:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError('frame read timed out')
                # Bound the wait so shutdown is observed even without data.
                select.select([self.request], [], [], min(.1, remaining))
                continue
            if not chunk:
                raise ProtocolError('truncated frame')
            data.extend(chunk)
            deadline = time.monotonic() + TTL
        return bytes(data)

    def _read_frame(self):
        header = self._read_exact(2)
        opcode, size = header[0] & 15, header[1] & 127
        final = bool(header[0] & 0x80)
        if header[0] & 0x70 or not header[1] & 0x80 or (opcode >= 8 and not final):
            raise ProtocolError('invalid WebSocket flags or unmasked frame')
        if size == 126:
            size = struct.unpack('>H', self._read_exact(2))[0]
        elif size == 127:
            size = struct.unpack('>Q', self._read_exact(8))[0]
        if size > MAX_PACKET or (opcode >= 8 and size > 125):
            raise ProtocolError('frame size limit')
        mask = self._read_exact(4)
        data = self._read_exact(size)
        data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        if opcode == 8:
            if len(data) == 1:
                raise ProtocolError('invalid close frame')
            self.send(data, opcode=8)
            self.close_sent.wait(timeout=1)
            return None
        if opcode == 9:
            self.send(data, opcode=10)
            return b''
        if opcode == 10:
            return b''
        if opcode == 2:
            if self.fragmenting:
                raise ProtocolError('new message during fragmented message')
            if final:
                return data
            self.fragmenting = True
        elif opcode != 0 or not self.fragmenting:
            raise ProtocolError('binary message or valid continuation required')
        if len(self.fragments) + len(data) > MAX_PACKET:
            raise ProtocolError('fragmented message limit')
        self.fragments.extend(data)
        if final:
            data = bytes(self.fragments)
            self.fragments.clear()
            self.fragmenting = False
            return data
        return b''

    @staticmethod
    def _frame(data, opcode=2):
        size = len(data)
        if size < 126:
            return bytes([128 | opcode, size]) + data
        if size < 65536:
            return bytes([128 | opcode, 126]) + struct.pack('>H', size) + data
        return bytes([128 | opcode, 127]) + struct.pack('>Q', size) + data

    def send(self, data, opcode=2):
        if not self.alive:
            return
        with self.send_lock:
            if self.queued_bytes + len(data) > MAX_QUEUE:
                self.stop()
                return
            try:
                delay = max(0, LATENCY + random.uniform(-JITTER, JITTER)) if opcode == 2 else 0
                self.out.put_nowait((time.monotonic() + delay, data, opcode))
                self.queued_bytes += len(data)
            except queue.Full:
                self.stop()

    def _write_loop(self):
        # A receiving-only PDP socket can have continuous outbound traffic and
        # no client data. Ping by elapsed time, not by queue inactivity, so its
        # incoming pong refreshes the read deadline even during busy forwarding.
        next_ping = time.monotonic() + HEARTBEAT_INTERVAL
        try:
            while self.alive:
                if not self.auth.active(self.key_id):
                    log('access_revoked', key_id=self.key_id)
                    self.stop()
                    return
                now = time.monotonic()
                if now >= next_ping:
                    self.request.sendall(self._frame(secrets.token_bytes(4), 9))
                    next_ping = now + HEARTBEAT_INTERVAL
                try:
                    item = self.out.get(timeout=max(.001, min(1, next_ping - time.monotonic())))
                    if item is None:
                        return
                    due, data, opcode = item
                except queue.Empty:
                    continue
                delay = due - time.monotonic()
                while delay > 0:
                    time.sleep(min(1, delay))
                    if not self.alive or not self.auth.active(self.key_id):
                        self.stop()
                        return
                    delay = due - time.monotonic()
                self.request.sendall(self._frame(data, opcode))
                if opcode == 8:
                    self.close_sent.set()
                with self.send_lock:
                    self.queued_bytes -= len(data)
        except OSError:
            self.stop()

    def _data_loop(self):
        while self.alive:
            data = self._read_frame()
            if data is None:
                return
            if not data:  # WebSocket heartbeat
                continue
            if self.mode == 'udp':
                if len(data) < 7 or data[:3] != b'PU1':
                    raise ProtocolError('invalid datagram version')
                n = data[3]
                if n < 7 or n > 15 or len(data) < n + 6:
                    raise ProtocolError('invalid datagram header')
                host = data[4:4+n].decode('ascii')
                socket.inet_aton(host)
                port = struct.unpack('>H', data[4+n:6+n])[0]
                if not port or len(data) - n - 6 > 65535:
                    raise ProtocolError('invalid datagram port/length')
                self.lobby.relay_udp(self, host, port, data[6+n:])
            elif self.mode == 'tcp-connect':
                if len(data) > 65535:
                    raise ProtocolError('stream packet limit')
                if not self.owner.same_group(self.peer.owner):
                    raise ProtocolError('stream group changed')
                self.peer.send(b'PT1\x02' + struct.pack('>I', self.conn_id) + data)
            else:
                if len(data) < 8 or data[:3] != b'PT1' or data[3] not in (2, 3):
                    raise ProtocolError('invalid stream frame')
                conn_id = struct.unpack('>I', data[4:8])[0]
                with self.lobby.lock:
                    peer = self.peers.get(conn_id)
                    if peer and self.owner.same_group(peer.owner):
                        if data[3] == 2:
                            peer.send(data[8:])
                        else:
                            peer.stop()

    def _drain_packets(self):
        sizes = {0: 1, 1: 144, 2: 9, 3: 1, 4: 1, 7: 65}
        rx = self.user.rx
        while rx:
            opcode = rx[0]
            if opcode not in sizes or (opcode != 1 and not self.user.mac):
                raise ProtocolError('invalid control opcode or login required')
            size = sizes[opcode]
            if len(rx) < size:
                return
            data = bytes(rx[:size])
            del rx[:size]
            if opcode == 1:
                self.lobby.login(self.user, data)
            elif opcode == 2:
                self.lobby.connect(self.user, data[1:])
            elif opcode == 3:
                self.lobby.disconnect(self.user)
            elif opcode == 4:
                self.lobby.scan(self.user)
            elif opcode == 7:
                self.lobby.chat(self.user, data[1:])


class TrackedServerMixin:
    """Close even incomplete upgrades and join handlers during shutdown."""
    daemon_threads = False
    block_on_close = True

    def __init__(self, *args, **kwargs):
        self.active_requests = set()
        self.active_lock = threading.Lock()
        super().__init__(*args, **kwargs)

    def process_request(self, request, client_address):
        with self.active_lock:
            if len(self.active_requests) >= MAX_CONNECTIONS:
                self.shutdown_request(request)
                return
            self.active_requests.add(request)
        request.settimeout(TTL)
        try:
            super().process_request(request, client_address)
        except Exception:
            with self.active_lock:
                self.active_requests.discard(request)
            raise

    def process_request_thread(self, request, client_address):
        try:
            if isinstance(request, ssl.SSLSocket):
                request.do_handshake()
            super().process_request_thread(request, client_address)
        except OSError:
            self.shutdown_request(request)
        finally:
            with self.active_lock:
                self.active_requests.discard(request)

    def server_close(self):
        with self.active_lock:
            for request in self.active_requests:
                try:
                    request.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
        super().server_close()


class ThreadingAdhocWebSocketServer(TrackedServerMixin, socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    request_queue_size = 64
