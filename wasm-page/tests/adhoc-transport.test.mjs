import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
const source = readFileSync(new URL('../public/adhoc-transport.js', import.meta.url), 'utf8');
function setup(sessionKey = "") {
  const sockets = [];
  class WS {
    static OPEN = 1; static CONNECTING = 0; static CLOSED = 3; static CLOSING = 2;
    constructor(url) { this.url = url; this.readyState = 0; this.bufferedAmount = 0; this.sent = []; sockets.push(this); }
    send(data) { this.sent.push(new Uint8Array(data)); }
    close() { if (this.readyState === 3) return; this.readyState = 3; this.onclose?.(); }
    open() { this.readyState = 1; this.onopen?.(); }
    receive(data) { this.onmessage?.({ data: new Uint8Array(data).buffer }); }
  }
  const events = [];
  const original = { calls: 0 };
  const ops = Object.fromEntries(['bind', 'connect', 'listen', 'accept', 'getname', 'poll', 'sendmsg', 'recvmsg', 'close'].map(k => [k, () => { original.calls++; return 'original'; }]));
  let nextFd = 10;
  const closedStreams = [];
  const SOCKFS = { websocket_sock_ops: ops, emit: (...e) => events.push(e), createSocket: (family, type, protocol) => {
    const sock = { family, type, protocol, stream: { fd: nextFd++, flags: 0 }, pending: [], recv_queue: [], __ppssppAdhoc: true };
    sock.stream.node = { sock };
    return sock;
  } };
  const close = stream => { closedStreams.push(stream.fd); ops.close(stream.node.sock); };
  class ErrnoError extends Error { constructor(errno) { super(String(errno)); this.errno = errno; } }
  const ctx = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView, URL, URLSearchParams, crypto: webcrypto,
    performance, WebSocket: WS, location: { href: 'https://example.test/', protocol: 'https:' }, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {} });
  vm.runInContext(source, ctx);
  const api = ctx.PPSSPPAdhoc.install({ SOCKFS, FS: { ErrnoError, close }, config: { enabled: true, endpoint: 'wss://relay.test/adhoc', mac: '02:00:00:00:00:01', room: 'test', sessionKey } });
  const sock = type => SOCKFS.createSocket(2, type, 0);
  function control() {
    const c = sock(1); c.__ppssppControl = true;
    assert.throws(() => ops.connect(c, '172.1.1.1', 27312), e => e.errno === 26);
    sockets[0].open(); sockets[0].receive([80, 65, 49, 10, 0, 0, 2]);
    return c;
  }
  return { ctx, api, ops, sockets, sock, control, original, events, closedStreams };
}
test('binary datagram codec preserves endpoint, zero bytes and boundaries', () => {
  const { ctx } = setup();
  const p = ctx.PPSSPPAdhoc.datagram('10.0.0.3', 65535, new Uint8Array([0, 255, 0]));
  assert.equal(new TextDecoder().decode(p.subarray(0, 3)), 'PU1');
  assert.equal(new TextDecoder().decode(p.subarray(4, 4+p[3])), '10.0.0.3');
  assert.equal(new DataView(p.buffer).getUint16(4+p[3]), 65535);
  assert.deepEqual([...p.subarray(6+p[3])], [0, 255, 0]);
  const s = ctx.PPSSPPAdhoc.stream(2, 0xfedcba98, new Uint8Array([42]));
  assert.equal(new DataView(s.buffer).getUint32(4), 0xfedcba98);
  assert.equal(s[8], 42);
});
test('WSS endpoint validation retains proxy path and custom port', () => {
  const { ctx } = setup();
  assert.equal(ctx.PPSSPPAdhoc.endpoint('https://relay.test:4443/psp/').href, 'wss://relay.test:4443/psp');
  for (const value of ['ws://relay.test', 'https://a:b@relay.test', 'ftp://relay.test', 'wss://relay.test/?token=bad']) assert.throws(() => ctx.PPSSPPAdhoc.endpoint(value));
});
test('transport does not intercept unrelated native socket services', () => {
  const { ops, sock, original } = setup();
  const s = sock(1); delete s.__ppssppAdhoc;
  assert.equal(ops.connect(s, 'other.test', 443), 'original');
  assert.equal(ops.close(s), 'original'); assert.equal(original.calls, 2);
});
test('control gets its own WSS route and PA1 is hidden from the HLE', () => {
  const { control, sockets, api } = setup(); const c = control();
  assert.equal(new URL(sockets[0].url).pathname, '/adhoc');
  assert.equal(c.saddr, '10.0.0.2'); assert.equal(c.recv_queue.length, 0);
  assert.equal(api.snapshot().state, 'registered');
});
test('PDP send/receive are nonblocking and report backpressure', () => {
  const { control, sockets, ops, sock } = setup(); control();
  const s = sock(2); ops.bind(s, '0.0.0.0', 3000);
  assert.throws(() => ops.recvmsg(s, 12, 0), e => e.errno === 6);
  assert.throws(() => ops.sendmsg(s, new Uint8Array([1]), 0, 1, '10.0.0.3', 3000), e => e.errno === 6);
  sockets[1].open();
  assert.equal(ops.sendmsg(s, new Uint8Array([1]), 0, 1, '10.0.0.3', 3000), 1);
  sockets[1].bufferedAmount = 1024*1024;
  assert.throws(() => ops.sendmsg(s, new Uint8Array([1]), 0, 1, '10.0.0.3', 3000), e => e.errno === 6);
  assert.equal(sockets[1].sent.length, 1);
});
test('PDP receive preserves datagrams and fails closed on bounded queue overflow', () => {
  const { control, ctx, sockets, ops, sock, api } = setup(); control();
  const s = sock(2); ops.bind(s, '0.0.0.0', 3000); sockets[1].open();
  const p = ctx.PPSSPPAdhoc.datagram('10.0.0.3', 3000, new Uint8Array([4,5]));
  sockets[1].receive(p); sockets[1].receive(p);
  assert.equal(s.recv_queue.length, 2); assert.deepEqual([...s.recv_queue[0].data], [4,5]);
  for (let i = 0; i < 255; i++) sockets[1].receive(p);
  assert.equal(sockets[1].readyState, 3); assert.ok(api.snapshot().errors > 0);
});
test('control disconnection closes data endpoints and propagates errors', () => {
  const { control, sockets, ops, sock, api } = setup(); control();
  const s = sock(2); ops.bind(s, '0.0.0.0', 3000); sockets[1].open();
  sockets[0].close(); assert.equal(sockets[1].readyState, 3);
  assert.equal(api.snapshot().state, 'disconnected');
  assert.throws(() => ops.recvmsg(s, 1, 0));
});

