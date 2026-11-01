#!/usr/bin/env node
// Real Chromium peers + relay with normal autoplay policy.
// PPSSPP_TEST_REAL_HOST=1 also tests PPSSPP WASM with the cube homebrew fixture.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const dropOffer = process.env.PPSSPP_TEST_DROP_OFFER === '1';
const testOrigin = process.env.PPSSPP_TEST_ORIGIN;
const realHost = !!testOrigin || process.env.PPSSPP_TEST_REAL_HOST === '1';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'ppsspp-share-'));
let chrome, relay, socket;
const pending = new Map(), errors = [];
let nextId = 0;
function lineFrom(child, pattern) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Process startup timeout: ' + output)), 20000);
    const consume = data => { output += data; const match = output.match(pattern); if (match) { clearTimeout(timer); resolve(match[1]); } };
    child.stdout?.on('data', consume); child.stderr?.on('data', consume);
    child.once('error', reject); child.once('exit', code => { clearTimeout(timer); reject(new Error(`Process exited ${code}: ${output}`)); });
  });
}
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 20000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function evaluate(session, expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(session, expression, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(session, expression)) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`Timed out ${label}: ` + await evaluate(session, `JSON.stringify({ status: document.getElementById('sharedStatus')?.textContent, media: window.PPSSPPSharedDiagnostics?.snapshot(), capture: window.PPSSPPSharedBridge?.captureState?.() })`));
}
try {
  if (!testOrigin) relay = spawn('python3', ['-u', '-c', `import sys; sys.path.insert(0, 'server')
from relay import AdhocWebSocketHandler, ThreadingAdhocWebSocketServer
from relay_auth import RelayAuth
${realHost ? `from serve import WasmThreadingHandler, WasmThreadingServer
from functools import partial
from pathlib import Path
root = Path.cwd()
server = WasmThreadingServer(('127.0.0.1', 0), partial(WasmThreadingHandler, web_root=str(root), wasm_root=str(root / 'deps' / 'ppsspp-wasm')))
server.adhoc_enabled = True` : `server = ThreadingAdhocWebSocketServer(('127.0.0.1', 0), AdhocWebSocketHandler)`}
server.relay_auth = RelayAuth.from_env()
print('PORT=' + str(server.server_address[1]), flush=True)
server.serve_forever()`], { cwd: root, env: { ...process.env, RELAY_AUTH_MODE: 'open' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const port = testOrigin ? new URL(testOrigin).port : await lineFrom(relay, /PORT=(\d+)/);
  const origin = testOrigin || `http://127.0.0.1:${port}`;
  const relayUrl = testOrigin ? origin.replace(/^http/, 'ws') + '/adhoc' : `ws://127.0.0.1:${port}/adhoc`;
  const room = 'stream-' + Date.now().toString(36);
  const template = await readFile(join(root, 'wasm-page/src/app/app.html'), 'utf8');
  const panel = template.slice(template.indexOf('<div class="tab-panel" id="tabShared">'), template.indexOf('<div class="tab-panel" id="tabDrive">')) + template.slice(template.indexOf('<!-- Shared player -->'), template.indexOf('<!-- End shared player -->'));
  const styles = await readFile(join(root, 'wasm-page/src/styles.css'), 'utf8');
  const client = await readFile(join(root, 'wasm-page/public/shared-sessions.js'), 'utf8');
  await writeFile(join(directory, 'fixture.html'), `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style><body>${panel.replace('class="tab-panel" id="tabShared"', 'class="tab-panel active" id="tabShared"')}<canvas id="fixtureCanvas" width="480" height="272" style="max-width:100%;height:auto"></canvas><script>
window.PPSSPPAdhoc = { endpoint: value => new URL(value) };
window.received = []; window.sharing = false;
const canvas = document.getElementById('fixtureCanvas'), ctx = canvas.getContext('2d');
let frame = 0; setInterval(() => { ctx.fillStyle = ++frame % 2 ? '#4288ff' : '#55ffaa'; ctx.fillRect(0, 0, 480, 272); }, 33);
window.PPSSPPSharedBridge = {
 config: () => ({ server: 'ws://127.0.0.1:${port}/adhoc', room: 'browser', nick: 'Browser' }), title: () => 'Canvas fixture',
 sharing: value => window.sharing = value, gamepads: () => [], touches: value => window.receivedTouches = value, key: (code, mapping, down) => received.push({code,down}),
 async capture() { const audio = new AudioContext(); await audio.resume(); const dest = audio.createMediaStreamDestination();
 const osc = audio.createOscillator(); osc.connect(dest); osc.start(); const stream = canvas.captureStream(30);
 stream.addTrack(dest.stream.getAudioTracks()[0]); return stream; }
};
${client}</script>`);
  chrome = spawn(process.env.CHROME || '/usr/bin/google-chrome', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=0', '--ignore-certificate-errors', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await lineFrom(chrome, /DevTools listening on (ws:\/\/\S+)/);
  socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); if (!p) return; pending.delete(message.id); clearTimeout(p.timer); message.error ? p.reject(new Error(JSON.stringify(message.error))) : p.resolve(message.result); }
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  };
  const sessions = [];
  for (let i = 0; i < 2; i++) {
    const { browserContextId } = await command('Target.createBrowserContext');
    const { targetId } = await command('Target.createTarget', { browserContextId, url: realHost ? origin + '/' : pathToFileURL(join(directory, 'fixture.html')).href });
    const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
    await command('Runtime.enable', {}, sessionId); sessions.push(sessionId);
    await until(sessionId, '!!document.getElementById("sharedConnect")?.onclick', 'client load');
    if (realHost) {
      await evaluate(sessionId, `preferences.setItem(NETWORK_SERVER_KEY, ${JSON.stringify(relayUrl)}); preferences.setItem('ppsspp-network-room', ${JSON.stringify(room)}); activatePanelTab('shared');`);
    }
    if (realHost && i === 0) {
      const cube = (await readFile(join(root, 'deps/ppsspp-wasm/pspautotests/input/cube.cso'))).toString('base64');
      await evaluate(sessionId, `${testOrigin ? '' : "selectBuildDir = async () => setBuildDir('/build-wasm-multiplayer/');"}
        selectedGame = new File([Uint8Array.from(atob('${cube}'), ch => ch.charCodeAt(0))], 'cube.cso');
        window.received = [];
        window.receivedTouches = [];
        const originalTouches = PPSSPPSharedBridge.touches;
        PPSSPPSharedBridge.touches = points => { window.receivedTouches = points; originalTouches(points); };
        const originalKey = PPSSPPSharedBridge.key;
        PPSSPPSharedBridge.key = (...args) => { received.push({code: args[0], down: args[2]}); originalKey(...args); };
        const originalSharing = PPSSPPSharedBridge.sharing;
        PPSSPPSharedBridge.sharing = value => { window.sharing = value; originalSharing(value); };`);
      await command('Runtime.evaluate', { expression: 'document.getElementById("startBtn").click()', userGesture: true }, sessionId);
      await until(sessionId, 'runtimeFailed ? (() => { throw new Error(document.getElementById("statusText").textContent); })() : runtimeReady', 'real emulator startup', 120000);
      await evaluate(sessionId, `activatePanelTab('shared');`);
    }
    await evaluate(sessionId, 'document.getElementById("sharedConnect").click()');
    await until(sessionId, 'document.getElementById("sharedStatus").textContent.startsWith("Connected")', 'relay connection');
  }
  const [host, guest] = sessions;
  if (dropOffer) await evaluate(host, `const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(data) { const m = JSON.parse(new TextDecoder().decode(data)); if (m.type !== 'signal') originalSend.call(this, data); };`);
  await command('Runtime.evaluate', { expression: 'document.getElementById("sharedMode").value = "play"; document.getElementById("sharedPublish").click()', userGesture: true }, host);
  await until(host, 'window.sharing', 'publication');
  if (realHost) console.log('HOST AT PUBLICATION:', JSON.stringify(await evaluate(host, `({capture: PPSSPPSharedBridge.captureState(), ready:runtimeReady, failed:runtimeFailed, paused:menuSuspended, hidden:document.hidden, build:BUILD_DIR})`)));
  await until(guest, '!!document.querySelector("#sharedList button")', 'discovery');
  await evaluate(guest, 'document.querySelector("#sharedList button").click()');
  if (dropOffer) {
    await until(guest, 'document.getElementById("sharedStatus").textContent.includes("No WebRTC offer received")', 'missing offer timeout', 20000);
    await until(guest, 'document.getElementById("sharedPlayerStatus").textContent.includes("No WebRTC offer received")', 'timeout remains visible beside player');
    console.log('PASS: missing offer times out and remains visible instead of reverting to waiting');
  } else {
  await until(guest, 'document.getElementById("sharedVideo").videoWidth > 0', 'real video frames');
  await until(guest, '!document.getElementById("sharedVideo").paused && document.getElementById("sharedVideo").currentTime > 0.2', 'autoplay without browser permission overrides');
  await until(guest, `(() => { const video = document.getElementById('sharedVideo'); const copy = document.createElement('canvas'); copy.width = 32; copy.height = 18; const ctx = copy.getContext('2d'); ctx.drawImage(video, 0, 0, 32, 18); return [...ctx.getImageData(0,0,32,18).data].some((v, i) => i % 4 !== 3 && v > 30); })()`, 'visible pixels throughout received video');
  await evaluate(guest, `window.streamPixelHash = () => { const v = document.getElementById('sharedVideo'); const c = document.createElement('canvas'); c.width = 32; c.height = 18; const x = c.getContext('2d'); x.drawImage(v,0,0,32,18); return [...x.getImageData(0,0,32,18).data].reduce((hash, byte) => (hash * 31 + byte) >>> 0, 0); }; window.firstStreamHash = streamPixelHash();`);
  await until(guest, 'streamPixelHash() !== firstStreamHash', 'moving video while host is in the background', 20000);
  assert.deepEqual(await evaluate(guest, 'document.getElementById("sharedVideo").srcObject.getTracks().map(t => t.kind).sort()'), ['audio', 'video']);
  assert.equal(await evaluate(guest, 'document.getElementById("sharedVideo").muted'), true, 'Fresh guests must autoplay muted');
  await command('Runtime.evaluate', { expression: 'document.getElementById("sharedPlay").click()', userGesture: true }, guest);
  await until(guest, '!document.getElementById("sharedVideo").muted && !document.getElementById("sharedVideo").paused', 'explicit audio activation');
  await until(host, 'document.querySelectorAll("#sharedMembers button").length === 2', 'membership');
  await evaluate(host, 'document.querySelectorAll("#sharedMembers button")[1].click()');
  await until(guest, 'document.getElementById("sharedControlStatus").textContent.startsWith("You have control")', 'control grant');
  await evaluate(guest, 'document.getElementById("sharedVideo").focus(); document.getElementById("sharedVideo").dispatchEvent(new KeyboardEvent("keydown", {code:"KeyZ", bubbles:true}))');
  await until(host, 'received.some(e => e.code === "KeyZ" && e.down)', 'remote keydown via DataChannel');
  if (process.env.PPSSPP_TEST_SCREENSHOTS) {
    const shot = await command('Page.captureScreenshot', {format:'png'}, guest);
    await writeFile(process.env.PPSSPP_TEST_SCREENSHOTS + '-desktop.png', Buffer.from(shot.data,'base64'));
    await command('Emulation.setDeviceMetricsOverride', {width:844,height:390,deviceScaleFactor:1,mobile:true}, guest);
  }
  await evaluate(guest, 'document.getElementById("sharedTouchToggle").click()');
  if (process.env.PPSSPP_TEST_SCREENSHOTS) {
    const shot = await command('Page.captureScreenshot', {format:'png'}, guest);
    await writeFile(process.env.PPSSPP_TEST_SCREENSHOTS + '-landscape.png', Buffer.from(shot.data,'base64'));
    await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true}, guest);
    const portrait = await command('Page.captureScreenshot', {format:'png'}, guest);
    await writeFile(process.env.PPSSPP_TEST_SCREENSHOTS + '-portrait.png', Buffer.from(portrait.data,'base64'));
  }
  await evaluate(host, 'received.length = 0');
  const centers = await evaluate(guest, `['KeyZ','ArrowUp'].map(code => { const rect = document.querySelector('[data-shared-key="'+code+'"]').getBoundingClientRect(); return {x:rect.left+rect.width/2,y:rect.top+rect.height/2}; })`);
  await command('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:centers.map((point,id)=>({...point,id,force:1,radiusX:3,radiusY:3}))}, guest);
  await until(host, 'received.some(e => e.code === "ArrowUp" && e.down) && received.some(e => e.code === "KeyZ" && e.down)', 'simultaneous touch D-pad and cross');
  await command('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]}, guest);
  await until(host, 'received.some(e => e.code === "ArrowUp" && !e.down)', 'touch releases keys');
  const center = await evaluate(guest, `(() => { const r = document.getElementById('sharedVideo').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  await command('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{...center,id:0,force:1}]}, guest);
  await until(host, 'receivedTouches?.length === 1 && Math.abs(receivedTouches[0].x-.5)<.02 && Math.abs(receivedTouches[0].y-.5)<.02', 'normalized touch on streamed game');
  await command('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]}, guest);
  await until(host, 'receivedTouches?.length === 0', 'native touch release');
  await command('Runtime.evaluate', {expression:'document.getElementById("sharedFullscreen").click()',userGesture:true}, guest);
  await until(guest, 'document.fullscreenElement?.id === "sharedPlayer"', 'player fullscreen');
  assert.ok(await evaluate(guest, `(() => { const r = document.getElementById('sharedVideoSurface').getBoundingClientRect(); return Math.abs(r.width-innerWidth)<=1 && Math.abs(r.height-innerHeight)<=1; })()`), 'Fullscreen game surface must fill the viewport');
  assert.equal(await evaluate(guest, 'document.querySelector(".shared-player-toolbar").inert && !document.getElementById("sharedHud").hidden'), true);
  await evaluate(guest, 'document.getElementById("sharedHud").click()');
  assert.equal(await evaluate(guest, 'document.querySelector(".shared-player-toolbar").inert'), false);
  await evaluate(guest, 'document.exitFullscreen()');
  await evaluate(guest, 'document.getElementById("sharedBack").click()');
  assert.equal(await evaluate(guest, 'document.getElementById("sharedPlayer").hidden && !document.getElementById("sharedResume").hidden'), true);
  await evaluate(guest, 'document.getElementById("sharedResume").click()');
  await evaluate(guest, 'document.getElementById("sharedVideo").dispatchEvent(new KeyboardEvent("keydown", {code:"KeyZ",bubbles:true}))');
  await evaluate(host, 'document.querySelector("#sharedMembers button").click()');
  await until(host, 'received.some(e => e.code === "KeyZ" && !e.down)', 'revocation releases input');
  if (realHost) console.log('MEDIA:', JSON.stringify(await evaluate(host, 'PPSSPPSharedBridge.captureState()')), JSON.stringify(await evaluate(guest, 'PPSSPPSharedDiagnostics.snapshot()')));
  await evaluate(host, 'document.getElementById("sharedStop").click()');
  await until(guest, 'document.getElementById("sharedPlayer").hidden && !document.getElementById("sharedVideo").srcObject', 'host stop teardown');
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  if (!dropOffer) console.log((realHost ? 'REAL WASM HOST: ' : '') + 'PASS: WebRTC media, multi-touch controls, video touch coordinates, fullscreen, dashboard return, revocation and teardown');
} finally {
  for (const p of pending.values()) clearTimeout(p.timer);
  socket?.close(); chrome?.kill(); relay?.kill();
  await new Promise(r => setTimeout(r, 300));
  await rm(directory, { recursive: true, force: true, maxRetries: 4 });
}
