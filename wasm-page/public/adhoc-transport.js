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
    // PDP is a datagram service. PTP deliberately stays on its reliable WSS
    // stream: switching a live byte stream needs acknowledgement/replay.
    const rtcPeers = new Map();
    let signalSocket = null;
    let signalTimeout = null;
    let rtcSession = '';
    let rtcConfig = null;
    let rtcMembers = [];
    const stats = { state: 'idle', game: '', group: '', mac: cfg.mac, room: cfg.room, peers: [], pdpSent: 0, pdpReceived: 0,
      ptpSent: 0, ptpReceived: 0, ptpConnections: 0, rttMs: null, queueBytes: 0, errors: 0, lastError: '' };
    stats.rtc = { state: cfg.transport === 'websocket' ? 'disabled' : 'unavailable', peers: [], sent: 0, received: 0,
      websocketSent: 0, fallbacks: 0, dropped: 0, lastError: '' };
    const fail = (sock, message, errno = 53) => {
      sock.error = errno; stats.errors++; stats.lastError = message;
      if (sock === control) { registered = false; stats.state = 'disconnected'; }
      if (!(sock.server && sock.__closed)) SOCKFS.emit('error', [sock.stream.fd, errno, message]);
      publish();
    };
    function publish() {
      stats.rtc.peers = [...rtcPeers].map(([ip, p]) => ({ ip, state: p.pc.connectionState,
        channel: p.channel.readyState, route: p.route || 'unknown', rttMs: p.rttMs ?? null }));
      stats.rtc.queueBytes = [...rtcPeers.values()].reduce((n, p) => n + p.channel.bufferedAmount, 0);
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
    function dropPeer(ip) {
      const p = rtcPeers.get(ip);
      if (!p) return;
      rtcPeers.delete(ip); clearTimeout(p.timeout);
      p.pc.onconnectionstatechange = p.pc.onicecandidate = null;
      p.channel.onmessage = p.channel.onopen = p.channel.onclose = p.channel.onerror = null;
      p.pc.close();
    }
    function stopRTC() {
      const ws = signalSocket; signalSocket = null;
      clearTimeout(signalTimeout); rtcConfig = null; rtcMembers = []; rtcSession = '';
      for (const ip of [...rtcPeers.keys()]) dropPeer(ip);
      if (ws) { ws.onclose = ws.onerror = ws.onmessage = null; ws.close(); }
      stats.rtc.state = cfg.transport === 'websocket' ? 'disabled' : 'websocket';
    }
    function signalSend(message) {
      if (signalSocket?.readyState !== WebSocket.OPEN) throw new Error('Signaling unavailable');
      const bytes = encoder.encode(JSON.stringify(message));
      if (bytes.length > 49152 || signalSocket.bufferedAmount + bytes.length > LIMIT) throw new Error('Signaling queue limit');
      signalSocket.send(bytes);
    }
    function rtcFailure(ip, error) {
      const p = rtcPeers.get(ip);
      if (!p || p.failed) return;
      p.failed = true; clearTimeout(p.timeout);
      stats.rtc.fallbacks++; stats.rtc.lastError = String(error?.message || error);
      // Keep the failed membership until it changes; no retry storm during play.
      p.pc.onconnectionstatechange = null; p.pc.close(); publish();
    }
    function rtcPacket(ip, p, event) {
      if (rtcPeers.get(ip) !== p || p.failed || !peers.has(ip) || !registered) return;
      if (!(event.data instanceof ArrayBuffer) || event.data.byteLength < 8 || event.data.byteLength > 16384) {
        rtcFailure(ip, 'Invalid WebRTC datagram'); return;
      }
      const data = new Uint8Array(event.data);
      if (decoder.decode(data.subarray(0, 3)) !== 'PD1') { rtcFailure(ip, 'Invalid WebRTC protocol'); return; }
      const view = new DataView(data.buffer);
      const src = view.getUint16(3), dst = view.getUint16(5);
      if (!src || !dst || data[7] !== 0) { rtcFailure(ip, 'Invalid WebRTC ports'); return; }
      const sock = [...sockets].find(s => s.type === 2 && !s.__closed && !s.error && s.sport === dst);
      if (sock) { receive(sock, data.subarray(8), ip, src); stats.pdpReceived++; stats.rtc.received++; }
    }
    function reconcileRTC() {
      if (!rtcConfig) return;
      const members = new Map(rtcMembers.map(p => [p.ip, p.session]));
      for (const [ip, p] of rtcPeers) if (members.get(ip) !== p.session) dropPeer(ip);
      for (const [ip, session] of members) {
        if (rtcPeers.has(ip) || rtcPeers.size >= 16) continue;
        let p, pc;
        try {
          pc = new RTCPeerConnection(rtcConfig);
          // Negotiated ID avoids channel/open races and a second DCEP handshake.
          const channel = pc.createDataChannel('ppsspp-pdp-v1', { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 });
          channel.binaryType = 'arraybuffer';
          p = { pc, channel, session, chain: Promise.resolve(), candidates: [], failed: false };
          rtcPeers.set(ip, p);
          p.send = payload => {
            if (rtcPeers.get(ip) !== p || p.failed) return;
            signalSend({ type: 'signal', to: ip, session: rtcSession, targetSession: session, ...payload });
          };
          pc.onicecandidate = e => { try { p.send({ candidate: e.candidate?.toJSON() || null }); } catch (e) { rtcFailure(ip, e); } };
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') rtcFailure(ip, 'WebRTC connection failed');
            publish();
          };
          channel.onmessage = e => rtcPacket(ip, p, e);
          channel.onopen = () => { clearTimeout(p.timeout); publish(); };
          channel.onclose = channel.onerror = () => rtcFailure(ip, 'WebRTC channel closed');
          p.timeout = setTimeout(() => rtcFailure(ip, 'WebRTC negotiation timeout'), 10000);
          // Exactly one offerer per pair. Queue ICE behind the remote SDP.
          if (localIP < ip) p.chain = p.chain.then(async () => {
            await pc.setLocalDescription(await pc.createOffer());
            p.send({ description: pc.localDescription.toJSON() });
          }).catch(e => { if (rtcPeers.get(ip) === p) rtcFailure(ip, e); });
        } catch (e) { if (p) rtcFailure(ip, e); else { pc?.close(); stats.rtc.lastError = e.message; } }
      }
      publish();
    }
    function startRTC() {
      if (cfg.transport === 'websocket' || typeof RTCPeerConnection !== 'function' || signalSocket) return;
      stats.rtc.state = 'connecting';
      let ws;
      try { ws = new WebSocket(url('/signal', { mac: cfg.mac }), 'binary'); }
      catch (e) { stats.rtc.lastError = e.message; stats.rtc.state = 'websocket'; return; }
      signalSocket = ws; ws.binaryType = 'arraybuffer';
      signalTimeout = setTimeout(() => { if (signalSocket === ws) { stats.rtc.lastError = 'Signaling timeout'; stopRTC(); publish(); } }, 10000);
      ws.onerror = () => { stats.rtc.lastError = 'Signaling unavailable; using WebSocket'; };
      ws.onclose = () => { if (signalSocket === ws) { stopRTC(); publish(); } };
      ws.onmessage = e => {
        try {
          if (!(e.data instanceof ArrayBuffer) || e.data.byteLength > MAX_PACKET) throw new Error('Invalid signaling frame');
          const m = JSON.parse(decoder.decode(e.data));
          if (m.type === 'hello') {
            if (m.version !== 1 || !Array.isArray(m.iceServers)) throw new Error('Unsupported signaling');
            clearTimeout(signalTimeout); rtcConfig = { iceServers: m.iceServers, iceCandidatePoolSize: 0 };
            stats.rtc.state = 'hybrid'; reconcileRTC();
          } else if (m.type === 'peers') {
            if (typeof m.session !== 'string' || !Array.isArray(m.peers) || m.peers.length > 512) throw new Error('Invalid peer list');
            if (rtcSession !== m.session) for (const ip of [...rtcPeers.keys()]) dropPeer(ip);
            rtcSession = m.session;
            rtcMembers = m.peers.filter(p => /^10\.\d+\.\d+\.\d+$/.test(p.ip) && /^[a-f0-9]{32}$/.test(p.session));
            reconcileRTC();
          } else if (m.type === 'signal') {
            const p = rtcPeers.get(m.sender);
            if (!p || p.failed || p.session !== m.session || rtcSession !== m.targetSession) return;
            p.chain = p.chain.then(async () => {
              if (rtcPeers.get(m.sender) !== p || p.failed) return;
              if (m.description) {
                const offer = m.description.type === 'offer';
                if (offer !== (localIP > m.sender)) throw new Error('Unexpected SDP role');
                await p.pc.setRemoteDescription(m.description);
                for (const candidate of p.candidates.splice(0)) await p.pc.addIceCandidate(candidate);
                if (offer) {
                  await p.pc.setLocalDescription(await p.pc.createAnswer());
                  p.send({ description: p.pc.localDescription.toJSON() });
                }
              } else if ('candidate' in m) {
                if (p.pc.remoteDescription) await p.pc.addIceCandidate(m.candidate);
                else if (p.candidates.length < 256) p.candidates.push(m.candidate);
                else throw new Error('ICE queue limit');
              }
            }).catch(e => { if (rtcPeers.get(m.sender) === p) rtcFailure(m.sender, e); });
          }
        } catch (e) { stats.rtc.lastError = e.message; stopRTC(); publish(); }
      };
    }
    function sendPDP(sock, addr, port, data) {
      const ready = ip => {
        const p = rtcPeers.get(ip);
        return p && !p.failed && peers.has(ip) && p.pc.connectionState === 'connected' &&
          p.channel.readyState === 'open' && data.length + 8 <= Math.min(16384, p.pc.sctp?.maxMessageSize || 16384) &&
          p.channel.bufferedAmount + data.length + 8 <= 65536 ? p : null;
      };
      const broadcast = addr === '255.255.255.255';
      // Keep broadcast on the relay unless at least one recipient is direct.
      const targets = broadcast && [...peers.keys()].some(ready) ? [...peers.keys()] : [addr];
      // Preflight relay capacity before fanout so EAGAIN cannot duplicate data.
      const fallback = targets.filter(ip => !ready(ip));
      const ws = sock.__relay?.ws;
      if (fallback.length && (!ws || ws.readyState !== WebSocket.OPEN ||
          ws.bufferedAmount + fallback.reduce((n, ip) => n + 6 + encoder.encode(ip).length + data.length, 0) > LIMIT)) throw new FS.ErrnoError(6);
      let packet, sent = false;
      for (const ip of targets) {
        const p = ready(ip);
        if (p) {
          if (!packet) {
            packet = new Uint8Array(8 + data.length); packet.set([80, 68, 49]);
            const v = new DataView(packet.buffer); v.setUint16(3, sock.sport); v.setUint16(5, port); packet.set(data, 8);
          }
          try { p.channel.send(packet); stats.rtc.sent++; sent = true; continue; }
          catch (e) { rtcFailure(ip, e); }
        }
        try { safeSend(sock, ws, datagram(ip, port, data)); stats.rtc.websocketSent++; sent = true; }
        catch (e) {
          if (!sent) throw e;
          // A broadcast already delivered to another peer cannot be retried as
          // a whole on EAGAIN. A late route failure may drop this UDP recipient.
          stats.rtc.dropped++;
        }
      }
    }
    function sampleRTC() {
      for (const [ip, p] of rtcPeers) {
        if (p.failed || p.sampling || p.pc.connectionState !== 'connected' || !p.pc.getStats) continue;
        p.sampling = true;
        p.pc.getStats().then(report => {
          if (rtcPeers.get(ip) !== p) return;
          let pair;
          report.forEach(s => { if (s.type === 'transport' && s.selectedCandidatePairId) pair = report.get(s.selectedCandidatePairId); });
          if (!pair) report.forEach(s => { if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') pair = s; });
          if (pair) {
            p.rttMs = typeof pair.currentRoundTripTime === 'number' ? Math.round(pair.currentRoundTripTime * 10000) / 10 : null;
            const local = report.get(pair.localCandidateId), remote = report.get(pair.remoteCandidateId);
            p.route = local?.candidateType === 'relay' || remote?.candidateType === 'relay' ? 'turn' : 'direct';
          }
        }).catch(() => {}).finally(() => { p.sampling = false; });
      }
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
    function releaseListener(sock) {
      if (sock.__closed && sock.__accepted.size === 0) {
        sockets.delete(sock);
        sock.__relay?.ws?.close();
      }
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
          stopRTC();
          registered = false; stats.state = 'disconnected'; peers.clear();
          for (const other of sockets) if (other !== control) other.__relay?.ws?.close();
        }
        if (sock.__accepted) {
          for (const child of [...sock.pending]) FS.close(child.stream);
          for (const s of sock.__accepted.values()) { s.__closed = true; SOCKFS.emit('close', s.stream.fd); }
          sock.__accepted.clear();
          if (sock.__closed) sockets.delete(sock);
        }
        if (!sock.__closed) fail(sock, 'Relay disconnected');
        // A retained listener's fd may already belong to another socket.
        if (!(sock.server && sock.__closed)) SOCKFS.emit('close', sock.stream.fd);
        publish();
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
            if (sock.__closed || sock.pending.length >= sock.__backlog) { safeSend(sock, sock.__relay.ws, stream(3, id)); return; }
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
            if (child) {
              child.__closed = true;
              const pending = sock.pending.includes(child);
              sock.pending = sock.pending.filter(s => s !== child);
              SOCKFS.emit('close', child.stream.fd); sock.__accepted.delete(id);
              if (pending) FS.close(child.stream);
              releaseListener(sock);
            }
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
        startRTC();
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
        } else if (p[0] === 3) {
          const ip = [...p.subarray(1, 5)].join('.'); peers.delete(ip); dropPeer(ip);
        }
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
        sendPDP(sock, String(addr), port, data); stats.pdpSent++;
      } else if (sock.__parent) {
        safeSend(sock, sock.__parent.__relay?.ws, stream(2, sock.__connId, data)); stats.ptpSent += length;
      } else {
        safeSend(sock, sock.__relay?.ws, data);
        if (sock === control) {
          if (data[0] === 1 && data.length === 144) stats.game = decoder.decode(data.subarray(135, 144));
          if (data[0] === 2 && data.length === 9) stats.group = decoder.decode(data.subarray(1)).replace(/\0.*$/s, '');
          if (data[0] === 2 || data[0] === 3) {
            for (const ip of [...rtcPeers.keys()]) dropPeer(ip);
            rtcMembers = []; peers.clear();
            if (data[0] === 3) stats.group = '';
          }
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
    ops.close = function(sock, force = false) {
      if (!cfg.enabled || !sock.__ppssppAdhoc) return original.close(sock);
      sock.__closed = true;
      // Accepted PTP streams share the listener's WebSocket, but own their
      // lifetime. Closing the listening fd only rejects unaccepted connections.
      if (sock.server) for (const child of [...sock.pending]) FS.close(child.stream);
      if (sock.server && !force) {
        sock.pending.length = 0;
        sock.recv_queue.length = 0;
        if (sock.__accepted.size) { publish(); return 0; }
      }
      if (sock.__parent) {
        const parent = sock.__parent;
        if (parent.__accepted.get(sock.__connId) === sock) {
          try { safeSend(sock, parent.__relay?.ws, stream(3, sock.__connId)); } catch (_) {}
          parent.__accepted.delete(sock.__connId);
        }
        parent.pending = parent.pending.filter(s => s !== sock);
        releaseListener(parent);
      }
      sock.__relay?.ws?.close();
      for (const child of sock.__accepted?.values() || []) { child.__closed = true; SOCKFS.emit('close', child.stream.fd); }
      sock.__accepted?.clear(); sock.pending.length = 0; sock.recv_queue.length = 0; sockets.delete(sock);
      if (sock === control) {
        stopRTC();
        registered = false; control = null; stats.state = 'disconnected'; stats.game = ''; stats.group = ''; peers.clear();
        for (const s of [...sockets]) ops.close(s, true);
      }
      publish(); return 0;
    };
    const api = {
      snapshot() { publish(); return { ...stats }; },
      disconnect() { for (const s of [...sockets]) ops.close(s, true); },
      destroy() { api.disconnect(); globalThis.removeEventListener?.('pagehide', api.disconnect); clearInterval(timer); for (const [name, fn] of Object.entries(original)) ops[name] = fn; delete ops.__ppssppRelayInstalled; },
      // Reconnect follows the HLE lifecycle: leave multiplayer and re-enter it.
    };
    let ticks = 0;
    timer = setInterval(() => {
      publish();
      if (registered && ++ticks % 5 === 0) {
        sampleRTC();
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
