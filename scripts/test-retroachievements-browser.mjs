#!/usr/bin/env node
// Run after npm run build in wasm-page. Uses isolated Chromium storage contexts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'ppsspp-achievements-browser-'));
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
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, replMode: true }, session);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(session, expression, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(session, expression)) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`Timed out ${label}: ` + await evaluate(session, `JSON.stringify({ status: document.getElementById('achievementsStatus')?.textContent })`));
}
try {
  relay = spawn('python3', ['-u', '-c', `import sys
from pathlib import Path
from functools import partial
sys.path.insert(0, 'server')
from serve import WasmThreadingHandler, WasmThreadingServer
root = Path.cwd()
server = WasmThreadingServer(('127.0.0.1', 0), partial(WasmThreadingHandler, web_root=str(root), wasm_root=str(root / 'deps' / 'ppsspp-wasm')))
print('PORT=' + str(server.server_address[1]), flush=True)
server.serve_forever()`, directory], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const port = await lineFrom(relay, /PORT=(\d+)/);
  const origin = `http://127.0.0.1:${port}`;
  chrome = spawn(process.env.CHROME || '/usr/bin/google-chrome', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=0', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await lineFrom(chrome, /DevTools listening on (ws:\/\/\S+)/);
  socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const p = pending.get(message.id); if (!p) return;
      pending.delete(message.id); clearTimeout(p.timer);
      message.error ? p.reject(new Error(JSON.stringify(message.error))) : p.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  };
  async function browser() {
    const { browserContextId } = await command('Target.createBrowserContext');
    const { targetId } = await command('Target.createTarget', { browserContextId, url: origin });
    const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
    await command('Runtime.enable', {}, sessionId);
    await until(sessionId, 'typeof renderAchievements === "function" && !!document.getElementById("achievementsLoginForm")', 'achievements UI');
    await evaluate(sessionId, 'accountBoot');
    return sessionId;
  }
  const session = await browser();
  await evaluate(session, `activatePanelTab('achievements')`);
  assert.match(await evaluate(session, `document.getElementById('achievementsStatus').textContent`), /start PPSSPP/i);
  await evaluate(session, `document.getElementById('achievementsEnabled').checked = true; document.getElementById('achievementsSettings').requestSubmit()`);
  assert.equal(await evaluate(session, `achievementsConfig().enabled`), true);
  await evaluate(session, `
    runtimeReady = true; started = true; menuSuspended = true;
    window.raCalls = []; window.raPolls = 0;
    window.Module = {
      retroAchievementsState: { enabled: true, hardcore: false, inGame: false, busy: false, loggedIn: false, username: '', achievements: [] },
      _PPSSPP_AchievementsLogin() {}, _PPSSPP_AchievementsSettings() {}, _PPSSPP_AchievementsLogout() {},
      _PPSSPP_AchievementsPoll() { window.raPolls++; },
      ccall(name, result, types, values) {
        window.raCalls.push({name, types});
        const state = this.retroAchievementsState;
        if (name.endsWith('Settings')) { state.enabled = !!values[0]; state.hardcore = !!values[1]; }
        if (name.endsWith('Login')) { state.loggedIn = true; state.username = values[0]; }
        if (name.endsWith('Logout')) { state.loggedIn = false; state.username = ''; }
      }
    }; renderAchievements();
  `);
  assert.ok(await evaluate(session, `window.raPolls > 0`), 'paused native menu must still service login');
  await evaluate(session, `document.getElementById('achievementsHardcore').checked = true; renderAchievements()`);
  assert.equal(await evaluate(session, `document.getElementById('achievementsHardcore').checked`), true, 'polling must preserve unsaved choices');
  await evaluate(session, `document.getElementById('achievementsSettings').requestSubmit(); renderAchievements()`);
  assert.equal(await evaluate(session, `Module.retroAchievementsState.hardcore`), true);
  await evaluate(session, `document.getElementById('achievementsUsername').value = 'alice'; document.getElementById('achievementsPassword').value = 'test-password'; document.getElementById('achievementsLoginForm').requestSubmit(); renderAchievements()`);
  assert.equal(await evaluate(session, `document.getElementById('achievementsPassword').value`), '');
  assert.match(await evaluate(session, `document.getElementById('achievementsStatus').textContent`), /Connected as alice/);
  await evaluate(session, `Object.assign(Module.retroAchievementsState, { inGame: true, hardcoreActive: true, gameId: 1, game: 'Test game', total: 2, unlocked: 1, points: 5, achievements: [{ id: 1, title: '<img src=x onerror=alert(1)>', description: 'First objective', points: 5, unlocked: true }] }); renderAchievements()`);
  for (const id of ['achievementsSave', 'achievementsLogin', 'achievementsLogout', 'achievementsEnabled', 'achievementsHardcore']) {
    assert.equal(await evaluate(session, `document.getElementById('${id}').disabled`), true, id + ' must lock during play');
  }
  assert.equal(await evaluate(session, `document.querySelectorAll('#achievementsList img').length`), 0, 'server titles are plain text');
  assert.match(await evaluate(session, `document.getElementById('achievementsGame').textContent`), /1\/2 unlocked/);
  await evaluate(session, `Module.retroAchievementsState.inGame = false; renderAchievements(); document.getElementById('achievementsLogout').click(); renderAchievements()`);
  assert.equal(await evaluate(session, `Module.retroAchievementsState.loggedIn`), false);
  const response = await evaluate(session, `await (async () => { const r = await fetch('/api/retroachievements?url=' + encodeURIComponent('https://evil.test/private'), { method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: 'r=login2' }); return {status:r.status, cache:r.headers.get('Cache-Control'), cors:r.headers.get('Access-Control-Allow-Origin')}; })()`);
  assert.deepEqual(response, {status:400, cache:'no-store', cors:'*'});
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('PASS: achievements settings, paused-loop polling, native login/logout bridge, password clearing, Hardcore locks, safe rendering and gateway rejection');
} finally {
  for (const p of pending.values()) clearTimeout(p.timer);
  socket?.close(); chrome?.kill(); relay?.kill();
  await new Promise(r => setTimeout(r, 300));
  await rm(directory, { recursive: true, force: true, maxRetries: 4 });
}
