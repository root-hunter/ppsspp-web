#!/usr/bin/env node
// Profile an already running PPSSPP page. Requires Node 22+ and Chrome CDP.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, index, args) => {
  if (index % 2 === 0) pairs.push([arg, args[index + 1]]);
  return pairs;
}, []));
const seconds = Number(options['--seconds'] ?? 20);
const port = Number(options['--port'] ?? 9222);
if (!Number.isFinite(seconds) || seconds < 1 || seconds > 120 || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Usage: node scripts/profile-browser.mjs --port 9222 --seconds 20 --out artifacts/profile');
}
const output = resolve(options['--out'] ?? 'artifacts/browser-profile');
const response = await fetch(`http://127.0.0.1:${port}/json`);
if (!response.ok) throw new Error(`DevTools discovery failed: ${response.status}`);
const pages = await response.json();
const page = pages.find(p => p.type === 'page' && /^https?:/.test(p.url) && p.title.includes('God of War'))
  ?? pages.find(p => p.type === 'page' && /^https?:/.test(p.url));
if (!page) throw new Error('Open the PPSSPP page in the Chrome debugging instance first.');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((accept, reject) => {
  socket.addEventListener('open', accept, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timer);
  if (message.error) request.reject(new Error(JSON.stringify(message.error)));
  else request.accept(message.result);
});
function command(method, params = {}) {
  return new Promise((accept, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`DevTools timeout: ${method}`));
    }, 30000);
    pending.set(id, { accept, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function snapshot() {
  const result = await command('Runtime.evaluate', {
    returnByValue: true,
    expression: `({
      ready: typeof runtimeReady !== 'undefined' && runtimeReady,
      failed: typeof runtimeFailed !== 'undefined' && runtimeFailed,
      renderer: document.querySelector('#iRenderer')?.textContent,
      browser: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
      isolated: crossOriginIsolated,
      audio: typeof audioDebug !== 'undefined' ? {...audioDebug} : null,
      timing: typeof WEB_NATIVE_TIMING_CONFIG !== 'undefined' ? WEB_NATIVE_TIMING_CONFIG : null,
    })`,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
let profiling = false;
try {
  const before = await snapshot();
  if (!before.ready || before.failed) throw new Error('Start PPSSPP and reach the desired scene before capturing.');
  await mkdir(dirname(output), { recursive: true });
  await command('Profiler.enable');
  await command('Profiler.setSamplingInterval', { interval: 1000 });
  await command('Profiler.start');
  profiling = true;
  console.log(`Capturing ${seconds}s of ${page.title}; renderer: ${before.renderer}`);
  await new Promise(accept => setTimeout(accept, seconds * 1000));
  const { profile } = await command('Profiler.stop');
  profiling = false;
  const after = await snapshot();
  const { data } = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile(output + '.cpuprofile', JSON.stringify(profile));
  await writeFile(output + '.png', Buffer.from(data, 'base64'));
  await writeFile(output + '.json', JSON.stringify({
    date: new Date().toISOString(), title: page.title,
    durationSeconds: (profile.endTime - profile.startTime) / 1e6,
    before, after,
    underrunDelta: before.audio && after.audio ? after.audio.underruns - before.audio.underruns : null,
  }, null, 2));
  console.log(`Saved ${output}.{cpuprofile,png,json}. Open the CPU profile in Chrome DevTools Performance.`);
} finally {
  if (profiling) await command('Profiler.stop').catch(() => {});
  await command('Profiler.disable').catch(() => {});
  socket.close();
}
