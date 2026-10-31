#!/usr/bin/env node
// Compare WASM files, or complete build directories, with the same PSP demo.
// Usage: node scripts/benchmark-wasm-opt.mjs [optimized.wasm] [demo.pbp] [runs]
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, basename, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const build = resolve(process.env.PPSSPP_BENCH_BASELINE_BUILD || join(root, 'deps/ppsspp-wasm/build-wasm-release'));
const out = resolve(process.env.PPSSPP_BENCH_OUTPUT || join(root, 'artifacts/wasm-opt-benchmark'));
const variantName = process.env.PPSSPP_BENCH_VARIANT || 'o4';
if (!/^[a-z][a-z0-9-]*$/.test(variantName) || variantName === 'baseline') throw Error('Invalid variant name');
const variantBuild = process.env.PPSSPP_BENCH_VARIANT_BUILD && resolve(process.env.PPSSPP_BENCH_VARIANT_BUILD);
const optimized = resolve(process.argv[2] || join(out, 'PPSSPPSDL.o4.wasm'));
const game = resolve(process.argv[3] || join(root, 'deps/ppsspp-wasm/pspautotests/demos/cube.pbp'));
const mountedGame = '/demo' + (extname(game).toLowerCase() || '.pbp');
if (!/^\/demo\.[a-z0-9]+$/.test(mountedGame)) throw Error('Unsupported game filename extension');
const runs = Number(process.argv[4] || 3);
if (!Number.isInteger(runs) || runs < 1 || runs > 20) throw Error('Runs must be an integer from 1 to 20');
const warmupMs = Number(process.env.PPSSPP_BENCH_WARMUP_MS || 8000), sampleMs = 15000;
const realtime = process.env.PPSSPP_BENCH_REALTIME === '1';
if (!Number.isFinite(warmupMs) || warmupMs < 1000 || warmupMs > 120000) throw Error('Warmup must be between 1000 and 120000 ms');
await mkdir(out, { recursive: true });
const files = {
  baseline: await readFile(join(build, 'PPSSPPSDL.wasm')),
  [variantName]: await readFile(variantBuild ? join(variantBuild, 'PPSSPPSDL.wasm') : optimized),
  game: await readFile(game),
};
const glue = { baseline: await readFile(join(build, 'PPSSPPSDL.js')), [variantName]: await readFile(join(variantBuild || build, 'PPSSPPSDL.js')) };
const assets = { baseline: await readFile(join(build, 'PPSSPPSDL.data')), [variantName]: await readFile(join(variantBuild || build, 'PPSSPPSDL.data')) };
const html = `<!doctype html><canvas id="canvas" width="480" height="272"></canvas><script>
window.logs=[]; window.errors=[];
window.onerror=(...a)=>errors.push(String(a[0]));
var Module={canvas:document.querySelector('canvas'),
 arguments:['--appendconfig=/bench.ini',${JSON.stringify(mountedGame)}],
 locateFile:p=>(p.endsWith('.wasm')?'/core.wasm':p.endsWith('.data')?'/core.data':'/core.js')+'?variant='+new URLSearchParams(location.search).get('variant'),
 print:t=>logs.push(String(t)),printErr:t=>logs.push(String(t)),onAbort:t=>errors.push(String(t)),
 preRun:[()=>{addRunDependency('demo');fetch('/demo.pbp').then(r=>r.arrayBuffer()).then(b=>{
 FS.writeFile(${JSON.stringify(mountedGame)},new Uint8Array(b));
 FS.writeFile('/bench.ini','[General]\\nFirstRun = False\\nForceLagSync2 = False\\nEnableCheats = False\\n[Graphics]\\nInternalResolution = 1\\nFrameSkip = 0\\nAutoFrameSkip = False\\nHardwareTransform = True\\nSoftwareRenderer = False\\nVSyncInterval = False\\n[Sound]\\nEnable = False\\n[Control]\\nShowTouchControls = False\\n');
 if (${realtime}) FS.writeFile('/bench.ini',FS.readFile('/bench.ini',{encoding:'utf8'}).replace('ForceLagSync2 = False','ForceLagSync2 = True').replace('Enable = False','Enable = True'));
 removeRunDependency('demo');}).catch(e=>errors.push(String(e)));}]
};</script><script src="/core.js?variant=__VARIANT__"></script>`;
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const variant = url.searchParams.get('variant') || 'baseline';
  if (!['baseline', variantName].includes(variant)) { res.writeHead(404); res.end(); return; }
  let body, type;
  if (url.pathname === '/core.wasm') { body = files[variant]; type = 'application/wasm'; }
  else if (url.pathname === '/core.js') { body = glue[variant]; type = 'text/javascript'; }
  else if (url.pathname === '/core.data') { body = assets[variant]; type = 'application/octet-stream'; }
  else if (url.pathname === '/demo.pbp') { body = files.game; type = 'application/octet-stream'; }
  else { body = html.replace('__VARIANT__', variant); type = 'text/html'; }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' });
  res.end(body);
});
await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), 'ppsspp-opt-bench-'));
const headless = process.env.PPSSPP_BENCH_HEADLESS !== '0';
const captureName = basename(game) + (headless ? '-headless' : '');
const chrome = spawn('/usr/bin/google-chrome', [
  ...(headless ? ['--headless=new', '--use-angle=gl', '--ignore-gpu-blocklist'] : ['--ozone-platform=x11', '--ignore-gpu-blocklist']),
  '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0',
  '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
  '--mute-audio',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let socket, nextId = 0;
const pending = new Map();
const sleep = ms => new Promise(ok => setTimeout(ok, ms));
function command(method, params = {}, sessionId) {
  return new Promise((ok, fail) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); fail(Error('CDP timeout: ' + method)); }, 30000);
    pending.set(id, { ok, fail, timer }); socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function evaluate(session, expression) {
  const r = await command('Runtime.evaluate', { expression, returnByValue: true }, session);
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
const report = { date: new Date().toISOString(), game: basename(game), headless, warmupMs, sampleMs,
  gameSha256: createHash('sha256').update(files.game).digest('hex'),
  glueSha256: Object.fromEntries(Object.entries(glue).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])),
  assetsSha256: Object.fromEntries(Object.entries(assets).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])),
  settings: { soundEnabled: realtime, forceLagSync: realtime, internalResolution: 1, frameSkip: 0 },
  method: `Wall time inside Emscripten MainLoop.runIter; sound and ForceLagSync ${realtime ? 'enabled' : 'disabled'}; 1x resolution; no frame skipping. Includes host GL calls, excludes scheduling between callbacks. Not GPU timer or commercial-game FPS.`,
  binaries: {}, samples: [] };
