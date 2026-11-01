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

test('mobile keyboard preserves portrait height and tracks the visible viewport while opening and closing', () => {
  for (const hasScreenOrientation of [true, false]) {
    const styles = new Map();
    const classes = new Map();
    const window = {
      innerWidth: 390, innerHeight: 844,
      visualViewport: { width: 390, height: 844, offsetTop: 0, offsetLeft: 0 },
      screen: hasScreenOrientation ? { orientation: { type: 'portrait-primary' } } : {},
    };
    const document = {
      activeElement: null,
      documentElement: { style: { setProperty: (key, value) => styles.set(key, value) } },
      body: { classList: { toggle: (name, value) => classes.set(name, !!value), contains: name => !!classes.get(name) } },
    };
    const ctx = load(['syncViewportSize', 'fullscreenElement', 'viewportOrientation', 'isTextEntryActive', 'revealPanelInput'],
      { window, document }, 'let stableViewportWidth = 0, stableViewportHeight = 0, stableViewportOrientation = "";');
    ctx.syncViewportSize({ reset: true });
    document.activeElement = { tagName: 'INPUT' };
    for (const height of [600, 340, 300]) {
      window.visualViewport.height = height;
      window.visualViewport.offsetTop = 90;
      ctx.syncViewportSize();
      assert.equal(classes.get('keyboard-open'), true);
      assert.equal(styles.get('--app-h'), '844px');
      assert.equal(styles.get('--visual-h'), height + 'px');
      assert.equal(styles.get('--visual-top'), '90px');
    }
    // Android may also resize innerHeight; this must not reset the baseline.
    window.innerHeight = 300;
    ctx.syncViewportSize();
    assert.equal(classes.get('keyboard-open'), true);
    assert.equal(styles.get('--app-h'), '844px');
    window.innerHeight = window.visualViewport.height = 844;
    window.visualViewport.offsetTop = 0;
    ctx.syncViewportSize();
    assert.equal(classes.get('keyboard-open'), false);
    assert.equal(styles.get('--visual-top'), '0px');
    // A real rotation must still establish a new baseline.
    window.innerWidth = window.visualViewport.width = 844;
    window.innerHeight = window.visualViewport.height = 390;
    if (hasScreenOrientation) window.screen.orientation.type = 'landscape-primary';
    ctx.syncViewportSize();
    assert.equal(classes.get('keyboard-open'), false);
    assert.equal(styles.get('--app-h'), '390px');
  }
});

test('keyboard viewport changes reveal the active field by scrolling only its panel section', () => {
  const scroller = { scrollTop: 0, getBoundingClientRect: () => ({ top: 110, bottom: 300 }) };
  let field = { top: 320, bottom: 364 };
  const input = {
    tagName: 'INPUT', closest: () => scroller, getBoundingClientRect: () => field,
    scrollIntoView: () => assert.fail('must not pan the page'),
  };
  const ctx = load(['revealPanelInput', 'isTextEntryActive'], { document: { activeElement: input } });
  ctx.revealPanelInput();
  assert.equal(scroller.scrollTop, 80);
  field = { top: 100, bottom: 144 };
  ctx.revealPanelInput();
  assert.equal(scroller.scrollTop, 54);
  field = { top: 150, bottom: 194 };
  ctx.revealPanelInput();
  assert.equal(scroller.scrollTop, 54);
});

test('Multiplayer invitation imports relay, room and session key without launching a game', () => {
  const saved = new Map();
  let cleaned;
  const ctx = load(['importNetworkInvite', 'storeNetworkSessionKey', 'readNetworkSessionKey'], {
    URLSearchParams,
    location: { hash: '#relay=wss%3A%2F%2F192.168.10.172%3A8081%2Fadhoc&room=game-night&session_key=shared-secret', pathname: '/', search: '' },
    window: { PPSSPPAdhoc: { endpoint: value => new URL(value) } },
    preferences: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    sessionStorage: { setItem: (key, value) => saved.set(key, value) },
    NETWORK_SERVER_KEY: 'server', NETWORK_ENABLE_KEY: 'enabled',
    history: { replaceState: (_, __, value) => { cleaned = value; } },
    log: () => {},
  }, 'let networkSessionKey = "";');
  ctx.importNetworkInvite();
  assert.equal(saved.get('server'), 'wss://192.168.10.172:8081/adhoc');
  assert.equal(saved.get('ppsspp-network-room'), 'game-night');
  assert.equal(saved.get('enabled'), '1');
  assert.equal(saved.get('ppsspp-relay-session-key'), 'shared-secret');
  assert.equal(cleaned, '/');
  ctx.location.hash = '#relay=wss%3A%2F%2F192.168.10.172%3A8081%2Fadhoc&room=another';
  ctx.importNetworkInvite();
  assert.equal(saved.get('ppsspp-relay-session-key'), 'shared-secret');
  saved.clear();
  ctx.location.hash = '#relay=wss%3A%2F%2Fexample.org%2Fadhoc&room=%3Cscript%3E';
  ctx.importNetworkInvite();
  assert.equal(saved.size, 0);
  ctx.location.hash = '#relay=wss%3A%2F%2Fexample.org%2Fadhoc&room=friends';
  ctx.importNetworkInvite();
  assert.equal(saved.get('ppsspp-relay-session-key'), '');
});

