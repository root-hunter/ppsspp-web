/* Relay discovery/signaling + direct WebRTC media and a bounded input channel. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const bridge = window.PPSSPPSharedBridge;
  if (!bridge || !$('sharedConnect')) return;
  let socket, self, host, published = false, controller = null, stream, iceServers = [], epoch = 0;
  const backgroundInert = new Map();
  const peers = new Map(), held = new Set(), remoteHeld = new Set(), activeTouches = new Map(), touchKeys = new Map();
  let remoteTouchCount = 0, touchEnabled = !!window.matchMedia?.("(pointer: coarse)").matches, joinedMode = "watch";
  const keys = {
    ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39],
    KeyZ: ['z', 90], KeyX: ['x', 88], KeyA: ['a', 65], KeyS: ['s', 83], KeyQ: ['q', 81], KeyW: ['w', 87],
    KeyI: ['i', 73], KeyK: ['k', 75], KeyJ: ['j', 74], KeyL: ['l', 76], Space: [' ', 32], Enter: ['Enter', 13],
  };
  let lastInput = 0, lastSent = 0, sequence = 0, knownSessions = [], negotiationError = "", sessionMembers = [];
  const status = message => { $('sharedStatus').textContent = message; if ($('sharedPlayerStatus')) $('sharedPlayerStatus').textContent = message; };
  const problem = message => { negotiationError = message; status(message); };
  function send(message) {
    if (socket?.readyState !== 1) throw new Error('Connect to the relay first');
    socket.send(new TextEncoder().encode(JSON.stringify(message)));
  }
  function releaseRemote() {
    for (const code of remoteHeld) bridge.key(code, keys[code], false);
    remoteHeld.clear(); remoteTouchCount = 0; bridge.touches?.([]);
  }
  function clearPeer(id) {
    const peer = peers.get(id);
    if (!peer) return;
    peers.delete(id); clearTimeout(peer.timeout); peer.pc.close();
    if (id === controller) releaseRemote();
  }
  function resetSession() {
    showPlayer(false);
    epoch++; negotiationError = ""; sessionMembers = [];
    for (const id of [...peers.keys()]) clearPeer(id);
    releaseRemote(); held.clear(); controller = null; host = null; published = false;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    bridge.sharing(false);
    $('sharedVideo').srcObject = null; $('sharedVideo').muted = true; $('sharedPlayer').hidden = true;
    $('sharedMembers').replaceChildren(); $('sharedStop').disabled = true;
    $('sharedMode').disabled = false;
    $('sharedResume').hidden = true;
    $('sharedPlay').textContent = 'Sound off';
    $('sharedPlay').setAttribute('aria-label', 'Enable audio');
    $('sharedControlStatus').textContent = 'Host controls the game';
    list(knownSessions);
    $('sharedPublish').disabled = socket?.readyState !== 1;
  }
  function disconnect() {
    const old = socket; socket = null; knownSessions = [];
    old?.close(); resetSession();
    $('sharedConnect').disabled = false; $('sharedDisconnect').disabled = true;
    $('sharedList').replaceChildren(); status('Disconnected');
  }
  function input(peer, raw) {
    if (!published || controller !== peer || typeof raw !== 'string' || raw.length > 4096) return;
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(message.keys) || message.keys.length > 16 || message.keys.some(code => !Object.hasOwn(keys, code))) return;
    const touches = message.touches || [];
    if (!Array.isArray(touches) || touches.length > 10 || touches.some(t => !t || !Number.isSafeInteger(t.id) || t.id < 0 || t.id > 2147483647 || !Number.isFinite(t.x) || !Number.isFinite(t.y) || t.x < 0 || t.x > 1 || t.y < 0 || t.y > 1) || new Set(touches.map(t => t.id)).size !== touches.length) return;
    const connection = peers.get(peer);
    if (!connection || !Number.isSafeInteger(message.sequence) || message.sequence <= connection.lastSequence) return;
    connection.lastSequence = message.sequence;
    lastInput = performance.now();
    const next = new Set(message.keys);
    for (const code of remoteHeld) if (!next.has(code)) bridge.key(code, keys[code], false);
    for (const code of next) if (!remoteHeld.has(code)) bridge.key(code, keys[code], true);
    remoteHeld.clear(); for (const code of next) remoteHeld.add(code);
    bridge.touches?.(touches); remoteTouchCount = touches.length;
  }
  function wireChannel(peer, channel) {
    if (channel.label !== 'psp-input' || peer.channel) { channel.close(); return; }
    peer.channel = channel;
    channel.onmessage = event => input(peer.id, event.data);
    channel.onclose = () => { if (controller === peer.id) releaseRemote(); };
  }
  function makePeer(id, offerer) {
    clearPeer(id);
    const pc = new RTCPeerConnection({ iceServers });
    const peer = { id, pc, candidates: [], channel: null, lastSequence: -1, chain: Promise.resolve(), phase: offerer ? "creating offer" : "waiting for offer", localCandidates: 0, remoteCandidates: 0 };
    peers.set(id, peer);
    peer.timeout = setTimeout(() => {
      if (peers.get(id) !== peer || pc.connectionState === 'connected') return;
      const reason = pc.iceGatheringState === 'complete' && !peer.localCandidates ? 'This browser produced no ICE network candidates. Check WebRTC blocking extensions, browser privacy settings, or relay TURN configuration' : !pc.remoteDescription ? (offerer ? 'The guest did not answer the offer' : 'No WebRTC offer received from the host') :
        !peer.remoteCandidates ? 'No ICE network candidates received from the other browser; check its WebRTC privacy settings and relay STUN/TURN configuration' :
        'ICE could not connect the browsers; check firewall and relay TURN configuration';
      problem(reason); clearPeer(id);
    }, 15000);
    const signal = payload => { if (peers.get(id) === peer && socket?.readyState === 1) send({ type: 'signal', to: id, payload }); };
    pc.onicecandidate = event => {
      if (!event.candidate) return;
      if (event.candidate.candidate) peer.localCandidates++;
      const candidate = event.candidate.toJSON?.() || { candidate: event.candidate.candidate, sdpMid: event.candidate.sdpMid, sdpMLineIndex: event.candidate.sdpMLineIndex };
      signal({ candidate });
    };
    pc.onicegatheringstatechange = () => {
      if (peers.get(id) === peer && pc.iceGatheringState === 'complete' && !peer.localCandidates) problem('This browser produced no ICE network candidates. Check WebRTC blocking extensions, browser privacy settings, or relay TURN configuration');
    };
    pc.onicecandidateerror = event => { peer.iceError = event.errorText || String(event.errorCode); };
    pc.onconnectionstatechange = () => {
      if (peers.get(id) !== peer) return;
      if (pc.connectionState === 'connected') { negotiationError = ''; peer.phase = 'connected'; clearTimeout(peer.timeout); status(published ? 'Sharing live · host keeps running' : 'Stream connected · select Enable audio for sound'); }
      if (['failed', 'closed'].includes(pc.connectionState)) { clearPeer(id); problem('Peer disconnected. Leave and join again; check TURN configuration for remote networks.'); }
      if (pc.connectionState === 'disconnected' && controller === id) releaseRemote();
    };
    if (offerer) {
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      wireChannel(peer, pc.createDataChannel('psp-input', { ordered: false, maxRetransmits: 0 }));
      peer.chain = (async () => {
        peer.phase = 'creating offer';
        await pc.setLocalDescription(await pc.createOffer());
        peer.phase = 'waiting for answer';
        signal({ description: pc.localDescription.toJSON() });
        // Keep bandwidth predictable as additional guests join.
        for (const sender of pc.getSenders()) {
          if (sender.track?.kind !== 'video') continue;
          const params = sender.getParameters();
          if (params.encodings?.length) { params.encodings[0].maxBitrate = 2500000; await sender.setParameters(params).catch(() => {}); }
        }
      })().catch(error => { problem('WebRTC offer failed: ' + error.message); clearPeer(id); });
    } else {
      pc.ondatachannel = event => wireChannel(peer, event.channel);
      pc.ontrack = event => {
        if (peers.get(id) !== peer) return;
        const video = $('sharedVideo');
        if (!video.srcObject) {
          // A newly received stream contains audio: unmuted autoplay is blocked
          // in fresh/anonymous profiles even when ICE is already connected.
          video.muted = true;
          video.srcObject = new MediaStream();
        }
        video.srcObject.addTrack(event.track);
        video.play().catch(() => status('Stream ready · select Enable audio to start playback'));
      };
    }
    return peer;
  }
  function list(sessions) {
    knownSessions = sessions;
    const root = $('sharedList'); root.replaceChildren();
    for (const session of sessions) {
      const row = document.createElement('div'); row.className = 'shared-row';
      const label = document.createElement('span');
      const title = document.createElement('strong'); title.textContent = session.title;
      const subtitle = document.createElement('small'); subtitle.textContent = `${session.name} · ${session.mode === 'play' ? 'Remote play' : 'Watch only'}`;
      label.append(title, subtitle);
      const art = document.createElement('span'); art.className = 'shared-session-art'; art.textContent = 'PSP';
      const button = document.createElement('button'); button.type = 'button'; button.textContent = session.id === self ? 'Your session' : session.mode === 'play' ? 'Play' : 'Watch';
      button.disabled = !!host || published || session.id === self;
      button.onclick = () => { try { send({ type: 'join', host: session.id }); } catch (error) { status(error.message); } };
      row.append(art, label, button); root.append(row);
    }
    if (!sessions.length) root.textContent = 'No sessions shared in this relay room.';
  }
  function state(message) {
    if (controller !== message.controller) { releaseRemote(); releaseLocalInput(); }
    controller = message.controller;
    $('sharedControlStatus').textContent = controller === self ? 'You have control · touch, keyboard or gamepad' : controller ? 'Another guest has control' : joinedMode === 'watch' ? 'Watching · host controls the game' : 'Waiting for the host to give you control';
    syncPlayerControls();
    if (!published) return;
    sessionMembers = message.members;
    const root = $('sharedMembers'); root.replaceChildren();
    const revoke = document.createElement('button'); revoke.type = 'button'; revoke.textContent = 'Return control to host';
    revoke.disabled = !controller;
    revoke.onclick = () => send({ type: 'control', peer: null }); root.append(revoke);
    for (const member of message.members) {
      const row = document.createElement('div'); row.className = 'shared-row';
      const label = document.createElement('span'); label.textContent = member.name;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = controller === member.id ? 'Has control' : 'Give control';
      button.disabled = $('sharedMode').value !== 'play';
      button.onclick = () => send({ type: 'control', peer: member.id }); row.append(label, button); root.append(row);
    }
  }
  async function message(m) {
    if (m.type === 'welcome') { self = m.id; iceServers = m.iceServers; status('Connected · sessions in your relay room'); }
    else if (m.type === 'sessions') list(m.sessions);
    else if (m.type === 'published') { published = true; list(knownSessions); bridge.sharing(true); $('sharedStop').disabled = false; status('Session published · waiting for guests'); }
    else if (m.type === 'joined') { host = m.host;
      const session = knownSessions.find(s => s.id === host); joinedMode = session?.mode || 'watch';
      $('sharedPlayerTitle').textContent = session?.title || 'Shared session';
      negotiationError = ''; makePeer(host, false); list(knownSessions); $('sharedPublish').disabled = true; $('sharedStop').disabled = false; showPlayer(true); status('Connecting stream…'); }
    else if (m.type === 'guest' && published && stream) makePeer(m.peer, true);
    else if (m.type === 'departed') clearPeer(m.peer);
    else if (m.type === 'state') {
      state(m);
      if (published && stream) for (const member of m.members) if (!peers.has(member.id)) makePeer(member.id, true);
    }
    else if (m.type === 'ended') { resetSession(); status('Session ended'); }
    else if (m.type === 'error') status(m.message);
    else if (m.type === 'signal') {
      if (!published && m.sender !== host) return;
      if (published && !peers.has(m.sender)) return;
      const peer = peers.get(m.sender) || makePeer(m.sender, false);
      peer.chain = peer.chain.then(async () => {
        if (peers.get(m.sender) !== peer) return;
        if (m.payload.description) {
          peer.phase = m.payload.description.type === 'offer' ? 'answering offer' : 'connecting ICE';
          await peer.pc.setRemoteDescription(m.payload.description);
          peer.remoteCandidates += (m.payload.description.sdp.match(/^a=candidate:/gm) || []).length;
          for (const candidate of peer.candidates.splice(0)) { await peer.pc.addIceCandidate(candidate); if (candidate?.candidate) peer.remoteCandidates++; }
          if (m.payload.description.type === 'offer') {
            await peer.pc.setLocalDescription(await peer.pc.createAnswer());
            peer.phase = 'connecting ICE';
            send({ type: 'signal', to: peer.id, payload: { description: peer.pc.localDescription.toJSON() } });
          }
        } else if (Object.hasOwn(m.payload, 'candidate')) {
          if (peer.pc.remoteDescription) { await peer.pc.addIceCandidate(m.payload.candidate); if (m.payload.candidate?.candidate) peer.remoteCandidates++; }
          else if (peer.candidates.length < 256) peer.candidates.push(m.payload.candidate);
          else throw new Error('Too many pending ICE candidates');
        }
      }).catch(error => { problem('WebRTC ' + peer.phase + ': ' + error.message); clearPeer(peer.id); });
    }
  }
  $('sharedConnect').onclick = () => {
    disconnect();
    try {
      if (!window.RTCPeerConnection) throw new Error('WebRTC is unavailable in this browser');
      const config = bridge.config();
      const url = window.PPSSPPAdhoc.endpoint(config.server);
      url.pathname = url.pathname.replace(/\/$/, '') + '/sessions';
      url.search = new URLSearchParams({ v: '1', token: [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''), room: config.room, name: config.nick, ...(config.sessionKey ? { session_key: config.sessionKey } : {}) });
      const ws = socket = new WebSocket(url, 'binary'); ws.binaryType = 'arraybuffer';
      $('sharedConnect').disabled = true; $('sharedDisconnect').disabled = false; status('Connecting to relay…');
      const timeout = setTimeout(() => { if (socket === ws && ws.readyState !== 1) { disconnect(); status('Relay connection timed out'); } }, 8000);
      ws.onopen = () => { clearTimeout(timeout); $('sharedPublish').disabled = false; };
      ws.onmessage = event => { if (socket !== ws) return; try { void message(JSON.parse(new TextDecoder().decode(event.data))).catch(error => status(error.message)); } catch (error) { status(error.message); } };
      ws.onclose = () => { clearTimeout(timeout); if (socket === ws) { disconnect(); status('Relay disconnected · check URL, access key and server version'); } };
      ws.onerror = () => { if (socket === ws) status('Relay connection failed'); };
    } catch (error) { disconnect(); status(error.message); }
  };
  $('sharedDisconnect').onclick = disconnect;
  $('sharedPublish').onclick = async () => {
    const generation = epoch;
    $('sharedPublish').disabled = true;
    try {
      const captured = await bridge.capture();
      if (epoch !== generation || socket?.readyState !== 1) { captured.getTracks().forEach(t => t.stop()); return; }
      stream = captured;
      send({ type: 'publish', title: $('sharedTitle').value.trim() || bridge.title(), mode: $('sharedMode').value });
      $('sharedMode').disabled = true;
    } catch (error) { resetSession(); status(error.message); }
  };
  $('sharedStop').onclick = () => { try { send({ type: 'leave' }); } finally { resetSession(); $('sharedMode').disabled = false; } };
  const video = $('sharedVideo'), player = $('sharedPlayer');
  video.addEventListener('loadedmetadata', () => { if (video.videoWidth && video.videoHeight) player.style.setProperty('--shared-video-aspect', String(video.videoWidth / video.videoHeight)); });
  const playerIsFullscreen = () => document.fullscreenElement === player || document.webkitFullscreenElement === player;
  function syncPlayerControls() {
    const canControl = !!host && controller === self;
    $('sharedTouchControls').hidden = !canControl || !touchEnabled;
    $('sharedTouchToggle').disabled = !canControl;
    $('sharedTouchToggle').setAttribute('aria-pressed', String(touchEnabled));
    $('sharedPlayerHint').textContent = canControl ? 'Touch · keyboard · gamepad' : joinedMode === 'watch' ? 'Watch only · enjoy the live stream' : 'The host assigns control from Shared Sessions';
  }
  function releaseLocalInput() {
    held.clear(); activeTouches.clear(); touchKeys.clear();
    document.querySelectorAll('[data-shared-key].is-held').forEach(button => button.classList.remove('is-held'));
    transmit();
  }
  function showPlayer(open) {
    if (!open) releaseLocalInput();
    player.hidden = !open;
    document.body.classList.toggle('shared-playing', open);
    if (open) {
      for (const element of document.querySelectorAll('app-root > header, .stage, #sidePanel, .fullscreen-toolbar')) {
        if (!backgroundInert.has(element)) backgroundInert.set(element, element.inert);
        element.inert = true;
      }
    } else {
      for (const [element, wasInert] of backgroundInert) element.inert = wasInert;
      backgroundInert.clear();
    }
    $('sharedResume').hidden = !host;
    if (!open && playerIsFullscreen()) { const exit = document.exitFullscreen || document.webkitExitFullscreen; if (exit) Promise.resolve(exit.call(document)).catch(() => {}); }
    if (open) { syncPlayerControls(); video.focus({ preventScroll: true }); }
    else if (host) $('sharedResume').focus({ preventScroll: true });
  }
  $('sharedResume').onclick = () => showPlayer(true);
  $('sharedBack').onclick = () => showPlayer(false);
  $('sharedLeave').onclick = () => $('sharedStop').click();
  $('sharedPlay').onclick = () => {
    video.muted = !video.muted;
    $('sharedPlay').textContent = video.muted ? 'Sound off' : 'Sound on';
    $('sharedPlay').setAttribute('aria-label', video.muted ? 'Enable audio' : 'Mute audio');
    video.play().catch(error => status(error.message));
  };
  $('sharedTouchToggle').onclick = () => { releaseLocalInput(); touchEnabled = !touchEnabled; syncPlayerControls(); video.focus(); };
  $('sharedPlayerDetails').onclick = () => { const detail = $('sharedPlayerDiagnostic'); detail.hidden = !detail.hidden; $('sharedPlayerDetails').setAttribute('aria-expanded', String(!detail.hidden)); };
  $('sharedFullscreen').onclick = async () => {
    try {
      if (playerIsFullscreen()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else if (player.requestFullscreen) await player.requestFullscreen({ navigationUI: 'hide' });
      else if (player.webkitRequestFullscreen) player.webkitRequestFullscreen();
      else status('Fullscreen is unavailable; the player already fills this window.');
    } catch (error) { status('Fullscreen: ' + error.message); }
    video.focus({ preventScroll: true });
  };
  const syncFullscreenHud = () => {
    const fullscreen = playerIsFullscreen(), open = player.classList.contains('hud-open');
    player.classList.toggle('is-fullscreen', fullscreen);
    $('sharedHud').hidden = !fullscreen;
    $('sharedHud').setAttribute('aria-expanded', String(open));
    player.querySelector('.shared-player-toolbar').inert = fullscreen && !open;
    player.querySelector('.shared-player-footer').inert = fullscreen && !open;
  };
  $('sharedHud').onclick = () => { player.classList.toggle('hud-open'); syncFullscreenHud(); };
  const fullscreenChanged = () => {
    player.classList.remove('hud-open'); syncFullscreenHud();
    $('sharedFullscreen').textContent = playerIsFullscreen() ? 'Exit fullscreen' : 'Fullscreen';
    $('sharedFullscreen').setAttribute('aria-label', playerIsFullscreen() ? 'Exit fullscreen' : 'Enter fullscreen');
    if (!player.hidden && $('sidePanel')) $('sidePanel').inert = true;
  };
  document.addEventListener('fullscreenchange', fullscreenChanged);
  document.addEventListener('webkitfullscreenchange', fullscreenChanged);
  window.addEventListener('keydown', event => {
    if (player.hidden) return;
    if (event.key === 'Tab') {
      const items = [...player.querySelectorAll('button:not(:disabled), video[tabindex]')].filter(el => !el.closest('[hidden], [inert]') && el.getClientRects().length);
      if (items.length && (event.shiftKey && document.activeElement === items[0] || !event.shiftKey && document.activeElement === items.at(-1))) { event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0]).focus(); }
    }
    if (event.key === 'F1' || event.key === 'Escape' && !document.fullscreenElement && !document.webkitFullscreenElement) { event.preventDefault(); event.stopImmediatePropagation(); showPlayer(false); }
  }, true);
  for (const type of ['keydown', 'keyup']) video.addEventListener(type, event => {
    if (controller !== self || !keys[event.code]) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (type === 'keydown') held.add(event.code); else held.delete(event.code);
    transmit();
  });
  function transmit(extra = []) {
    const channel = peers.get(host)?.channel;
    if (controller !== self || channel?.readyState !== 'open' || channel.bufferedAmount > 4096) return;
    const active = new Set([...held, ...extra, ...[...touchKeys.values()].flat()]);
    channel.send(JSON.stringify({ sequence: ++sequence, keys: [...active], touches: [...activeTouches.values()] })); lastSent = performance.now();
  }
  function point(event, starting = false) {
    const rect = video.getBoundingClientRect(), ratio = (video.videoWidth || 16) / (video.videoHeight || 9);
    const width = Math.min(rect.width, rect.height * ratio), height = width / ratio;
    if (!width || !height) return null;
    const x = (event.clientX - rect.left - (rect.width - width) / 2) / width;
    const y = (event.clientY - rect.top - (rect.height - height) / 2) / height;
    if (starting && (x < 0 || x > 1 || y < 0 || y > 1)) return null;
    return { id: event.pointerId, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }
  video.addEventListener('pointerdown', event => {
    if (controller !== self || event.button !== 0) return;
    const touch = point(event, true); if (!touch) return;
    event.preventDefault(); video.focus({ preventScroll: true }); video.setPointerCapture(event.pointerId);
    activeTouches.set(event.pointerId, touch); transmit();
  });
  video.addEventListener('pointermove', event => { if (!activeTouches.has(event.pointerId)) return; event.preventDefault(); const touch = point(event); if (touch) activeTouches.set(event.pointerId, touch); transmit(); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) video.addEventListener(type, event => { if (activeTouches.delete(event.pointerId)) transmit(); });
  const touchControls = $('sharedTouchControls');
  function updateTouchKey(event) {
    const button = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-shared-key]');
    touchKeys.set(event.pointerId, button && touchControls.contains(button) ? [button.dataset.sharedKey] : []);
    const active = new Set([...touchKeys.values()].flat());
    touchControls.querySelectorAll('[data-shared-key]').forEach(el => el.classList.toggle('is-held', active.has(el.dataset.sharedKey)));
    transmit();
  }
  touchControls.addEventListener('pointerdown', event => {
    if (controller !== self || !event.target.closest('[data-shared-key]')) return;
    event.preventDefault(); video.focus({ preventScroll: true }); touchControls.setPointerCapture(event.pointerId); updateTouchKey(event);
  });
  touchControls.addEventListener('pointermove', event => { if (touchKeys.has(event.pointerId) && !event.target.closest('#sharedAnalog')) { event.preventDefault(); updateTouchKey(event); } });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) touchControls.addEventListener(type, event => { if (touchKeys.delete(event.pointerId)) { const active = new Set([...touchKeys.values()].flat()); touchControls.querySelectorAll('[data-shared-key]').forEach(el => el.classList.toggle('is-held', active.has(el.dataset.sharedKey))); transmit(); } });
  for (const type of ['keydown', 'keyup']) touchControls.addEventListener(type, event => {
    const code = event.target.closest('[data-shared-key]')?.dataset.sharedKey;
    if (controller !== self || !code || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (type === 'keydown') touchKeys.set('keyboard-' + code, [code]); else touchKeys.delete('keyboard-' + code);
    transmit();
  });
  const analog = $('sharedAnalog');
  function moveAnalog(event) {
    const rect = analog.getBoundingClientRect(), x = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2), y = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    const codes = []; if (x < -.3) codes.push('KeyJ'); if (x > .3) codes.push('KeyL'); if (y < -.3) codes.push('KeyI'); if (y > .3) codes.push('KeyK');
    touchKeys.set(event.pointerId, codes); analog.firstElementChild.style.transform = `translate(${Math.max(-1, Math.min(1, x)) * 18}px, ${Math.max(-1, Math.min(1, y)) * 18}px)`; transmit();
  }
  analog.addEventListener('pointerdown', event => { if (controller !== self) return; event.preventDefault(); event.stopPropagation(); video.focus(); analog.setPointerCapture(event.pointerId); moveAnalog(event); });
  analog.addEventListener('pointermove', event => { if (touchKeys.has(event.pointerId)) { event.stopPropagation(); moveAnalog(event); } });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) analog.addEventListener(type, () => { analog.firstElementChild.style.transform = ''; });
  video.onblur = releaseLocalInput;
  window.addEventListener('blur', () => { releaseLocalInput(); releaseRemote(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseLocalInput(); releaseRemote(); } });
  setInterval(() => {
    if ((remoteHeld.size || remoteTouchCount) && performance.now() - lastInput > 600) releaseRemote();
    if (controller !== self || player.hidden || !player.contains(document.activeElement) || document.hidden) return;
    const pad = document.activeElement === video && bridge.gamepads().find(p => p?.connected && p.mapping === 'standard');
    const active = new Set();
    if (pad) {
      const map = ['KeyZ', 'KeyX', 'KeyA', 'KeyS', 'KeyQ', 'KeyW', null, null, 'Enter', 'Space', null, null, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      map.forEach((code, i) => { if (code && pad.buttons[i]?.pressed) active.add(code); });
      if (pad.axes[0] < -.35) active.add('KeyJ'); if (pad.axes[0] > .35) active.add('KeyL');
      if (pad.axes[1] < -.35) active.add('KeyI'); if (pad.axes[1] > .35) active.add('KeyK');
    }
    if (performance.now() - lastSent >= 32) transmit(active);
  }, 33);
  let mediaDiagnostics = {}, checkingMedia = false;
  window.PPSSPPSharedDiagnostics = { snapshot: () => JSON.parse(JSON.stringify(mediaDiagnostics)) };
  setInterval(async () => {
    if (checkingMedia) return;
    checkingMedia = true;
    try {
      const entries = await Promise.all([...peers.values()].map(async peer => {
        const stats = await peer.pc.getStats();
        const videoStats = [...stats.values()].find(s => (s.kind || s.mediaType) === 'video' && s.type === (published ? 'outbound-rtp' : 'inbound-rtp'));
        return { connection: peer.pc.connectionState, ice: peer.pc.iceConnectionState, phase: peer.phase, gathering: peer.pc.iceGatheringState, localCandidates: peer.localCandidates, remoteCandidates: peer.remoteCandidates, iceError: peer.iceError,
          frames: videoStats?.framesDecoded ?? videoStats?.framesEncoded ?? 0,
          bytes: videoStats?.bytesReceived ?? videoStats?.bytesSent ?? 0 };
      }));
      const video = $('sharedVideo');
      mediaDiagnostics = { error: negotiationError, role: published ? 'host' : host ? 'guest' : 'idle', peers: entries,
        capture: bridge.captureState?.(), video: { width: video.videoWidth, height: video.videoHeight,
          paused: video.paused, muted: video.muted, time: video.currentTime, ready: video.readyState } };
      const detail = $('sharedMediaStatus');
      $('sharedPlayerStatus').hidden = !host || !negotiationError && video.readyState >= 2;
      if (negotiationError) $('sharedPlayerStatus').textContent = negotiationError;
      if (!detail) return;
      if (published) detail.textContent = negotiationError || `Host video: ${mediaDiagnostics.capture?.width || 0} × ${mediaDiagnostics.capture?.height || 0} · ${entries.reduce((n, p) => n + p.frames, 0)} encoded frames · ${sessionMembers.length} guests · ${entries.filter(p => p.connection === "connected").length} connected`;
      else if (host) {
        const peer = entries[0];
        detail.textContent = negotiationError || (peer ? `${peer.phase} · ICE ${peer.ice} · candidates ${peer.localCandidates}/${peer.remoteCandidates} · ${peer.frames} decoded frames · ${video.videoWidth} × ${video.videoHeight}${video.paused ? ' · playback paused' : ''}` : 'Waiting for the host to negotiate the video stream…');
        if ($('sharedPlayerDiagnostic')) $('sharedPlayerDiagnostic').textContent = detail.textContent;
      } else detail.textContent = '';
    } catch (error) { if ($('sharedMediaStatus')) $('sharedMediaStatus').textContent = 'Media status: ' + error.message; }
    finally { checkingMedia = false; }
  }, 1000);
  window.addEventListener('pagehide', disconnect);
})();
