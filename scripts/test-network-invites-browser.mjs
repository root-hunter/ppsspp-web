#!/usr/bin/env node
// Built frontend QR generation/import and camera lifecycle in real Chromium.
// No test framework dependency; uses Chrome DevTools Protocol and Node WebSocket.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const origin = 'http://127.0.0.1:18089';
const root = resolve(new URL('..', import.meta.url).pathname);
const server = spawn('python3', ['server/serve.py', '--bind', '127.0.0.1', '--port', '18089', '--adhoc-ws', '--adhoc-ws-port', '0'], {
  cwd: root, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, RELAY_AUTH_MODE: 'open' },
});
const profile = await mkdtemp(join(tmpdir(), 'ppsspp-adhoc-'));
const headless = true;
const chrome = spawn(process.env.CHROME || '/usr/bin/google-chrome', [
  ...(headless ? ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-software-rasterizer', '--ozone-platform=x11']),
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  '--no-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors', '--remote-debugging-port=0',
  '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
const pending = new Map(); let nextId = 0;
const events = []; const contexts = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, label, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { const value = await fn(); if (value) return value; await sleep(50); }
  throw new Error(`Timed out: ${label}`);
}
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function evaluate(session, expression) {
  const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
try {
  const wsUrl = await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error('Chrome startup timeout: ' + log.slice(-2000))), 20000);
    chrome.stderr.on('data', chunk => { log += chunk; const m = log.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
    chrome.once('error', reject);
    chrome.once('exit', code => { clearTimeout(timer); reject(new Error(`Chrome exited: ${code}: ${log.slice(-2000)}`)); });
  });
  socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const r = JSON.parse(event.data);
    if (r.id) { const p = pending.get(r.id); if (!p) return; pending.delete(r.id); clearTimeout(p.timer); r.error ? p.reject(new Error(JSON.stringify(r.error))) : p.resolve(r.result); }
    else if (r.method === 'Runtime.exceptionThrown') events.push(r.params.exceptionDetails);
  };
  await waitFor(async () => { try { return (await fetch(origin + '/healthz')).ok; } catch { return false; } }, 'HTTP server');
  const { browserContextId } = await command('Target.createBrowserContext'); contexts.push(browserContextId);
  const { targetId } = await command('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  await command('Page.enable', {}, sessionId);
  await command('Page.navigate', { url: origin }, sessionId);
  await waitFor(() => evaluate(sessionId, '!!window.PPSSPPNetworkInvites'), 'network UI');
  assert.equal(await evaluate(sessionId, "document.getElementById('networkUseThisHostBtn') === null"), true);
  assert.equal(await evaluate(sessionId, "document.getElementById('networkStatusTitle').textContent"), 'Multiplayer disabled');
  await evaluate(sessionId, `{
    document.getElementById('networkEnableToggle').checked=true;
    document.getElementById('networkServerInput').value='ws://127.0.0.1:18089/missing';
    document.getElementById('networkTestBtn').click();
  }`);
  await waitFor(() => evaluate(sessionId, "document.getElementById('networkStatus').dataset.tone === 'error'"), 'failed connection indicator');
  await evaluate(sessionId, `{
    document.getElementById('networkServerInput').value='ws://127.0.0.1:18089/adhoc';
    document.getElementById('networkTestBtn').click();
  }`);
  await waitFor(() => evaluate(sessionId, "document.getElementById('networkStatus').dataset.tone === 'ready'"), 'reachable relay indicator');
  assert.equal(await evaluate(sessionId, "document.getElementById('networkStatusTitle').textContent"), 'Relay reachable · game not connected');
  await command('Emulation.setDeviceMetricsOverride', {width:390, height:844, deviceScaleFactor:1, mobile:true}, sessionId);
  await evaluate(sessionId, "setPanelOpen(true, false); activatePanelTab('network')");
  assert.equal(await evaluate(sessionId, "document.getElementById('networkPanel').scrollWidth <= document.getElementById('networkPanel').clientWidth"), true);
  if (process.env.PPSSPP_PANEL_SCREENSHOT) {
    const shot = await command('Page.captureScreenshot', {format:'png'}, sessionId);
    await writeFile(process.env.PPSSPP_PANEL_SCREENSHOT, Buffer.from(shot.data, 'base64'));
  }
  // Drive the real transport against the real relay, without loading a game.
  await evaluate(sessionId, `{
    window.SOCKFS = { websocket_sock_ops: Object.fromEntries(['bind','connect','listen','accept','getname','poll','sendmsg','recvmsg','close'].map(k => [k, () => {}])), emit() {} };
    window.FS = { ErrnoError: class extends Error { constructor(errno) { super(String(errno)); this.errno = errno; } } };
    if (!installSockFSAdhocRelay()) throw Error('Transport installation failed');
    window.statusSocket = {type:1, stream:{fd:999}, recv_queue:[], __ppssppAdhoc:true, __ppssppControl:true};
    try { SOCKFS.websocket_sock_ops.connect(window.statusSocket, 'relay', 27312); } catch (e) { if(e.errno!==26) throw e; }
  }`);
  await waitFor(() => evaluate(sessionId, 'window.statusSocket.__relay.ws.readyState === WebSocket.OPEN'), 'live control socket');
  await evaluate(sessionId, `{
    const packet=new Uint8Array(144); packet[0]=1;
    packet.set(loadNetworkConfig().mac.split(':').map(v => parseInt(v,16)),1);
    packet.set(new TextEncoder().encode('StatusTest'),7); packet.set(new TextEncoder().encode('ULUS10466'),135);
    window.statusSocket.__relay.ws.send(packet);
  }`);
  await waitFor(() => evaluate(sessionId, "document.getElementById('networkStatus').dataset.tone === 'good'"), 'registered game indicator');
  await evaluate(sessionId, "document.getElementById('networkDisconnectBtn').click()");
  await waitFor(() => evaluate(sessionId, "document.getElementById('networkStatusTitle').textContent === 'Disconnected'"), 'intentional disconnection indicator');
  await evaluate(sessionId, 'window.ppssppAdhocTransport.destroy(); delete window.ppssppAdhocTransport;');
  await evaluate(sessionId, `{
    document.getElementById('networkServerInput').value='ws://friends.test/adhoc';
    document.getElementById('networkRoomInput').value='friday';
    document.getElementById('networkSessionKeyInput').value='test-user-key';
    document.getElementById('networkInvitePanel').open=true;
    document.getElementById('networkInviteIncludeKey').checked=true;
    document.getElementById('networkInviteCreateBtn').click();
  }`);
  await waitFor(() => evaluate(sessionId, "!document.getElementById('networkInviteQr').hidden"), 'QR generation');
  assert.equal(await evaluate(sessionId, `new URL(window.PPSSPPNetworkInvites.create()).hash.includes('session_key')`), false);
  const invite = await evaluate(sessionId, "document.getElementById('networkInviteLink').value");
  const params = new URLSearchParams(new URL(invite).hash.slice(1));
  assert.equal(params.get('room'), 'friday');
  assert.equal(params.get('session_key'), 'test-user-key');
  assert.equal(params.get('relay'), 'ws://friends.test/adhoc');
  assert.equal(params.has('mac'), false);
  await evaluate(sessionId, `(async () => {
    document.getElementById('networkRoomInput').value='different';
    const png = await new Promise(resolve => document.getElementById('networkInviteQr').toBlob(resolve));
    const transfer=new DataTransfer(); transfer.items.add(new File([png], 'invitation.png', {type:'image/png'}));
    const input=document.getElementById('networkInviteImageInput'); input.files=transfer.files;
    input.dispatchEvent(new Event('change'));
  })()`);
  await waitFor(() => evaluate(sessionId, "document.getElementById('networkInviteStatus').textContent.includes('Invitation imported')"), 'QR image decoding');
  assert.equal(await evaluate(sessionId, "document.getElementById('networkRoomInput').value"), 'friday');
  assert.equal(await evaluate(sessionId, "document.getElementById('networkEnableToggle').checked"), true);
  await evaluate(sessionId, "document.getElementById('networkInviteScanBtn').click()");
  await waitFor(() => evaluate(sessionId, "!!document.getElementById('networkInviteVideo').srcObject"), 'camera stream');
  await evaluate(sessionId, `window.cameraTrack = document.getElementById('networkInviteVideo').srcObject.getTracks()[0]; document.getElementById('networkInviteStopBtn').click()`);
  assert.equal(await evaluate(sessionId, 'window.cameraTrack.readyState'), 'ended');
  // A new tab opened on the invitation must import it and clean the fragment.
  const next = await command('Target.createTarget', { url: invite, browserContextId });
  const attached = await command('Target.attachToTarget', { targetId: next.targetId, flatten: true });
  await waitFor(() => evaluate(attached.sessionId, '!!window.PPSSPPNetworkInvites'), 'invitation startup import');
  assert.equal(await evaluate(attached.sessionId, 'location.hash'), '');
  assert.equal(await evaluate(attached.sessionId, "document.getElementById('networkSessionKeyInput').value"), 'test-user-key');
  assert.equal(await evaluate(attached.sessionId, "document.getElementById('networkRoomInput').value"), 'friday');
  console.log('PASS: relay failure/reachability/live registration/disconnection indicators; QR creation, image import, network enablement, camera release and invitation URL import');
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    for (const id of contexts) await command('Target.disposeBrowserContext', { browserContextId: id }).catch(() => {});
    socket.close();
  }
  chrome.kill('SIGTERM');
  server.kill('SIGTERM');
  for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Browser test ended')); }
  await sleep(500); await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}
