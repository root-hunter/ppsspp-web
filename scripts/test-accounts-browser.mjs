#!/usr/bin/env node
// Run after npm run build in wasm-page. Uses isolated Chromium storage contexts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'ppsspp-account-browser-'));
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
  throw new Error(`Timed out ${label}: ` + await evaluate(session, `JSON.stringify({ status: document.getElementById('accountStatus')?.textContent, identity: document.getElementById('accountIdentity')?.textContent })`));
}
try {
  relay = spawn('python3', ['-u', '-c', `import sys
from pathlib import Path
from functools import partial
sys.path.insert(0, 'server')
from accounts import Accounts
from serve import WasmThreadingHandler, WasmThreadingServer
root = Path.cwd()
data = Path(sys.argv[1])
games = data / 'games'
games.mkdir()
(games / 'Test.iso').write_bytes(b'browser-game-fixture')
store = Accounts(data / 'accounts', games)
store.set_password('alice', 'browser-alice-password')
store.set_password('bob', 'browser-bob-password')
server = WasmThreadingServer(('127.0.0.1', 0), partial(WasmThreadingHandler, web_root=str(root), wasm_root=str(root / 'deps' / 'ppsspp-wasm')))
server.accounts = store
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
    await until(sessionId, 'typeof accountInitialize === "function" && !!document.getElementById("accountLoginForm")', 'account UI');
    await evaluate(sessionId, 'accountBoot');
    return sessionId;
  }
  async function login(session, name) {
    await evaluate(session, `activatePanelTab('server'); document.getElementById('accountName').value = '${name}'; document.getElementById('accountPassword').value = 'browser-${name}-password'; document.getElementById('accountLoginForm').requestSubmit();`);
    await until(session, '!!serverAccount && !accountBusy && !accountBlocked', 'login and restore');
  }
  const alice = await browser();
  const path = '/home/web_user/.config/ppsspp/PSP/SAVEDATA/TEST/DATA.BIN';
  await evaluate(alice, `opfsPut('${path}', new TextEncoder().encode('guest'))`);
  await login(alice, 'alice');
  assert.equal(await evaluate(alice, '(await opfsWalk()).length'), 0, 'guest data must remain separate');
  await evaluate(alice, `await opfsPut('${path}', new TextEncoder().encode('alice-one')); await accountSync();`);
  assert.equal(await evaluate(alice, 'accountRevision'), 1);
  const fresh = await browser();
  await login(fresh, 'alice');
  assert.equal(await evaluate(fresh, `new TextDecoder().decode(await opfsRead('${path}'))`), 'alice-one', 'fresh browser restores account saves');
  await evaluate(fresh, 'document.querySelector("#accountGames button").click()');
  await until(fresh, 'document.getElementById("accountStatus").textContent.includes("installed.")', 'streamed game install');
  assert.equal(await evaluate(fresh, 'new TextDecoder().decode(await opfsReadGame("Test.iso"))'), 'browser-game-fixture');
  await evaluate(alice, `await opfsPut('${path}', new TextEncoder().encode('alice-two')); await accountSync();`);
  const conflict = await evaluate(fresh, `await (async () => { await opfsPut('${path}', new TextEncoder().encode('stale')); try { await accountSync(); return ''; } catch(e) { return e.message; } })()`);
  assert.match(conflict, /another browser/);
  const bob = await browser();
  await login(bob, 'bob');
  assert.equal(await evaluate(bob, '(await opfsWalk()).length'), 0, 'Bob must not inherit Alice saves');
  // Same browser: logout and login under a different account must select a new profile.
  await evaluate(bob, `document.getElementById('accountLogout').click()`);
  await until(bob, 'typeof accountInitialize === "function" && !serverAccount && !accountBusy && !document.getElementById("accountLoginForm").hidden', 'sign out and reload');
  await login(bob, 'alice');
  assert.equal(await evaluate(bob, `new TextDecoder().decode(await opfsRead('${path}'))`), 'alice-two');
  await command('Page.reload', {}, bob);
  await until(bob, 'typeof accountInitialize === "function" && !!serverAccount && !accountBlocked', 'remembered account reload');
  assert.equal(await evaluate(bob, `new TextDecoder().decode(await opfsRead('${path}'))`), 'alice-two');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('PASS: guest isolation, fresh-browser restore, per-user saves, streamed server game, stale-browser conflict, account switch and reload');
} finally {
  for (const p of pending.values()) clearTimeout(p.timer);
  socket?.close(); chrome?.kill(); relay?.kill();
  await new Promise(r => setTimeout(r, 300));
  await rm(directory, { recursive: true, force: true, maxRetries: 4 });
}
