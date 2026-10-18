#!/usr/bin/env node
// Two isolated Chromium contexts, real PPSSPP WASM socket syscalls, real WSS.
// No test framework dependency; uses Chrome DevTools Protocol and Node WebSocket.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const origin = process.env.PPSSPP_TEST_ORIGIN || 'https://127.0.0.1:8081';
const build = process.env.PPSSPP_TEST_BUILD || '/build-wasm-multiplayer/';
const profile = await mkdtemp(join(tmpdir(), 'ppsspp-adhoc-'));
const headless = process.env.PPSSPP_TEST_HEADLESS !== '0';
const chrome = spawn(process.env.CHROME || '/usr/bin/google-chrome', [
  ...(headless ? ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-software-rasterizer', '--ozone-platform=x11']),
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
  const sessions = [];
  for (const mac of ['02:00:00:00:00:01', '02:00:00:00:00:02']) {
    const { browserContextId } = await command('Target.createBrowserContext'); contexts.push(browserContextId);
    const { targetId } = await command('Target.createTarget', { url: 'about:blank', browserContextId, newWindow: !headless });
    const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
    sessions.push(sessionId); await command('Runtime.enable', {}, sessionId);
    await command('Page.enable', {}, sessionId);
    await command('Page.navigate', { url: `${origin}/adhoc-test.html?mac=${mac}&build=${encodeURIComponent(build)}` }, sessionId);
    await waitFor(() => evaluate(sessionId, `window.probeError ? (()=>{throw Error(window.probeError)})() : !!window.probeReady`), 'real WASM initialization', 120000);
    assert.equal(await evaluate(sessionId, 'crossOriginIsolated'), true);
    await evaluate(sessionId, `window.ctrl = probe(0,1,0,0,1); window.connectResult = probe(2,ctrl,0x7f000001,27312,0)`);
    await waitFor(() => evaluate(sessionId, '(probe(9,ctrl,0,0,4)&4)!==0'), 'WSS control open');
    await evaluate(sessionId, `{
      const data = new Uint8Array(144); data[0]=1;
      data.set(config.mac.split(':').map(x=>parseInt(x,16)),1);
      data.set(new TextEncoder().encode('WASM probe'),7); data.set(new TextEncoder().encode('ULUS10466'),135);
      writeProbe(data); if(probe(5,ctrl,0,0,data.length)!==144) throw Error('login send');
    }`);
    await waitFor(() => evaluate(sessionId, "transport.snapshot().state==='registered'"), 'PRO registration');
    await evaluate(sessionId, `writeProbe([2,...new TextEncoder().encode('TEKKEN'),0,0]); if(probe(5,ctrl,0,0,9)!==9) throw Error('join send')`);
  }
  const [a, b] = sessions;
  for (const s of sessions) await waitFor(() => evaluate(s, 'transport.snapshot().peers.length === 1'), 'peer discovery');
  // Validate PRO bytes received through WASM, not only transport instrumentation.
  for (const s of sessions) {
    const notification = await evaluate(s, '(()=>{const n=probe(7,ctrl,0,0,2);return {n,bytes:readProbe(n)}})()');
    assert.ok(notification.n >= 7); assert.ok([2, 6].includes(notification.bytes[0]));
    await evaluate(s, 'probe(7,ctrl,0,0,0)');
    await evaluate(s, 'window.udp=probe(0,2,0,0,0); if(probe(1,udp,0,13000,0)!==0)throw Error("PDP bind")');
    await waitFor(() => evaluate(s, '(probe(9,udp,0,0,4)&4)!==0'), 'PDP endpoint open');
    assert.equal(await evaluate(s, 'probe(7,udp,0,0,0)'), -6); // EAGAIN, never blocks.
  }
  const ipA = await evaluate(a, 'probe(10,ctrl,0,0,0)');
  const ipB = await evaluate(b, 'probe(10,ctrl,0,0,0)');
  assert.notEqual(ipA, ipB);
  async function send(s, fd, text, ip = 0, port = 0, datagram = false) {
    return evaluate(s, `(()=>{const d=new TextEncoder().encode(${JSON.stringify(text)});writeProbe(d);return probe(${datagram ? 6 : 5},${fd},${ip},${port},d.length)})()`);
  }
  async function receive(s, fd, expected) {
    await waitFor(() => evaluate(s, `(probe(9,${fd},0,0,1)&1)!==0`), 'packet receive');
    const value = await evaluate(s, `(()=>{const n=probe(7,${fd},0,0,0);if(n<0)throw Error('recv '+n);return new TextDecoder().decode(new Uint8Array(readProbe(n)))})()`);
    assert.equal(value, expected);
  }
  const rtts = [];
  for (let i = 0; i < 20; i++) {
    const text = 'PDP:' + i;
    const start = performance.now();
    await send(a, 'udp', text, ipB, 13000, true); await receive(b, 'udp', text);
    await send(b, 'udp', text, ipA, 13000, true); await receive(a, 'udp', text);
    rtts.push(performance.now() - start);
  }
  await send(a, 'udp', 'broadcast', 0xffffffff, 13000, true); await receive(b, 'udp', 'broadcast');
  // Queue two datagrams before receiving and verify boundaries and order.
  await send(a, 'udp', 'first', ipB, 13000, true); await send(a, 'udp', 'second', ipB, 13000, true);
  await receive(b, 'udp', 'first'); await receive(b, 'udp', 'second');
  await evaluate(b, 'window.listener=probe(0,1,0,0,0);probe(1,listener,0,14000,0);probe(3,listener,0,0,16)');
  await waitFor(() => evaluate(b, "Module.SOCKFS.getSocket(listener).__relay?.ws?.readyState===WebSocket.OPEN"), 'PTP listener ready');
  await evaluate(a, `window.ptp=probe(0,1,0,0,0);probe(1,ptp,0,15000,0);probe(2,ptp,${ipB},14000,0)`);
  await waitFor(() => evaluate(b, '(probe(9,listener,0,0,1)&1)!==0'), 'PTP accept');
  await evaluate(b, 'window.accepted=probe(4,listener,0,0,0)');
  await waitFor(() => evaluate(a, '(probe(9,ptp,0,0,4)&4)!==0'), 'PTP connect');
  await send(a, 'ptp', 'stream-a'); await receive(b, 'accepted', 'stream-a');
  await send(b, 'accepted', 'stream-b'); await receive(a, 'ptp', 'stream-b');
  await evaluate(b, 'probe(8,accepted,0,0,0)');
  await waitFor(() => evaluate(a, '(probe(9,ptp,0,0,16)&16)!==0'), 'PTP disconnect');
  for (const s of sessions) await waitFor(() => evaluate(s, "transport.snapshot().rttMs !== null"), 'heartbeat RTT measurement');
  const snapshots = await Promise.all(sessions.map(s => evaluate(s, 'transport.snapshot()')));
  for (const s of sessions) await evaluate(s, 'transport.disconnect()');
  const frontend = [];
  for (const [i, session] of sessions.entries()) {
    await command('Page.navigate', { url: origin + '/' }, session);
    await waitFor(() => evaluate(session, "typeof loadNetworkConfig === 'function' && !!document.querySelector('#startBtn')"), 'Angular multiplayer UI');
    // Explicitly select the instrumented build under test, rather than an old
    // release build which may already be mounted alongside it.
    await evaluate(session, `selectBuildDir = async () => setBuildDir(${JSON.stringify(build)});
      networkEnableToggle.checked=${i === 0}; networkServerInput.value=${JSON.stringify(origin + '/adhoc')};
      networkNickInput.value='BrowserUI'; document.querySelector('#networkRoomInput').value='ui-probe';
      saveNetworkConfigFromUI();`);
    if (i === 1) {
      const { root } = await command('DOM.getDocument', {}, session);
      const { nodeId } = await command('DOM.querySelector', { nodeId: root.nodeId, selector: '#gameFile' }, session);
      await command('DOM.setFileInputFiles', { nodeId, files: [resolve('deps/ppsspp-wasm/pspautotests/input/cube.cso')] }, session);
      await waitFor(() => evaluate(session, "selectedGame?.name === 'cube.cso'"), 'legal homebrew file selection');
    }
    await command('Runtime.evaluate', { expression: "document.querySelector('#startBtn').click()", userGesture: true }, session);
    await waitFor(() => evaluate(session, "runtimeFailed ? (()=>{throw Error(document.querySelector('#statusText')?.textContent || 'Runtime failed')})() : runtimeReady"), 'frontend core startup', 120000);
    const details = await evaluate(session, `(()=>{
      const ini = new TextDecoder().decode(Module.FS.readFile('/home/web_user/.config/ppsspp/PSP/SYSTEM/ppsspp.ini'));
      return { enabled: loadNetworkConfig().enabled, ini, hooked: !!window.ppssppAdhocTransport,
        reconnectExport: typeof Module._ppssppAdhocReconnect === 'function', build: BUILD_DIR, game: Module.arguments.at(-1) };
    })()`);
    assert.match(details.ini, new RegExp('EnableWlan = ' + (i === 0 ? 'True' : 'False')));
    assert.equal(details.hooked, i === 0);
    assert.equal(details.reconnectExport, true);
    const nativeConfig = await evaluate(session, `(()=>{
      const wlan=Module._ppssppNetProbe(11,0,0,0,0), mode=Module._ppssppNetProbe(14,0,0,0,0);
      const n=Module._ppssppNetProbe(12,0,0,0,0);
      const nick=new TextDecoder().decode(new Uint8Array(Array.from({length:n},(_,i)=>Module._ppssppNetProbeByte(i,-1))));
      return { wlan, mode, nick };
    })()`);
    assert.equal(nativeConfig.wlan, i === 0 ? 1 : 0); assert.equal(nativeConfig.mode, 2); assert.equal(nativeConfig.nick, 'BrowserUI');
    if(i === 1) await waitFor(() => evaluate(session, 'Module._ppssppNetProbe(15,0,0,0,0)===1'), 'single-player homebrew boot', 30000);
    if (i === 0) { assert.match(details.ini, /NickName = BrowserUI/); assert.match(details.ini, /AdhocServerRelayMode = 2/); }
    else assert.match(details.game, /cube\.cso/);
    frontend.push({ enabled: details.enabled, hooked: details.hooked, build: details.build, game: details.game, nativeConfig, homebrewBooted: i === 1, settingsAppliedToCore: true });
  }
  assert.equal(events.length, 0, JSON.stringify(events));
  const report = { passed: true, type: 'protocol integration; not Tekken gameplay', realWasm: true, twoIsolatedContexts: true,
    origin, build, headless, frontend, pdpEchoSamples: rtts.length, cdpInclusiveRttMs: { min: Math.min(...rtts), mean: rtts.reduce((a,b)=>a+b,0)/rtts.length, max: Math.max(...rtts) }, snapshots };
  await writeFile(process.env.PPSSPP_TEST_REPORT || '/tmp/ppsspp-multiplayer-browser.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    for (const id of contexts) await command('Target.disposeBrowserContext', { browserContextId: id }).catch(() => {});
    socket.close();
  }
  chrome.kill('SIGTERM');
  for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Browser test ended')); }
  await sleep(500); await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}