test('SDL keyboard input is scoped to the canvas before native startup', () => {
  const env = { LANG: 'it_IT.UTF-8' };
  const ctx = load(['configureEmulatorKeyboard']);
  ctx.configureEmulatorKeyboard(env);
  assert.equal(env.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT, '#canvas');
  assert.equal(env.LANG, 'it_IT.UTF-8');
  const preRun = source.slice(source.indexOf('preRun: [function () {'));
  assert.ok(preRun.indexOf('configureEmulatorKeyboard(ENV)') < preRun.indexOf('addRunDependency('));
});

test('controller connections and reconnects preserve the focused form control', () => {
  const pad = { index: 0, connected: true };
  const remembered = [];
  let flashes = 0;
  const ctx = load(['onGamepadConnected', 'reconnectKnownGamepadsForSDL'], {
    canvas: { focus() { assert.fail('controller event stole keyboard focus'); } },
    getBrowserGamepads: () => [pad],
    rememberGamepad: gp => remembered.push(gp),
    dispatchSDLGamepadReconnect: () => true,
    flashGamepadBadge: () => flashes++,
  });
  ctx.onGamepadConnected({ gamepad: pad });
  ctx.onGamepadConnected({ gamepad: pad, __ppssppSynthetic: true });
  assert.equal(ctx.reconnectKnownGamepadsForSDL('window focus'), 1);
  assert.equal(remembered.length, 3);
  assert.equal(flashes, 1);
});

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

test('startup mounts explicitly selected favorites of any size, skipping the game already launched', async () => {
  const loaded = [], written = [];
  const ctx = load(['preloadStoredGames'], {
    OPFS_GAMES_DIR: 'games', VIRTUAL_GAME_DIR: '/games', selectedStoredGame: 'playing.iso', selectedGame: null,
    opfsWalk: async () => [
      { path: 'large.iso', size: 1800 * 1024 ** 2 }, { path: 'small.iso', size: 40 },
      { path: 'playing.iso', size: 500 * 1024 ** 2 }, { path: 'unselected.iso', size: 80 },
    ],
    prunePreloadFavorites: () => ['large.iso', 'small.iso', 'playing.iso'],
    opfsReadGame: async name => { loaded.push(name); return new Uint8Array(40); },
    log() {}, setStatus() {}, showLoading() {}, formatBytes: String,
  });
  assert.equal(await ctx.preloadStoredGames({ mkdirTree() {}, writeFile: path => written.push(path) }), 2);
  assert.deepEqual(loaded, ['large.iso', 'small.iso']);
  assert.deepEqual(written, ['/games/large.iso', '/games/small.iso']);
});