test('session key accompanies control and data sockets without replacing capability', () => {
  const { control, sockets, ops, sock } = setup('secret-key');
  control();
  ops.bind(sock(2), '0.0.0.0', 3000);
  assert.equal(sockets.length, 2);
  for (const socket of sockets) {
    const url = new URL(socket.url);
    assert.equal(url.searchParams.get('session_key'), 'secret-key');
    assert.match(url.searchParams.get('token'), /^[a-f0-9]{32}$/);
  }
  assert.equal(new URL(sockets[0].url).searchParams.get('token'), new URL(sockets[1].url).searchParams.get('token'));
});

// Reproduce MHFU's accept -> close(listening fd) -> use accepted stream.
function ptpListener() {
  const env = setup();
  const controlSocket = env.control();
  const listener = env.sock(1);
  env.ops.bind(listener, '0.0.0.0', 30001);
  env.ops.listen(listener, 3);
  const ws = env.sockets[1]; ws.open();
  function incoming(id) {
    const host = new TextEncoder().encode('10.0.0.3');
    const payload = new Uint8Array(host.length + 3);
    payload[0] = host.length; payload.set(host, 1);
    new DataView(payload.buffer).setUint16(host.length + 1, 30002);
    ws.receive(env.ctx.PPSSPPAdhoc.stream(1, id, payload));
    return listener.__accepted.get(id);
  }
  function remoteClose(id) { ws.receive(env.ctx.PPSSPPAdhoc.stream(3, id)); }
  return { ...env, controlSocket, listener, ws, incoming, remoteClose };
}

test('closing a PTP listener preserves bidirectional traffic on accepted streams', () => {
  const { ops, listener, ws, incoming, ctx, api, closedStreams } = ptpListener();
  const child = incoming(1);
  assert.equal(ops.accept(listener), child);
  assert.equal(ops.close(listener), 0);
  assert.equal(ws.readyState, 1);
  assert.equal(child.__closed, false);
  assert.equal(ops.poll(child), 4);
  assert.equal(ops.getname(child, true).addr, '10.0.0.3');
  assert.throws(() => ops.recvmsg(child, 1, 0), e => e.errno === 6);
  const data = new Uint8Array([1, 0, 255]);
  assert.equal(ops.sendmsg(child, data, 0, data.length), 3);
  assert.deepEqual([...ws.sent[0]], [...ctx.PPSSPPAdhoc.stream(2, 1, data)]);
  ws.receive(ctx.PPSSPPAdhoc.stream(2, 1, data));
  assert.deepEqual([...child.recv_queue[0].data], [...data]);
  assert.equal(ops.poll(child), 69);
  assert.equal(api.snapshot().errors, 0);
  ops.close(child);
  assert.equal(ws.readyState, 3);
  assert.equal(api.snapshot().ptp.length, 0);
});