let cachedSizes = {};
try { cachedSizes = JSON.parse(await readFile(join(out, 'binary-sizes.json'), 'utf8')); } catch {}
for (const variant of ['baseline', variantName]) {
  const sha256 = createHash('sha256').update(files[variant]).digest('hex');
  report.binaries[variant] = cachedSizes[variant]?.sha256 === sha256 ? cachedSizes[variant] : {
    bytes: files[variant].length, gzipBytes: gzipSync(files[variant], { level: 9 }).length,
    ...(process.env.PPSSPP_BENCH_SKIP_BROTLI === '1' ? {} : { brotliBytes: brotliCompressSync(files[variant]).length }), sha256,
  };
}
await writeFile(join(out, 'binary-sizes.json'), JSON.stringify(report.binaries, null, 2));
console.log(`Benchmark ${basename(game)}: ${runs} alternating pairs, ${warmupMs}ms warmup + ${sampleMs}ms capture`);
try {
  const ws = await new Promise((ok, fail) => {
    let log = '';
    const timer = setTimeout(() => fail(Error('Chrome startup: ' + log.slice(-2000))), 20000);
    chrome.stderr.on('data', chunk => { log += chunk; const m = log.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); ok(m[1]); } });
    chrome.once('error', e => { clearTimeout(timer); fail(e); });
    chrome.once('exit', code => { clearTimeout(timer); fail(Error(`Chrome exited ${code}: ${log.slice(-2000)}`)); });
  });
  socket = new WebSocket(ws);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });
  socket.onmessage = event => { const r = JSON.parse(event.data); if (!r.id) return; const p = pending.get(r.id); if (!p) return; pending.delete(r.id); clearTimeout(p.timer); r.error ? p.fail(Error(JSON.stringify(r.error))) : p.ok(r.result); };
  socket.onclose = () => { for (const p of pending.values()) { clearTimeout(p.timer); p.fail(Error('Chrome debugging connection closed')); } pending.clear(); };
  report.browser = await command('Browser.getVersion');
  for (let round = 0; round < runs; round++) {
    for (const variant of round % 2 ? [variantName, 'baseline'] : ['baseline', variantName]) {
      const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
      await command('Page.enable', {}, sessionId);
      await command('Page.navigate', { url: `${origin}/?variant=${variant}` }, sessionId);
      await command('Page.bringToFront', {}, sessionId);
      const deadline = Date.now() + 60000;
      let ready = false;
      while (Date.now() < deadline) {
        const state = await evaluate(sessionId, `({ready:typeof MainLoop!=='undefined'&&!!MainLoop.func,errors:window.errors,logs:window.logs?.slice(-8)})`);
        if (state.errors?.length) throw Error(JSON.stringify(state));
        if (state.ready) { ready = true; break; }
        await sleep(250);
      }
      if (!ready) throw Error('Game initialization timed out: ' + JSON.stringify(await evaluate(sessionId, '({errors,logs:logs.slice(-30)})')));
      await sleep(warmupMs);
      const environment = await evaluate(sessionId, `(()=>{const gl=GL.currentContext.GLctx;const ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),isolated:crossOriginIsolated,hardwareConcurrency:navigator.hardwareConcurrency,visibility:document.visibilityState,mainLoopTiming:{mode:MainLoop.timingMode,value:MainLoop.timingValue},booted:logs.some(line=>line.includes(${JSON.stringify('Booted ' + mountedGame)})),errors,logs:logs.slice(-30)}})()`);
      if (environment.visibility !== 'visible') throw Error('Benchmark page is hidden; foreground timing is required');
      if (environment.errors.length) throw Error('Game failed during warmup: ' + JSON.stringify(environment));
      if (!environment.booted) throw Error('Game did not boot: ' + JSON.stringify(environment));
      if (realtime) environment.audioContext = await evaluate(sessionId, `typeof SDL2!=='undefined'&&SDL2.audioContext?{state:SDL2.audioContext.state,sampleRate:SDL2.audioContext.sampleRate}:null`);
      if (realtime) {
        const before = await command('Page.captureScreenshot', { format: 'png' }, sessionId);
        await writeFile(join(out, `${captureName}-${variant}-${round}-before.png`), Buffer.from(before.data, 'base64'));
      }
      await evaluate(sessionId, `window.frameTimes=[];window.sampleStart=performance.now();window.originalRunIter=MainLoop.runIter;MainLoop.runIter=function(f){const t=performance.now();try{return originalRunIter.call(this,f)}finally{frameTimes.push(performance.now()-t)}}`);
      await sleep(sampleMs);
      const sample = await evaluate(sessionId, `(()=>{MainLoop.runIter=originalRunIter;const elapsed=performance.now()-sampleStart;const a=frameTimes.slice().sort((a,b)=>a-b);return {elapsedMs:elapsed,callbacks:a.length,callbacksPerSecond:a.length*1000/elapsed,meanMs:a.reduce((a,b)=>a+b,0)/a.length,medianMs:a[Math.floor(a.length/2)],p95Ms:a[Math.floor(a.length*.95)],frameTimes,errors}})()`);
      if (sample.errors.length || !sample.callbacks) throw Error('Invalid capture: ' + JSON.stringify(sample));
      report.samples.push({ round, variant, ...sample, environment });
      console.log(JSON.stringify({ round, variant, meanMs: sample.meanMs, medianMs: sample.medianMs, p95Ms: sample.p95Ms, callbacks: sample.callbacks, renderer: environment.renderer }));
      const { data } = await command('Page.captureScreenshot', { format: 'png' }, sessionId);
      await writeFile(join(out, `${captureName}-${variant}-${round}.png`), Buffer.from(data, 'base64'));
      await command('Target.closeTarget', { targetId });
      await writeFile(join(out, `${captureName}-results.json`), JSON.stringify(report, null, 2));
    }
  }
} catch (error) {
  report.error = error.stack;
  await writeFile(join(out, `${captureName}-results.json`), JSON.stringify(report, null, 2));
  throw error;
} finally {
  socket?.close(); chrome.kill('SIGTERM'); server.close();
  await sleep(1000);
  await rm(profile, { recursive: true, force: true, maxRetries: 3 });
}