test('a failed automount does not prevent other selected games from mounting', async () => {
  const written = [];
  const ctx = load(['preloadStoredGames'], {
    OPFS_GAMES_DIR: 'games', VIRTUAL_GAME_DIR: '/games', selectedStoredGame: null, selectedGame: null,
    opfsWalk: async () => [{ path: 'bad.iso' }, { path: 'good.iso' }],
    prunePreloadFavorites: names => names,
    opfsReadGame: async name => { if (name === 'bad.iso') throw new Error('read failed'); return new Uint8Array(40); },
    log() {}, setStatus() {}, showLoading() {}, formatBytes: String,
  });
  assert.equal(await ctx.preloadStoredGames({ mkdirTree() {}, writeFile: path => written.push(path) }), 1);
  assert.deepEqual(written, ['/games/good.iso']);
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
  const ctx = load(['resetEmulatorSettings', 'confirmUI'], {
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
  const ctx = load(['start', 'configureEmulatorKeyboard'], {
    ENV: {},
    loadNetworkConfig: () => ({ enabled: false }),
    started: false, runtimeReady: false, canvas: { focus() {} }, fileLabel: null, fileInput: null, gpuSelectEl: null,
    SharedArrayBuffer, sessionStorage: { removeItem() {} }, COI_RELOAD_KEY: 'coi',
    document: { body: { classList: { add() {} }, appendChild() {} }, createElement: () => ({}) },
    setSessionPresentation: noop, selectedStoredGame: null, selectedGame: null, setPanelOpen: noop, setStartButtonMode: noop, log: noop, showLoading: noop, setStatus: noop, setTimeout: () => 1,
    selectBuildDir: async () => {}, AudioContext: class { async resume() {} }, installScriptProcessorPolyfill: async () => {},
    preferences: { getItem: () => null }, BUILD_DIR: '/build/', BUILD_STAMP: 'test',
    addRunDependency: noop, removeRunDependency: dep => removed.push(dep),
    preloadAssets: async () => { throw new Error('asset missing'); }, FS: {},
    failRuntime: message => failures.push(message),
  });
  ctx.window = ctx; ctx.crossOriginIsolated = true;
  await ctx.start();
  ctx.Module.preRun[0]();
  assert.equal(ctx.ENV.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT, '#canvas');
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(removed, []);
  assert.match(failures[0], /asset missing/);
});

test('direct game launch also runs library automount before releasing startup', async () => {
  const events = [];
  const noop = () => {};
  const ctx = load(['start', 'configureEmulatorKeyboard'], {
    ENV: {}, loadNetworkConfig: () => ({ enabled: false }),
    started: false, runtimeReady: false, canvas: { focus() {} }, fileLabel: null, fileInput: null, gpuSelectEl: null,
    SharedArrayBuffer, sessionStorage: { removeItem() {} }, COI_RELOAD_KEY: 'coi',
    document: { body: { classList: { add() {} }, appendChild() {} }, createElement: () => ({}) },
    setSessionPresentation: noop, selectedStoredGame: null, selectedGame: null, setPanelOpen: noop, setStartButtonMode: noop, log: noop, showLoading: noop, setStatus: noop, setTimeout: () => 1,
    selectBuildDir: async () => {}, AudioContext: class { async resume() {} }, installScriptProcessorPolyfill: async () => {},
    preferences: { getItem: () => null }, BUILD_DIR: '/build/', BUILD_STAMP: 'test',
    addRunDependency: noop, removeRunDependency: () => events.push('ready'),
    preloadAssets: async () => {}, loadPersistedFiles: async () => {}, forceGamesDirectoryConfig: async () => {},
    preloadGame: async () => { events.push('selected'); return '/games/playing.iso'; },
    preloadStoredGames: async () => events.push('automount'), emulatorLaunchArgs: () => [], FS: {},
    failRuntime: message => assert.fail(message),
  });
  ctx.window = ctx; ctx.crossOriginIsolated = true;
  await ctx.start();
  ctx.Module.preRun[0]();
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(events, ['selected', 'automount', 'ready']);
  assert.deepEqual(Array.from(ctx.Module.arguments), ['/games/playing.iso']);
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

test('startup preserves saved graphics, timing, audio and touch settings across repeated restores', async () => {
  const declarations = ast.statements.filter(n => ts.isVariableStatement(n) &&
    n.declarationList.declarations.some(d => ['WEB_NATIVE_TIMING_CONFIG', 'WEB_STABILITY_CONFIG', 'MOBILE_TOUCH_CONFIG'].includes(d.name.getText(ast))))
    .map(n => n.getText(ast)).join('\n');
  const original = '[Graphics]\nInternalResolution = 4\nSoftwareRenderer = True\nTexScalingLevel = 5\nAnisotropyLevel = 4\nMultiSampleLevel = 3\nFrameSkip = 2\nAutoFrameSkip = True\nVerticalSync = False\n[General]\nForceLagSync2 = False\nUIScaleFactor = 1\n[Sound]\nEnable = False\n[Control]\nShowTouchControls = False\n';
  for (const mobile of [false, true]) {
    for (const legacyProfile of [null, 'performance', 'custom']) {
      let config = original;
      const ctx = load(['forceGamesDirectoryConfig', 'patchIniValue', 'applyMultiplayerTimingConfig'], {
        PERSIST_ROOTS: ['/config'], VIRTUAL_GAME_DIR: '/games',
        isMobileExperience: () => mobile, fsMkdirP() {},
        loadNetworkConfig: () => ({ enabled: false }),
        preferences: { getItem: () => legacyProfile },
        applyNetworkConfig: async (_, text) => text,
        syncGameNetworkNicknames: async () => {},
        opfsPut: async () => {}, log() {},
      }, declarations);
      const FS = { readFile: () => new TextEncoder().encode(config), writeFile: (_, bytes) => { config = new TextDecoder().decode(bytes); } };
      await ctx.forceGamesDirectoryConfig(FS);
      for (const line of original.split('\n').filter(line => line.includes('='))) assert.ok(config.includes(line), line);
      assert.match(config, /CurrentDirectory = \/games/);
      assert.match(config, /AudioBufferSize = 1024/);
      const saved = config;
      await ctx.forceGamesDirectoryConfig(FS);
      assert.equal(config, saved);
    }
  }
});

test('multiplayer disables native lag sleeps while retaining user graphics settings', () => {
  let enabled = true;
  const ctx = load(['applyMultiplayerTimingConfig', 'patchIniValue'], {
    loadNetworkConfig: () => ({ enabled }),
  });
  const original = '[General]\nForceLagSync2 = True\n[Graphics]\nFrameSkip = 1\nAutoFrameSkip = True\n';
  const result = ctx.applyMultiplayerTimingConfig(original);
  assert.match(result, /ForceLagSync2\s*=\s*False/);
  assert.match(result, /FrameSkip = 1/);
  assert.match(result, /AutoFrameSkip = True/);
  enabled = false;
  assert.equal(ctx.applyMultiplayerTimingConfig(original), original);
});

test('steady controller scans leave selector DOM alone while disconnects still update it', () => {
  let updates = 0;
  let pads = [{ index: 0, connected: true }];
  const ctx = load(['reconcileGamepads'], {
    getBrowserGamepads: () => pads,
    connectedGamepads: new Map([[0, { id: 'pad' }]]),
    rememberGamepad: () => false,
    updateGamepadSelector: () => updates++, log() {},
  });
  ctx.reconcileGamepads(); ctx.reconcileGamepads();
  assert.equal(updates, 0);
  pads = [];
  ctx.reconcileGamepads();
  assert.equal(updates, 1);
  assert.equal(ctx.connectedGamepads.size, 0);
});

test('network status distinguishes a relay check from an active game and surfaces failures', () => {
  const ctx = load(['networkStatusView']);
  const cfg = { enabled: true };
  assert.equal(ctx.networkStatusView(cfg, { state: 'idle' }, { state: 'unverified' }).title, 'Connection not checked');
  assert.equal(ctx.networkStatusView(cfg, null, { state: 'checking' }).tone, 'busy');
  const checked = ctx.networkStatusView(cfg, null, { state: 'reachable', checkedAt: 100 }, 200);
  assert.equal(checked.title, 'Relay reachable · game not connected');
  assert.notEqual(checked.tone, 'good');
  assert.equal(ctx.networkStatusView(cfg, null, { state: 'reachable', checkedAt: 100 }, 30100).title, 'Connection not checked');
  assert.equal(ctx.networkStatusView(cfg, { state: 'idle' }, { state: 'error', error: 'Access rejected' }).detail, 'Access rejected');
  assert.equal(ctx.networkStatusView(cfg, { state: 'registered', peers: [] }, { state: 'unverified' }).title, 'Connected to relay');
  assert.equal(ctx.networkStatusView(cfg, { state: 'registered', peers: [{}] }, { state: 'unverified' }).title, 'Connected with friends');
  assert.equal(ctx.networkStatusView(cfg, { state: 'registered', lastError: 'Data socket failed' }, { state: 'reachable' }).tone, 'error');
  assert.equal(ctx.networkStatusView(cfg, { state: 'disconnected' }, { state: 'unverified' }).title, 'Disconnected');
  assert.equal(ctx.networkStatusView({ enabled: false }, null, { state: 'unverified' }).title, 'Multiplayer disabled');
  assert.equal(ctx.networkStatusView(cfg, { state: 'registered' }, {}, 200, false).title, 'You are offline');
});

test('saved game overrides cannot replace the Network nickname at multiplayer startup', async () => {
  const dir = '/config/PSP/SYSTEM/';
  const original = '[Graphics]\nInternalResolution = 4\n[SystemParam]\nNickName = OldPlayer\nMacAddress = 02:00:00:00:00:09\n[Network]\nMinTimeout = 7\n';
  const files = new Map([
    [dir + 'ULES01376_ppsspp.ini', original],
    [dir + 'ULUS10466_ppsspp.ini', '[Sound]\nEnable = False\n'],
    [dir + 'ULES01376_ppssppvr.ini', original],
    [dir + 'ppsspp.ini', original],
    [dir + 'controls.ini', '[ControlMapping]\nCross = 1-2\n'],
  ]);
  const saved = new Map();
  let enabled = true;
  const FS = {
    readdir: () => ['.', '..', ...[...files.keys()].map(p => p.slice(dir.length))],
    readFile: p => new TextEncoder().encode(files.get(p)),
    writeFile: (p, bytes) => files.set(p, new TextDecoder().decode(bytes)),
  };
  const ctx = load(['syncGameNetworkNicknames', 'patchIniValue'], {
    loadNetworkConfig: () => ({ enabled, nick: 'NewPlayer' }),
    opfsPut: async (p, bytes) => saved.set(p, new TextDecoder().decode(bytes)), log() {},
  });
  await ctx.syncGameNetworkNicknames(FS, '/config');
  for (const name of ['ULES01376_ppsspp.ini', 'ULES01376_ppssppvr.ini']) {
    assert.equal(files.get(dir + name), original.replace('OldPlayer', 'NewPlayer'));
    assert.equal(saved.get(dir + name), files.get(dir + name));
  }
  assert.match(files.get(dir + 'ULUS10466_ppsspp.ini'), /NickName = NewPlayer/);
  assert.equal(files.get(dir + 'ppsspp.ini'), original);
  assert.equal(files.get(dir + 'controls.ini'), '[ControlMapping]\nCross = 1-2\n');
  saved.clear();
  await ctx.syncGameNetworkNicknames(FS, '/config');
  assert.equal(saved.size, 0); // unchanged startup does not rewrite persisted configs
  enabled = false;
  files.set(dir + 'ULES01376_ppsspp.ini', original);
  await ctx.syncGameNetworkNicknames(FS, '/config');
  assert.equal(files.get(dir + 'ULES01376_ppsspp.ini'), original);
});

function psfStrings(fields) {
  const encoder = new TextEncoder();
  const entries = Object.entries(fields).map(([key, value]) => ({ key: encoder.encode(key + '\0'), value: encoder.encode(value + '\0') }));
  const keyStart = 20 + entries.length * 16;
  const dataStart = keyStart + entries.reduce((sum, entry) => sum + entry.key.length, 0);
  const bytes = new Uint8Array(dataStart + entries.reduce((sum, entry) => sum + entry.value.length, 0));
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46535000, true); view.setUint32(8, keyStart, true); view.setUint32(12, dataStart, true); view.setUint32(16, entries.length, true);
  let keyPos = 0, dataPos = 0;
  entries.forEach((entry, i) => {
    const offset = 20 + i * 16;
    view.setUint16(offset, keyPos, true); view.setUint16(offset + 2, 0x0204, true);
    view.setUint32(offset + 4, entry.value.length, true); view.setUint32(offset + 8, entry.value.length, true); view.setUint32(offset + 12, dataPos, true);
    bytes.set(entry.key, keyStart + keyPos); bytes.set(entry.value, dataStart + dataPos);
    keyPos += entry.key.length; dataPos += entry.value.length;
  });
  return bytes;
}

test('PSP metadata reads titles, slot descriptions and disc IDs and rejects invalid extents', () => {
  const ctx = load(['parsePsfString', 'parsePsfTitle']);
  const data = psfStrings({ TITLE: 'A game é', DISC_ID: 'ULUS10041', SAVEDATA_TITLE: 'Profile 1', SAVEDATA_DETAIL: 'Race 3' });
  assert.equal(ctx.parsePsfTitle(data), 'A game é');
  assert.equal(ctx.parsePsfString(data, 'DISC_ID'), 'ULUS10041');
  assert.equal(ctx.parsePsfString(data, 'SAVEDATA_TITLE'), 'Profile 1');
  assert.equal(ctx.parsePsfString(data, 'UNKNOWN'), '');
  for (const length of [0, 8, 19, 22]) assert.equal(ctx.parsePsfTitle(data.slice(0, length)), '');
  const broken = data.slice(); new DataView(broken.buffer).setUint32(32, 0xffffffff, true);
  assert.equal(ctx.parsePsfTitle(broken), '');
});

test('save collection groups native slots and states under the game title and icon without counting previews as slots', () => {
  const ctx = load(['saveGameId', 'buildSaveCollection', 'parsePsfString', 'saveCollectionSummary'], { toDataURL: (data, ext) => 'image:' + ext });
  const file = (name, size, data) => ({ name, path: '/states/' + name, size, data });
  const groups = ctx.buildSaveCollection([
    { game: 'ULUS10041PROFILE1', flat: false, slotDir: '/data/ULUS10041PROFILE1', files: [file('PARAM.SFO', 40, psfStrings({ TITLE: 'WipEout Pure', SAVEDATA_TITLE: 'Profile 1', SAVEDATA_DETAIL: 'Race 3' })), file('ICON0.PNG', 10, new Uint8Array([1])), file('DATA.BIN', 50, new Uint8Array([2]))] },
    { game: 'ULUS10041PROFILE2', flat: false, slotDir: '/data/ULUS10041PROFILE2', files: [file('PARAM.SFO', 40, psfStrings({ TITLE: 'WipEout Pure', SAVEDATA_TITLE: 'Profile 2' }))] },
    { game: 'ULUS10041_1.00', flat: true, slotDir: '/states', files: [file('ULUS10041_1.00_0.ppst', 100, new Uint8Array([1])), file('ULUS10041_1.00_0.jpg', 25, new Uint8Array([2])), file('ULUS10041_1.00_1.ppst', 200, new Uint8Array([3])), file('orphan.jpg', 77, new Uint8Array([4]))] },
  ]);
  assert.equal(groups.length, 1);
  const group = groups[0];
  assert.equal(group.title, 'WipEout Pure'); assert.equal(group.id, 'ULUS10041');
  assert.equal(group.dataCount, 2); assert.equal(group.stateCount, 2); assert.equal(group.slots.length, 4);
  assert.equal(group.size, 465); assert.equal(group.icon, 'image:png');
  assert.equal(ctx.saveCollectionSummary(group), '2 saves · 2 states');
  const state = group.slots.find(slot => slot.title === 'State 1');
  assert.deepEqual(Array.from(state.paths), ['/states/ULUS10041_1.00_0.ppst', '/states/ULUS10041_1.00_0.jpg']);
  assert.equal(group.slots[0].description, 'Race 3');
});

test('state-only collections use matching library metadata and never pair previews across storage roots', () => {
  const ctx = load(['saveGameId', 'buildSaveCollection', 'parsePsfString'], { toDataURL: () => 'image' });
  const groups = ctx.buildSaveCollection([
    { game: 'ULES00001_1.00', flat: true, slotDir: '/root1/states', files: [{ name: 'ULES00001_1.00_0.ppst', path: '/root1/states/ULES00001_1.00_0.ppst', size: 100 }, { name: 'ULES00001_1.00_0.png', path: '/root2/states/ULES00001_1.00_0.png', size: 10, data: new Uint8Array([1]) }] },
  ], [{ discId: 'ULES00001', title: 'Lumines', fileName: 'lumines.iso', coverType: 'image/png' }]);
  assert.equal(groups[0].title, 'Lumines');
  assert.equal(groups[0].size, 100); assert.equal(groups[0].slots[0].paths.length, 1);
  assert.equal(groups[0].fileName, 'lumines.iso');
});

test('save slot export uses the current live bytes instead of an older persisted copy', async () => {
  let exported;
  const ctx = load(['downloadSaveSlot'], {
    buildSaveFileMap: async () => new Map([
      ['/save/DATA.BIN', { path: '/save/DATA.BIN', data: new Uint8Array([9]) }],
      ['/other/DATA.BIN', { path: '/other/DATA.BIN', data: new Uint8Array([1]) }],
    ]),
    bytesToBase64: data => Buffer.from(data).toString('base64'),
    triggerDownload: blob => { exported = blob; }, log() {}, showToast() {},
  });
  await ctx.downloadSaveSlot('/save', 'Profile');
  const bundle = JSON.parse(await exported.text());
  assert.equal(bundle.files.length, 1); assert.equal(bundle.files[0].data, 'CQ==');
});

test('PBP library metadata reads only the header, PARAM.SFO and embedded game icon', async () => {
  const reads = [];
  class TrackedBlob extends Blob {
    slice(start, end) { reads.push([start, end]); return super.slice(start, end); }
  }
  const sfo = psfStrings({ TITLE: 'Homebrew title', DISC_ID: 'TEST00001' });
  const icon = new Uint8Array([137, 80, 78, 71]);
  const header = new Uint8Array(40), view = new DataView(header.buffer);
  view.setUint32(0, 0x50425000, true);
  [40, 40 + sfo.length, 40 + sfo.length + icon.length, 40 + sfo.length + icon.length, 40 + sfo.length + icon.length, 40 + sfo.length + icon.length, 40 + sfo.length + icon.length, 40 + sfo.length + icon.length].forEach((value, i) => view.setUint32(8 + i * 4, value, true));
  const ctx = load(['extractPbpMetadata', 'parsePsfString', 'parsePsfTitle'], { extractIsoMetadata: name => ({ fileName: name, title: name, coverType: '' }) });
  const meta = await ctx.extractPbpMetadata('EBOOT.PBP', new TrackedBlob([header, sfo, icon, new Uint8Array(1024 * 1024)]));
  assert.equal(meta.title, 'Homebrew title'); assert.equal(meta.discId, 'TEST00001');
  assert.equal(meta.coverType, 'image/png'); assert.deepEqual(Array.from(meta.coverBytes), Array.from(icon));
  assert.deepEqual(reads, [[0, 40], [40, 40 + sfo.length], [40 + sfo.length, 40 + sfo.length + icon.length]]);
  const bad = header.slice(); new DataView(bad.buffer).setUint32(12, 0xffffffff, true);
  reads.length = 0;
  assert.equal((await ctx.extractPbpMetadata('bad.pbp', new TrackedBlob([bad, sfo, icon]))).title, 'bad.pbp');
  assert.deepEqual(reads, [[0, 40]]);
});

test('menu suspension pauses once, cancels an interrupted resume and resumes once after the transition', async () => {
  const classes = new Set(['emulator-started', 'panel-open']);
  let pauses = 0, resumes = 0, snapshots = 0, unlocks = 0, timerID = 0, pins = 0;
  const timers = new Map();
  const audio = { state: 'running', suspend: async () => { audio.state = 'suspended'; } };
  const ctx = load(['syncMenuSuspension', 'suspendMenuAudio', 'sessionIsMultiplayer'], {
    runtimeReady: true, runtimeFailed: false, networkActiveConfig: { enabled: false }, trackedAudioContexts: [audio],
    document: { body: { classList: { contains: name => classes.has(name), add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)) } } },
    window: { Module: { runtimeKeepalivePush() { pins++; }, runtimeKeepalivePop() { pins--; }, pauseMainLoop() { pauses++; }, resumeMainLoop() { resumes++; } }, matchMedia: () => ({ matches: false }) },
    captureSessionPreview() { snapshots++; }, updateSessionDock() {}, unlockAudio: async () => { unlocks++; }, log() {},
    failRuntime: message => assert.fail(message), setPanelOpen() {},
    setTimeout: callback => { timers.set(++timerID, callback); return timerID; }, clearTimeout: id => timers.delete(id),
  }, 'let menuSuspended = false, menuResumeTimer = null, menuKeepaliveRelease = null;');
  ctx.syncMenuSuspension(true); ctx.syncMenuSuspension(true);
  await Promise.resolve();
  assert.equal(pauses, 1); assert.equal(snapshots, 1); assert.equal(audio.state, 'suspended'); assert.equal(pins, 1);
  classes.delete('panel-open'); ctx.syncMenuSuspension(false);
  assert.equal(resumes, 0); assert.equal(timers.size, 1);
  classes.add('panel-open'); ctx.syncMenuSuspension(true);
  assert.equal(timers.size, 0); assert.equal(pauses, 1); assert.equal(unlocks, 0);
  classes.delete('panel-open'); ctx.syncMenuSuspension(false);
  [...timers.values()][0]();
  assert.equal(resumes, 1); assert.equal(pins, 0); assert.equal(unlocks, 1); assert.equal(classes.has('session-suspended'), false);
  ctx.syncMenuSuspension(false); assert.equal(resumes, 1);
});

test('a multiplayer menu and a runtime without pause controls keep running without claiming suspension', () => {
  for (const mode of ['multiplayer', 'unsupported', 'failed', 'no-keepalive']) {
    let pauses = 0, audioPauses = 0;
    const classes = new Set(['emulator-started', 'panel-open']);
    const ctx = load(['syncMenuSuspension', 'sessionIsMultiplayer'], {
      runtimeReady: true, runtimeFailed: mode === 'failed', networkActiveConfig: { enabled: mode === 'multiplayer' },
      document: { body: { classList: { contains: n => classes.has(n), add: n => classes.add(n), remove: n => classes.delete(n) } } },
      window: { Module: mode === 'unsupported' ? {} : { ...(mode === 'no-keepalive' ? {} : { runtimeKeepalivePush() {}, runtimeKeepalivePop() {} }), pauseMainLoop() { pauses++; }, resumeMainLoop() {} } },
      captureSessionPreview() {}, updateSessionDock() {}, suspendMenuAudio() { audioPauses++; }, clearTimeout() {}, log() {},
    }, 'let menuSuspended = false, menuResumeTimer = null, menuKeepaliveRelease = null;');
    ctx.syncMenuSuspension(true);
    assert.equal(pauses, 0); assert.equal(audioPauses, 0); assert.equal(classes.has('session-suspended'), false);
  }
});

test('reduced motion resumes immediately and background audio recovery respects menu suspension', async () => {
  let resumed = 0;
  const ctx = load(['syncMenuSuspension', 'unlockAudio', 'reportAudioStatus'], {
    runtimeReady: true, runtimeFailed: false, started: true, trackedAudioContexts: [],
    document: { body: { classList: { contains: n => n === 'emulator-started', add() {}, remove() {} } } },
    window: { Module: { resumeMainLoop() { resumed++; }, SDL2: { audioContext: { state: 'suspended', resume: async () => { resumed++; } } } }, matchMedia: () => ({ matches: true }) },
    clearTimeout() {}, updateSessionDock() {},
  }, 'let menuSuspended = true, menuResumeTimer = null, menuKeepaliveRelease = null;');
  await ctx.unlockAudio(); await ctx.reportAudioStatus(); assert.equal(resumed, 0);
  ctx.syncMenuSuspension(false); await Promise.resolve(); assert.equal(resumed, 2);
});

test('opening the menu releases held gameplay keys before trapping UI keyboard events', () => {
  const events = [];
  const window = {};
  const ctx = load(['releaseGameplayKeyboard'], {
    window, canvas: { dispatchEvent: e => events.push([e.type, e.code, window.__ppssppReleasingKeys]) },
    KeyboardEvent: class { constructor(type, init) { Object.assign(this, { type }, init); } },
  }, 'const gameplayKeys = new Map([["ArrowUp", { key: "ArrowUp", code: "ArrowUp", keyCode: 38 }], ["KeyZ", { key: "z", code: "KeyZ", keyCode: 90 }]]);');
  ctx.releaseGameplayKeyboard(); ctx.releaseGameplayKeyboard();
  assert.deepEqual(events, [['keyup', 'ArrowUp', true], ['keyup', 'KeyZ', true]]);
  assert.equal(window.__ppssppReleasingKeys, false);
});

test('fullscreen uses an immersive shell fallback when the browser denies the request and exits it cleanly', async () => {
  const classes = new Set(); let requested = 0, synced = 0;
  const ctx = load(['togglePPSSPPFullscreen'], {
    fullscreenElement: () => null,
    document: { body: { classList: { contains: n => classes.has(n), add: n => classes.add(n), remove: n => classes.delete(n) } } },
    requestBrowserFullscreen: async () => { requested++; return false; },
    syncFullscreenOverlays() { synced++; }, updateFullscreenControls() {}, scheduleRuntimeResize() {},
  });
  await ctx.togglePPSSPPFullscreen(); assert.equal(classes.has('immersive-fullscreen'), true); assert.equal(requested, 1);
  await ctx.togglePPSSPPFullscreen(); assert.equal(classes.has('immersive-fullscreen'), false); assert.equal(requested, 1); assert.equal(synced, 2);
});

test('Guide reservation leaves gameplay inputs and nonstandard pads intact', () => {
  const ctx = load(['maskGuideButton'], { performance: { now: () => 123 } });
  const buttons = Array.from({ length: 17 }, (_, index) => ({ pressed: [0, 16].includes(index), touched: true, value: [0, 16].includes(index) ? 1 : 0 }));
  const pad = { id: 'DualSense', index: 0, mapping: 'standard', connected: true, axes: [0.7, -0.2], buttons };
  const filtered = ctx.maskGuideButton(pad);
  assert.equal(filtered.buttons[16].pressed, false);
  assert.equal(filtered.buttons[16].value, 0);
  assert.equal(filtered.buttons[0], buttons[0]);
  assert.deepEqual([...filtered.axes], pad.axes);
  assert.equal(filtered.id, pad.id); assert.equal(filtered.connected, true);
  assert.equal(buttons[16].pressed, true);
  const generic = { ...pad, mapping: '' };
  assert.equal(ctx.maskGuideButton(generic), generic);
  assert.equal(ctx.maskGuideButton(null), null);
});

test('native menu waits for session resume, sends one Escape pulse and cancels on web menu reopen', () => {
  const timers = new Map(), keys = [], classes = new Set(['panel-open']);
  let tick = 0, notified = 0;
  const window = {};
  const ctx = load(['openNativeMenu'], {
    window, document: { body: { classList: { contains: name => classes.has(name) } } },
    performance: { now: () => tick }, KeyboardEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
    canvas: { focus() {}, dispatchEvent(e) { keys.push({ ...e, native: window.__ppssppNativeMenuKey }); } },
    releaseGameplayKeyboard() {}, setFullscreenMenuOpen() {}, showToast() { notified++; },
    setPanelOpen() { classes.delete('panel-open'); },
    setTimeout(fn) { timers.set(++tick, fn); return tick; }, clearTimeout(id) { timers.delete(id); },
  }, 'let nativeMenuTimer = null, runtimeReady = true, runtimeFailed = false, menuSuspended = true;');
  const flush = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); };
  ctx.openNativeMenu(); assert.equal(keys.length, 0);
  vm.runInContext('menuSuspended = false', ctx); flush();
  assert.equal(keys.length, 1); assert.equal(keys[0].type, 'keydown'); assert.equal(keys[0].keyCode, 27); assert.equal(keys[0].native, true);
  flush(); assert.equal(keys[1].type, 'keyup'); assert.equal(window.__ppssppNativeMenuKey, false);
  vm.runInContext('menuSuspended = true', ctx); ctx.openNativeMenu(); classes.add('panel-open'); flush();
  assert.equal(keys.length, 2);
  vm.runInContext('runtimeReady = false', ctx); ctx.openNativeMenu(); assert.equal(notified, 1);
});
