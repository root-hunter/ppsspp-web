/* Browser transport for the existing PPSSPP Ad Hoc HLE socket operations.
 * Only Ad Hoc sockets are routed; PSP matching and blocking-call scheduling
 * remain in the emulator. Socket syscalls from pthreads are proxied by Emscripten.
 */
(() => {
  'use strict';
  const LIMIT = 1024 * 1024;
  const MAX_PACKET = 65535;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  function token() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  }
  function endpoint(value) {
    const url = new URL(value || '/adhoc', location.href);
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol === 'https:') url.protocol = 'wss:';
    if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
        (location.protocol === 'https:' && url.protocol !== 'wss:')) throw new Error('Use a WSS relay URL (WS is allowed on local HTTP).');
    url.pathname = url.pathname.replace(/\/$/, '');
    return url;
  }
  function datagram(host, port, payload) {
    const h = encoder.encode(host);
    const out = new Uint8Array(6 + h.length + payload.length);
    out.set([80, 85, 49, h.length]); out.set(h, 4);
    new DataView(out.buffer).setUint16(4 + h.length, port);
    out.set(payload, 6 + h.length);
    return out;
  }
  function stream(kind, id, payload = new Uint8Array()) {
    const out = new Uint8Array(8 + payload.length);
    out.set([80, 84, 49, kind]); new DataView(out.buffer).setUint32(4, id); out.set(payload, 8);
    return out;
  }
  function install({ SOCKFS, FS, config, onstatus = () => {} }) {
    if (!SOCKFS?.websocket_sock_ops) throw new Error('Build does not export SOCKFS');
    const ops = SOCKFS.websocket_sock_ops;
    if (ops.__ppssppRelayInstalled) return ops.__ppssppRelayInstalled;
    const original = Object.fromEntries(Object.entries(ops).filter(([, v]) => typeof v === 'function').map(([k, v]) => [k, v.bind(ops)]));
    const cfg = { ...config };
    const capability = token();
    const sockets = new Set();
    const peers = new Map();
    let localIP = '10.255.255.254';
    let control = null;
    let registered = false;
    let ephemeral = 49152;
    let timer = null;
    const stats = { state: 'idle', game: '', group: '', mac: cfg.mac, room: cfg.room, peers: [], pdpSent: 0, pdpReceived: 0,
      ptpSent: 0, ptpReceived: 0, ptpConnections: 0, rttMs: null, queueBytes: 0, errors: 0, lastError: '' };
    const fail = (sock, message, errno = 53) => {
      sock.error = errno; stats.errors++; stats.lastError = message;
      if (sock === control) { registered = false; stats.state = 'disconnected'; }
      SOCKFS.emit('error', [sock.stream.fd, errno, message]); publish();
    };
    function publish() {
      stats.peers = [...peers.values()];
      stats.ptp = [...sockets].filter(s => s.type === 1 && s !== control).map(s => ({
        port: s.sport, peer: s.daddr || null, peerPort: s.dport || null,
        state: s.__closed ? 'closed' : s.server ? 'listening' : s.connecting ? 'connecting' : s.__parent || s.__relay?.ws?.readyState === WebSocket.OPEN ? 'connected' : 'waiting',
      }));
      stats.queueDepth = [...sockets].reduce((n, s) => n + s.recv_queue.length, 0);
      stats.queueBytes = [...sockets].reduce((n, s) => n + (s.__relay?.ws?.bufferedAmount || 0) +
        s.recv_queue.reduce((m, p) => m + p.data.byteLength, 0), 0);
      onstatus({ ...stats });
    }
    function url(path, params = {}) {
      const result = endpoint(cfg.endpoint);
      result.pathname += path;
      result.search = new URLSearchParams({ v: '1', token: capability, room: cfg.room || 'public', ...(cfg.sessionKey ? { session_key: cfg.sessionKey } : {}), ...params }).toString();
      return result.href;
    }
    function allocate(sock, port = 0) {
      if (!port) {
        for (let i = 0; i < 16384; i++) {
          ephemeral = 49152 + ((ephemeral + 1 - 49152) % 16384);
          if (![...sockets].some(s => s !== sock && s.type === sock.type && s.sport === ephemeral)) { port = ephemeral; break; }
        }
      }
      if (!port || sock.type === 2 && [...sockets].some(s => s !== sock && s.type === sock.type && s.sport === port)) throw new FS.ErrnoError(3); // EADDRINUSE
      sock.saddr = localIP; sock.sport = port; sockets.add(sock);
    }
    function receive(sock, data, addr, port) {
      const bytes = sock.recv_queue.reduce((sum, p) => sum + p.data.byteLength, 0);
      if (bytes + data.length > LIMIT || sock.recv_queue.length >= 256) {
        fail(sock, 'Receive queue limit reached', 42); sock.__relay?.ws?.close(); return;
      }
      sock.recv_queue.push({ addr, port, data });
      SOCKFS.emit('message', sock.stream.fd);
    }
    function safeSend(sock, ws, data) {
      if (!ws || ws.readyState !== WebSocket.OPEN) throw new FS.ErrnoError(sock.error || 6); // EAGAIN
      if (ws.bufferedAmount + data.byteLength > LIMIT) throw new FS.ErrnoError(6);
      try { ws.send(data); } catch (e) { fail(sock, e.message); throw new FS.ErrnoError(53); }
    }
    function open(sock, path, params, message, opened = () => {}) {
      const ws = new WebSocket(url(path, params), 'binary');
      ws.binaryType = 'arraybuffer';
      sock.__relay = { ws, path, pending: false };
      const timeout = setTimeout(() => { fail(sock, 'Relay connection timeout', 73); ws.close(); }, 10000);
      ws.onopen = () => { clearTimeout(timeout); sock.connecting = false; opened(ws); SOCKFS.emit('open', sock.stream.fd); publish(); };
      ws.onmessage = e => {
        if (!(e.data instanceof ArrayBuffer) || e.data.byteLength > MAX_PACKET + 64) {
          fail(sock, 'Invalid relay frame'); ws.close(); return;
        }
        try { message(new Uint8Array(e.data)); } catch (error) { fail(sock, error.message); ws.close(); }
      };
      ws.onerror = () => fail(sock, 'Relay connection or protocol rejected', 14);
      ws.onclose = () => {
        clearTimeout(timeout); sock.connecting = false;
        if (sock === control) {
          registered = false; stats.state = 'disconnected'; peers.clear();
          for (const other of sockets) if (other !== control) other.__relay?.ws?.close();
        }
        if (sock.__accepted) {
          for (const s of sock.__accepted.values()) { s.__closed = true; SOCKFS.emit('close', s.stream.fd); }
          sock.__accepted.clear();
        }
        if (!sock.__closed) fail(sock, 'Relay disconnected');
        SOCKFS.emit('close', sock.stream.fd); publish();
      };
      return ws;
    }
    function openData(sock) {
      if (!registered || sock.__relay?.ws || sock.__closed) return;
      if (sock.type === 2) {
        open(sock, '/udp', { mac: cfg.mac, port: sock.sport }, data => {
          if (decoder.decode(data.subarray(0, 3)) !== 'PU1') throw new Error('Unsupported PDP protocol');
          const n = data[3]; if (n < 7 || n > 15 || data.length < n + 6) throw new Error('Truncated PDP packet');
          const host = decoder.decode(data.subarray(4, n + 4));
          const port = new DataView(data.buffer, data.byteOffset).getUint16(n + 4);
          receive(sock, data.subarray(n + 6), host, port); stats.pdpReceived++;
        });
      } else if (sock.server) {
        open(sock, '/tcp-listen', { mac: cfg.mac, port: sock.sport, backlog: sock.__backlog }, data => {
          if (decoder.decode(data.subarray(0, 3)) !== 'PT1' || data.length < 8) throw new Error('Unsupported PTP protocol');
          const id = new DataView(data.buffer, data.byteOffset).getUint32(4);
          if (data[3] === 1) {
            const n = data[8]; if (n < 7 || n > 15 || data.length !== n + 11) throw new Error('Invalid PTP open');
            if (sock.pending.length >= sock.__backlog) { safeSend(sock, sock.__relay.ws, stream(3, id)); return; }
            const child = SOCKFS.createSocket(sock.family, sock.type, sock.protocol);
            child.__ppssppAdhoc = true;
            child.saddr = localIP; child.sport = sock.sport;
            child.daddr = decoder.decode(data.subarray(9, n + 9));
            child.dport = new DataView(data.buffer, data.byteOffset).getUint16(n + 9);
            child.__parent = sock; child.__connId = id; child.__closed = false;
            child.stream.flags = sock.stream.flags;
            sockets.add(child); sock.__accepted.set(id, child); sock.pending.push(child);
            stats.ptpConnections++; SOCKFS.emit('connection', child.stream.fd);
          } else if (data[3] === 2) {
            const child = sock.__accepted.get(id);
            if (child) { receive(child, data.subarray(8), child.daddr, child.dport); stats.ptpReceived += data.length - 8; }
          } else if (data[3] === 3) {
            const child = sock.__accepted.get(id);
            if (child) { child.__closed = true; sock.pending = sock.pending.filter(s => s !== child); SOCKFS.emit('close', child.stream.fd); sock.__accepted.delete(id); }
          } else throw new Error('Invalid PTP operation');
        });
      } else if (sock.daddr) {
        open(sock, '/tcp-connect', { mac: cfg.mac, port: sock.sport, dst: sock.daddr, dstport: sock.dport }, data => {
          receive(sock, data, sock.daddr, sock.dport); stats.ptpReceived += data.length;
        }, () => stats.ptpConnections++);
      }
    }
    let controlRx = new Uint8Array();
    function controlMessage(data) {
      if (data.length === 11 && decoder.decode(data.subarray(0, 3)) === 'PR1') {
        stats.rttMs = Math.round((performance.now() - new DataView(data.buffer, data.byteOffset).getFloat64(3)) * 100) / 100; return;
      }
      if (data.length === 7 && decoder.decode(data.subarray(0, 3)) === 'PA1') {
        localIP = [...data.subarray(3)].join('.'); control.saddr = localIP; registered = true; stats.state = 'registered';
        for (const sock of sockets) { sock.saddr = localIP; if (sock !== control) openData(sock); }
        publish(); return;
      }
      // Observe actual PRO notifications without changing the HLE stream.
      const joined = new Uint8Array(controlRx.length + data.length); joined.set(controlRx); joined.set(data, controlRx.length);
      controlRx = joined;
      const sizes = { 0: 1, 2: 139, 3: 5, 4: 15, 5: 1, 6: 7, 7: 193 };
      while (controlRx.length) {
        const size = sizes[controlRx[0]];
        if (!size) throw new Error('Unknown PRO notification');
        if (controlRx.length < size) break;
        const p = controlRx.subarray(0, size);
        if (p[0] === 2) {
          const ip = [...p.subarray(135, 139)].join('.');
          peers.set(ip, { ip, nick: decoder.decode(p.subarray(1, 129)).replace(/\0.*$/s, ''), mac: [...p.subarray(129, 135)].map(b => b.toString(16).padStart(2, '0')).join(':') });
        } else if (p[0] === 3) peers.delete([...p.subarray(1, 5)].join('.'));
        controlRx = controlRx.slice(size);
      }
      receive(control, data, control.daddr, control.dport); publish();
    }
    ops.bind = function(sock, addr, port) {
      if (!cfg.enabled || !sock.__ppssppAdhoc) return original.bind(sock, addr, port);
      if (sock.sport !== undefined) throw new FS.ErrnoError(28);
      allocate(sock, port);
      if (sock.type === 2) openData(sock);
    };
    ops.connect = function(sock, addr, port) {
      if (!cfg.enabled || !sock.__ppssppAdhoc) return original.connect(sock, addr, port);
      if (sock.server) throw new FS.ErrnoError(138);
      if (sock.daddr !== undefined) throw new FS.ErrnoError(sock.connecting ? 7 : 30);
      if (!sock.sport) allocate(sock);
      sock.daddr = addr; sock.dport = port;
      if (sock.type === 2) { openData(sock); return; }
      sock.connecting = true;
      // Port 27312 is the HLE PRO lobby, never a game PTP endpoint.
      if (sock.__ppssppControl) {
        if (control) throw new FS.ErrnoError(7);
        control = sock; controlRx = new Uint8Array(); stats.lastError = ''; stats.state = 'connecting';
        open(sock, '', {}, controlMessage);
      } else openData(sock);
      publish();
      // The caller must wait for poll/select to report completion.
      throw new FS.ErrnoError(26); // EINPROGRESS
    };
    ops.listen = function(sock, backlog) {
      if (!cfg.enabled || !sock.__ppssppAdhoc) return original.listen(sock, backlog);
      if (sock.type !== 1) throw new FS.ErrnoError(138);
      if (sock.server) throw new FS.ErrnoError(28);
      if (!sock.sport) allocate(sock);
      sock.__backlog = Math.max(1, Math.min(64, backlog)); sock.__accepted = new Map();
      sock.server = { close() { sock.__relay?.ws?.close(); } };
      openData(sock);
    };
    ops.accept = function(sock) {
      if (!cfg.enabled || !sock.__ppssppAdhoc) return original.accept(sock);
      if (!sock.server) throw new FS.ErrnoError(28);
      if (!sock.pending.length) throw new FS.ErrnoError(6);
      return sock.pending.shift();
    };
    ops.getname = function(sock, peer) {
      if (!cfg.enabled || !sock.__ppssppAdhoc) return original.getname(sock, peer);
      if (peer && (sock.daddr === undefined || sock.connecting || sock.__closed || sock.__relay?.ws?.readyState !== WebSocket.OPEN && !sock.__parent && sock.type === 1)) throw new FS.ErrnoError(53);
      return peer ? { addr: sock.daddr, port: sock.dport } : { addr: sock.saddr || localIP, port: sock.sport || 0 };
    };
    ops.poll = function(sock) {
      if (!cfg.enabled || !sock.__ppssppAdhoc) return original.poll(sock);
      if (sock.error) return 8 | 16 | 1 | (sock.connecting ? 4 : 0); // POLLERR | POLLHUP | POLLIN
      if (sock.server) return sock.pending.length ? 65 : 0;
      let mask = sock.recv_queue.length ? 65 : 0;
      const ws = sock.__parent?.__relay?.ws || sock.__relay?.ws;
      if (sock.__closed || ws?.readyState === WebSocket.CLOSED || ws?.readyState === WebSocket.CLOSING) mask |= 16 | 65;
      if (!sock.__closed && ws?.readyState === WebSocket.OPEN && ws.bufferedAmount < LIMIT) mask |= 4;
      return mask;
    };
    ops.sendmsg = function(sock, buffer, offset, length, addr, port) {
      if (!cfg.enabled || !sock.__ppssppAdhoc) return original.sendmsg(sock, buffer, offset, length, addr, port);
      if (sock.error || sock.__closed) throw new FS.ErrnoError(sock.error || 53);
      if (length > MAX_PACKET) throw new FS.ErrnoError(35);
      const view = ArrayBuffer.isView(buffer) ? new Uint8Array(buffer.buffer, buffer.byteOffset + offset, length) : new Uint8Array(buffer, offset, length);
      // Shared WASM memory cannot be given to WebSocket.send(). One bounded copy.
      const data = new Uint8Array(view);
      if (sock.type === 2) {
        if (!sock.sport) allocate(sock);
        openData(sock); addr ??= sock.daddr; port ??= sock.dport;
        if (addr === undefined || !port) throw new FS.ErrnoError(17);
        safeSend(sock, sock.__relay?.ws, datagram(String(addr), port, data)); stats.pdpSent++;
      } else if (sock.__parent) {
        safeSend(sock, sock.__parent.__relay?.ws, stream(2, sock.__connId, data)); stats.ptpSent += length;
      } else {
        safeSend(sock, sock.__relay?.ws, data);
        if (sock === control) {
          if (data[0] === 1 && data.length === 144) stats.game = decoder.decode(data.subarray(135, 144));
          if (data[0] === 2 && data.length === 9) stats.group = decoder.decode(data.subarray(1)).replace(/\0.*$/s, '');
          if (data[0] === 3) { stats.group = ''; peers.clear(); }
        } else stats.ptpSent += length;
      }
      return length;
    };
    ops.recvmsg = function(sock, length, flags) {
      if (!cfg.enabled || !sock.__ppssppAdhoc) return original.recvmsg(sock, length, flags);
      if (!sock.recv_queue.length) {
        if (sock.error) throw new FS.ErrnoError(sock.error);
        const ws = sock.__relay?.ws;
        if (sock.__closed || sock.type === 1 && ws?.readyState === WebSocket.CLOSED) return null;
        throw new FS.ErrnoError(6);
      }
      // Delegate partial stream reads and MSG_PEEK to Emscripten's tested queue code.
      return original.recvmsg(sock, length, flags);
    };
    ops.close = function(sock) {
      if (!cfg.enabled || !sock.__ppssppAdhoc) return original.close(sock);
      sock.__closed = true;
      if (sock.__parent) {
        try { safeSend(sock, sock.__parent.__relay?.ws, stream(3, sock.__connId)); } catch (_) {}
        sock.__parent.__accepted.delete(sock.__connId);
      }
      sock.__relay?.ws?.close();
      for (const child of sock.__accepted?.values() || []) { child.__closed = true; SOCKFS.emit('close', child.stream.fd); }
      sock.__accepted?.clear(); sock.recv_queue.length = 0; sockets.delete(sock);
      if (sock === control) {
        registered = false; control = null; stats.state = 'disconnected'; stats.game = ''; stats.group = ''; peers.clear();
        for (const s of [...sockets]) ops.close(s);
      }
      publish(); return 0;
    };
    const api = {
      snapshot() { publish(); return { ...stats }; },
      disconnect() { for (const s of [...sockets]) ops.close(s); },
      destroy() { api.disconnect(); globalThis.removeEventListener?.('pagehide', api.disconnect); clearInterval(timer); for (const [name, fn] of Object.entries(original)) ops[name] = fn; delete ops.__ppssppRelayInstalled; },
      // Reconnect follows the HLE lifecycle: leave multiplayer and re-enter it.
    };
    let ticks = 0;
    timer = setInterval(() => {
      publish();
      if (registered && ++ticks % 5 === 0) {
        const ping = new Uint8Array(11); ping.set([80, 82, 49]); new DataView(ping.buffer).setFloat64(3, performance.now());
        try { safeSend(control, control.__relay?.ws, ping); } catch (_) {}
      }
    }, 1000);
    globalThis.addEventListener?.('pagehide', api.disconnect);
    ops.__ppssppRelayInstalled = api;
    publish(); return api;
  }
  globalThis.PPSSPPAdhoc = { install, endpoint, datagram, stream };
})();
