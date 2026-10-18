import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// Load the actual runtime functions without running browser startup side effects.
const source = readFileSync(new URL('../public/ppsspp-runtime.js', import.meta.url), 'utf8');
const ast = ts.createSourceFile('runtime.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function load(names, globals = {}, declarations = '') {
  const code = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)).map(n => n.getText(ast)).join('\n');
  const context = vm.createContext({ Blob, TextDecoder, TextEncoder, Uint8Array, DataView, Map, Set, console, ...globals });
  vm.runInContext(declarations + '\n' + code, context);
  return context;
}

test('import stores the File/Blob directly and never enables startup preload', async () => {
  const blob = new Blob(['not an ISO']);
  blob.arrayBuffer = () => { throw new Error('whole-file allocation'); };
  let stored;
  const ctx = load(['opfsPutGame', 'writeOpfsHandle'], {
    OPFS_GAMES_DIR: 'games',
    opfsParent: async () => ({ name: 'game.cso', dir: { getFileHandle: async () => ({ createWritable: async () => ({ write: async value => { stored = value; }, close: async () => {} }) }) } }),
    writeGameMetadata: async () => {}, log: () => {},
    setPreloadFavorite: () => { throw new Error('implicit preload'); },
  });
  assert.equal(await ctx.opfsPutGame('game.cso', blob), 'game.cso');
  assert.equal(stored, blob);
});

function isoFixture() {
  const bytes = new Uint8Array(24 * 2048);
  const view = new DataView(bytes.buffer);
  const record = (offset, sector, size, name, dir) => {
    const length = 33 + name.length + (name.length % 2 === 0 ? 1 : 0);
    bytes[offset] = length; view.setUint32(offset + 2, sector, true); view.setUint32(offset + 10, size, true);
    bytes[offset + 25] = dir ? 2 : 0; bytes[offset + 32] = name.length;
    bytes.set(new TextEncoder().encode(name), offset + 33);
  };
  bytes[16 * 2048] = 1; bytes.set(new TextEncoder().encode('CD001'), 16 * 2048 + 1);
  record(16 * 2048 + 156, 20, 2048, '\0', true);
  record(20 * 2048, 21, 2048, 'PSP_GAME', true);
  record(21 * 2048, 22, 4, 'ICON0.PNG;1', false);
  bytes.set([137,80,78,71], 22 * 2048);
  return bytes;
}

test('ISO metadata reads only bounded extents, never the whole Blob', async () => {
  const blob = new Blob([isoFixture()]);
  blob.arrayBuffer = () => { throw new Error('whole-file allocation'); };
  let readBytes = 0;
  const slice = blob.slice.bind(blob);
  blob.slice = (start, end) => { readBytes += end - start; return slice(start, end); };
  const ctx = load(['isoFindBlobEntry', 'readIsoDirRecord']);
  assert.deepEqual(Array.from(await ctx.isoFindBlobEntry(blob, 'PSP_GAME/ICON0.PNG')), [137,80,78,71]);
  assert.equal(readBytes, 3 * 2048 + 4);
  assert.equal(await ctx.isoFindBlobEntry(blob, 'PSP_GAME/ABSENT'), null);
});

test('malformed ISO extents cannot request an unbounded allocation', async () => {
  const bytes = isoFixture();
  new DataView(bytes.buffer).setUint32(16 * 2048 + 156 + 10, 0xffffffff, true);
  const ctx = load(['isoFindBlobEntry', 'readIsoDirRecord']);
  await assert.rejects(ctx.isoFindBlobEntry(new Blob([bytes]), 'PSP_GAME/ICON0.PNG'), /Invalid ISO extent/);
});

test('legacy preload-all library cannot allocate multiple large disc images', async () => {
  const loaded = [];
  const ctx = load(['preloadStoredGames'], {
    OPFS_GAMES_DIR: 'games', VIRTUAL_GAME_DIR: '/games', selectedStoredGame: null, selectedGame: null,
    opfsWalk: async () => [{ path: 'large.iso', size: 1800 * 1024 ** 2 }, { path: 'small.iso', size: 40 }],
    prunePreloadFavorites: names => names, isMobileExperience: () => true,
    opfsReadGame: async name => { loaded.push(name); return new Uint8Array(40); },
    log: () => {}, setStatus: () => {}, showLoading: () => {}, formatBytes: String,
  });
  await ctx.preloadStoredGames({ mkdirTree() {}, writeFile() {} });
  assert.deepEqual(loaded, ['small.iso']);
});

test('concurrent persistence requests run in sequence even after a failure', async () => {
  const events = [];
  let count = 0;
  const ctx = load(['persistFiles'], {
    log: () => {}, persistFilesNow: async () => {
      const index = ++count; events.push(`start${index}`);
      await new Promise(r => setTimeout(r, 5)); events.push(`end${index}`);
      if (index === 1) throw new Error('quota');
    },
  }, 'let persistQueue = Promise.resolve();');
  await Promise.allSettled([ctx.persistFiles({}, 'auto'), ctx.persistFiles({}, 'manual')]);
  assert.deepEqual(events, ['start1', 'end1', 'start2', 'end2']);
});