test('closed listener rejects pending and late connections without closing accepted peers', () => {
  const { ops, listener, ws, incoming, ctx, api, closedStreams } = ptpListener();
  const accepted = incoming(1); ops.accept(listener);
  const pending = incoming(2);
  ops.close(listener);
  assert.equal(pending.__closed, true);
  assert.deepEqual(closedStreams, [pending.stream.fd]);
  assert.equal(listener.pending.length, 0);
  assert.equal(listener.__accepted.size, 1);
  assert.deepEqual([...ws.sent[0]], [...ctx.PPSSPPAdhoc.stream(3, 2)]);
  assert.equal(incoming(3), undefined);
  assert.deepEqual([...ws.sent[1]], [...ctx.PPSSPPAdhoc.stream(3, 3)]);
  assert.equal(ws.readyState, 1);
  ops.close(listener); // Repeated cleanup must preserve the accepted peer.
  assert.equal(ws.readyState, 1);
  assert.equal(accepted.__closed, false);
  ops.close(accepted); ops.close(accepted);
  assert.equal(ws.sent.length, 3);
  assert.equal(api.snapshot().ptp.length, 0);
});

for (const pending of [false, true]) test(`listener with no accepted peers closes immediately (pending=${pending})`, () => {
  const { ops, listener, ws, incoming, api } = ptpListener();
  if (pending) incoming(1);
  ops.close(listener);
  assert.equal(ws.readyState, 3);
  assert.equal(listener.pending.length, 0);
  assert.equal(api.snapshot().ptp.length, 0);
});

for (const remote of [false, true]) test(`shared PTP WebSocket closes after the last peer (remote=${remote})`, () => {
  const { ops, listener, ws, incoming, remoteClose, api } = ptpListener();
  const first = incoming(1); ops.accept(listener);
  const last = incoming(2); ops.accept(listener);
  ops.close(listener);
  if (remote) remoteClose(1); else ops.close(first);
  assert.equal(ws.readyState, 1);
  assert.equal(last.__closed, false);
  if (remote) remoteClose(2); else ops.close(last);
  assert.equal(ws.readyState, 3);
  assert.equal(ops.recvmsg(last, 1, 0), null);
  ops.close(first); ops.close(last);
  assert.equal(api.snapshot().ptp.length, 0);
});

for (const action of ['disconnect', 'destroy', 'control-close', 'control-loss', 'listener-loss']) {
  test(`${action} tears down a retained listener and its accepted streams`, () => {
    const { ops, listener, ws, incoming, api, sockets, controlSocket } = ptpListener();
    const child = incoming(1); ops.accept(listener); ops.close(listener);
    if (action === 'control-close') ops.close(controlSocket);
    else if (action === 'control-loss') sockets[0].close();
    else if (action === 'listener-loss') ws.close();
    else api[action]();
    assert.equal(ws.readyState, 3);
    assert.equal(child.__closed, true);
    if (action !== 'destroy') {
      assert.equal(ops.recvmsg(child, 1, 0), null);
      assert.equal(ops.poll(child) & 16, 16);
    } else assert.equal(ops.close(child), 'original');
    api.disconnect();
    assert.equal(api.snapshot().ptp.length, 0);
  });
}


test('deferred listener close does not notify a recycled listening fd', () => {
  const { ops, listener, ws, incoming, events } = ptpListener();
  const child = incoming(1); ops.accept(listener); ops.close(listener);
  events.length = 0;
  ops.close(child);
  assert.equal(ws.readyState, 3);
  assert.equal(events.some(([name, fd]) => name === 'close' && fd === listener.stream.fd), false);
});

for (const action of ['remote-close', 'listener-loss']) test(`${action} releases unaccepted socket descriptors`, () => {
  const { ws, incoming, remoteClose, closedStreams, api } = ptpListener();
  const pending = incoming(1);
  if (action === 'remote-close') remoteClose(1); else ws.close();
  assert.deepEqual(closedStreams, [pending.stream.fd]);
  assert.equal(api.snapshot().ptp.some(s => s.peer === '10.0.0.3'), false);
});