test('failed OPFS deletion remains dirty so a later sync retries it', async () => {
  const state = new Map([['/save', '1:1'], ['/deleted', '2:1']]);
  let fail = true;
  const ctx = load(['persistFilesNow'], {
    hasOPFS: () => true, detectMemstickDir: () => '/root', fsStatDir: () => new Map([['/save', { size: 1, mtime: 1 }]]),
    _persistedFileState: state, log: () => {}, updateStorageInfo: () => {},
    opfsDelete: async () => { if (fail) throw new Error('denied'); },
  }, 'let _detectedMemstick, _lastPersistTime;');
  await ctx.persistFilesNow({}, 'auto');
  assert.equal(state.has('/deleted'), true);
  fail = false;
  await ctx.persistFilesNow({}, 'auto');
  assert.equal(state.has('/deleted'), false);
});

test('settings recovery backs up configs and preserves saves and controller mappings', async () => {
  const deleted = [], backups = [];
  const ctx = load(['resetEmulatorSettings'], {
    started: false, runtimeFailed: false, runtimeReady: false, confirm: () => true, persistQueue: Promise.resolve(), OPFS_PERSIST_DIR: 'persist',
    opfsWalk: async () => ['ppsspp.ini', 'GAME123.ini', 'controls.ini'].map(name => ({ path: '/root/PSP/SYSTEM/' + name })).concat([{ path: '/root/PSP/SAVEDATA/GAME/DATA.BIN' }]),
    opfsRead: async () => new Uint8Array([1]), opfsPut: async path => backups.push(path), opfsDelete: async path => deleted.push(path),
    window: {}, _persistedFileState: new Map(), showToast: () => {}, log: () => {},
  });
  await ctx.resetEmulatorSettings();
  assert.equal(deleted.length, 2);
  assert.ok(deleted.every(path => !/controls|SAVEDATA/.test(path)));
  assert.deepEqual(backups, deleted.map(path => path + '.recovery-backup'));
});

const swSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function serviceWorker(globals) {
  const ctx = vm.createContext({ Request, Response, Headers, URL, self: { addEventListener() {} }, ...globals });
  vm.runInContext(swSource, ctx); return ctx;
}
for (const strategy of ['cacheFirst', 'networkFirst']) {
  test(`${strategy} still serves isolated responses when Cache Storage is denied`, async () => {
    const ctx = serviceWorker({ caches: { open: async () => { throw new Error('denied'); } }, fetch: async () => new Response('wasm') });
    const response = await ctx[strategy](new Request('https://example.test/core.wasm'));
    assert.equal(await response.text(), 'wasm');
    assert.equal(response.headers.get('Cross-Origin-Embedder-Policy'), 'require-corp');
  });
  test(`${strategy} does not turn quota errors into failed network requests`, async () => {
    const ctx = serviceWorker({ caches: { open: async () => ({ match: async () => undefined, put: async () => { throw new Error('quota'); } }) }, fetch: async () => new Response('ok') });
    assert.equal(await (await ctx[strategy](new Request('https://example.test/core.wasm'))).text(), 'ok');
  });
}

test('denied localStorage preserves tab preferences and removal semantics', () => {
  const wrapper = ast.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === 'preferences')).getText(ast);
  const ctx = vm.createContext({ localStorage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } } });
  vm.runInContext(wrapper + '; globalThis.prefs = preferences;', ctx);
  assert.equal(ctx.prefs.getItem('x'), null);
  ctx.prefs.setItem('x', '1'); assert.equal(ctx.prefs.getItem('x'), '1');
  ctx.prefs.removeItem('x'); assert.equal(ctx.prefs.getItem('x'), null);
});

test('failed preload never releases the dependency and starts the core without its files', async () => {
  const failures = [], removed = [];
  const noop = () => {};
  const ctx = load(['start'], {
    started: false, runtimeReady: false, canvas: { focus() {} }, fileLabel: null, fileInput: null, gpuSelectEl: null,
    SharedArrayBuffer, sessionStorage: { removeItem() {} }, COI_RELOAD_KEY: 'coi',
    document: { body: { classList: { add() {} }, appendChild() {} }, createElement: () => ({}) },
    setStartButtonMode: noop, log: noop, showLoading: noop, setStatus: noop, setTimeout: () => 1,
    selectBuildDir: async () => {}, AudioContext: class { async resume() {} }, installScriptProcessorPolyfill: async () => {},
    preferences: { getItem: () => null }, BUILD_DIR: '/build/', BUILD_STAMP: 'test',
    addRunDependency: noop, removeRunDependency: dep => removed.push(dep),
    preloadAssets: async () => { throw new Error('asset missing'); }, FS: {},
    failRuntime: message => failures.push(message),
  });
  ctx.window = ctx; ctx.crossOriginIsolated = true;
  await ctx.start();
  ctx.Module.preRun[0]();
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(removed, []);
  assert.match(failures[0], /asset missing/);
});

test('native PSP saves support SAVEDATA and individual game folders without changing slot names', () => {
  const ctx = load(['nativeSaveRelativePath']);
  for (const path of ['PSP/SAVEDATA/ULUS12345/PARAM.SFO', 'SAVEDATA/ULUS12345/PARAM.SFO', 'ULUS12345/PARAM.SFO']) {
    assert.equal(ctx.nativeSaveRelativePath({ webkitRelativePath: path }), 'ULUS12345/PARAM.SFO');
  }
  assert.throws(() => ctx.nativeSaveRelativePath({ webkitRelativePath: 'DATA.BIN' }), /Select SAVEDATA/);
  assert.throws(() => ctx.nativeSaveRelativePath({ webkitRelativePath: 'SAVEDATA/../DATA.BIN' }), /Invalid/);
});

test('a failed OPFS write aborts the transaction instead of committing a truncated file', async () => {
  let aborted = false, closed = false;
  const ctx = load(['writeOpfsHandle']);
  await assert.rejects(ctx.writeOpfsHandle({ createWritable: async () => ({
    write: async () => { throw new Error('quota'); }, close: async () => { closed = true; }, abort: async () => { aborted = true; },
  }) }, new Blob(['data'])), /quota/);
  assert.equal(aborted, true); assert.equal(closed, false);
});

test('caching a large WASM response does not delay streaming it to the browser', async () => {
  const ctx = serviceWorker({ caches: { open: async () => ({ match: async () => undefined, put: () => new Promise(() => {}) }) }, fetch: async () => new Response('wasm') });
  let cacheTask;
  const response = await ctx.cacheFirst(new Request('https://example.test/core.wasm'), { waitUntil(task) { cacheTask = task; } });
  assert.equal(await response.text(), 'wasm');
  assert.ok(cacheTask);
});

test('blocked session storage cannot cause an endless isolation reload loop', async () => {
  const statuses = [];
  const ctx = load(['reloadForCrossOriginIsolation'], {
    window: { crossOriginIsolated: false }, sessionStorage: { getItem() { throw new Error('denied'); } },
    COI_RELOAD_KEY: 'coi', setStatus: value => statuses.push(value), hideLoading() {},
    location: { reload() { throw new Error('must not reload'); } },
  });
  assert.equal(await ctx.reloadForCrossOriginIsolation('test'), false);
  assert.match(statuses[0], /storage is blocked/);
});

test('game downloads stream through OPFS with backpressure instead of accumulating chunks in RAM', async () => {
  const written = []; let closed = false;
  const handle = {
    createWritable: async () => new WritableStream({ write(chunk) { written.push(...chunk); }, close() { closed = true; } }),
    getFile: async () => new Blob([new Uint8Array(written)]),
  };
  const ctx = load(['storeGameResponse'], {
    TransformStream, performance, OPFS_GAMES_DIR: 'games', showLoading() {}, formatBytes: String, writeGameMetadata: async () => {}, log() {},
    opfsParent: async () => ({ name: 'game.cso', dir: { getFileHandle: async () => handle } }),
  });
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2])); controller.enqueue(new Uint8Array([3, 4])); controller.close(); } }));
  response.arrayBuffer = () => { throw new Error('whole download allocation'); };
  const stored = await ctx.storeGameResponse('game.cso', response);
  assert.equal(stored.size, 4); assert.deepEqual(written, [1,2,3,4]); assert.equal(closed, true);
});

test('an interrupted game download aborts the OPFS transaction', async () => {
  let aborted = false;
  const ctx = load(['storeGameResponse'], {
    TransformStream, performance, OPFS_GAMES_DIR: 'games',
    opfsParent: async () => ({ name: 'game.iso', dir: { getFileHandle: async () => ({ createWritable: async () => new WritableStream({ abort() { aborted = true; } }) }) } }),
  });
  const response = new Response(new ReadableStream({ start(controller) { controller.error(new Error('connection lost')); } }));
  await assert.rejects(ctx.storeGameResponse('game.iso', response), /connection lost/);
  assert.equal(aborted, true);
});

test('a packaged cache revision always selects its matching core, even beside an older local release', async () => {
  const checked = [], selected = [];
  const ctx = load(['selectBuildDir'], {
    fetch: async () => ({ ok: true, json: async () => ({ revision: 'a'.repeat(64) }) }),
    hasBuildFile: async (dir, name) => { checked.push(dir); return true; },
    setBuildDir: dir => selected.push(dir), log() {}, BUILD_DIR: 'build-wasm/', BUILD_STAMP: 'timestamp',
  });
  await ctx.selectBuildDir();
  assert.deepEqual(selected, ['build-wasm/']);
  assert.ok(checked.every(dir => dir === 'build-wasm/'));
  assert.equal(ctx.BUILD_STAMP, 'a'.repeat(64));
});

test('startup rejects a partial core instead of loading mismatched JS/WASM/data', async () => {
  const ctx = load(['selectBuildDir'], {
    fetch: async () => ({ ok: false }), hasBuildFile: async (dir, name) => name !== 'PPSSPPSDL.wasm',
    setBuildDir() { throw new Error('must not select a partial build'); }, log() {},
  });
  await assert.rejects(ctx.selectBuildDir(), /Emulator files are missing/);
});
