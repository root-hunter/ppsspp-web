/*
 * Copyright (c) 2026 Antonio Ricciardi
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* ── Constants ──────────────────────────────────────────────────── */
let BUILD_DIR          = "build-wasm/";
const BUILD_STAMP      = String(Date.now());
let ASSET_DIR          = BUILD_DIR + "assets/";
const MANIFEST         = "assets-manifest.txt";
const USE_PRELOADED_ASSETS = true;
const VIRTUAL_ASSETS   = "/emsdk/upstream/emscripten/cache/sysroot/share/ppsspp/assets";
const VIRTUAL_GAME_DIR = "/games";
const GAME_FILE_ACCEPT = ".iso,.cso,.chd,.pbp,.elf,.prx";
const GAME_FILE_EXT_RE = /\.(iso|cso|chd|pbp|elf|prx)$/i;

// Persistence: PPSSPP writes config+saves to $HOME/.config/ppsspp/ on Linux/Emscripten
const PERSIST_ROOTS       = ["/home/web_user/.config/ppsspp", "/root/.config/ppsspp"];
const OPFS_ROOT_DIR       = "ppsspp-web";
const OPFS_PERSIST_DIR    = "persist";
const OPFS_GAMES_DIR      = "games";
const OPFS_GAME_META_DIR  = "game-meta";
const PERSIST_SYNC_MS     = 30000; // auto-sync every 30 s
const MOBILE_EMULATOR_ARGS = ["--dpi", "1", "--xres", "1280", "--yres", "720"];
const WEB_NATIVE_TIMING_CONFIG = [
  ["General", "ForceLagSync2", "True"],
  ["Graphics", "DisplayRefreshRate", "60"],
  ["Graphics", "FrameRate", "0"],
  ["Graphics", "FrameRate2", "-1"],
  ["Graphics", "FrameSkip", "0"],
  ["Graphics", "AutoFrameSkip", "False"],
  ["Graphics", "VerticalSync", "True"],
  ["Graphics", "LowLatencyPresent", "False"],
  ["Sound", "Enable", "True"],
  ["Sound", "ExtraAudioBuffering", "False"],
  ["Sound", "AudioBufferSize", "1024"],
  ["Sound", "FillAudioGaps", "True"],
  ["Sound", "AudioSyncMode", "0"],
];
const WEB_STABILITY_CONFIG = [
  ["General", "IgnoreBadMemAccess", "True"],
  ["CPU", "FastMemoryAccess", "True"],
];
const MOBILE_TOUCH_CONFIG = [
  ["General", "UIScaleFactor", "3"],
  ["Control", "ShowTouchControls", "True"],
  ["Control", "TouchButtonStyle", "1"],
  ["Control", "TouchButtonOpacity", "78"],
  ["Control", "TouchButtonHideSeconds", "0"],
  ["Control", "TouchGliding", "True"],
  ["TouchControls.Landscape", "ShowTouchCross", "True"],
  ["TouchControls.Landscape", "ShowTouchCircle", "True"],
  ["TouchControls.Landscape", "ShowTouchSquare", "True"],
  ["TouchControls.Landscape", "ShowTouchTriangle", "True"],
  ["TouchControls.Landscape", "ShowTouchDpad", "True"],
  ["TouchControls.Landscape", "ShowAnalogStick", "True"],
  ["TouchControls.Landscape", "ShowTouchStart", "True"],
  ["TouchControls.Landscape", "ShowTouchSelect", "True"],
  ["TouchControls.Landscape", "ShowTouchLTrigger", "True"],
  ["TouchControls.Landscape", "ShowTouchRTrigger", "True"],
  ["TouchControls.Landscape", "ShowTouchPause", "True"],
  ["TouchControls.Landscape", "ActionButtonScale", "1.58"],
  ["TouchControls.Landscape", "DPadScale", "1.58"],
  ["TouchControls.Landscape", "AnalogStickScale", "1.48"],
  ["TouchControls.Landscape", "StartKeyScale", "1.28"],
  ["TouchControls.Landscape", "SelectKeyScale", "1.28"],
  ["TouchControls.Landscape", "UnthrottleKeyScale", "1.20"],
  ["TouchControls.Landscape", "LKeyScale", "1.35"],
  ["TouchControls.Landscape", "RKeyScale", "1.35"],
  ["TouchControls.Landscape", "PauseKeyScale", "1.12"],
  ["TouchControls.Landscape", "ActionButtonSpacing2", "1.08"],
  ["TouchControls.Landscape", "DPadSpacing", "1.06"],
  ["TouchControls.Landscape", "LeftStickHeadScale", "1.12"],
  ["TouchControls.Portrait", "ShowTouchCross", "True"],
  ["TouchControls.Portrait", "ShowTouchCircle", "True"],
  ["TouchControls.Portrait", "ShowTouchSquare", "True"],
  ["TouchControls.Portrait", "ShowTouchTriangle", "True"],
  ["TouchControls.Portrait", "ShowTouchDpad", "True"],
  ["TouchControls.Portrait", "ShowAnalogStick", "True"],
  ["TouchControls.Portrait", "ShowTouchStart", "True"],
  ["TouchControls.Portrait", "ShowTouchSelect", "True"],
  ["TouchControls.Portrait", "ShowTouchLTrigger", "True"],
  ["TouchControls.Portrait", "ShowTouchRTrigger", "True"],
  ["TouchControls.Portrait", "ShowTouchPause", "True"],
  ["TouchControls.Portrait", "ActionButtonScale", "1.42"],
  ["TouchControls.Portrait", "DPadScale", "1.42"],
  ["TouchControls.Portrait", "AnalogStickScale", "1.34"],
  ["TouchControls.Portrait", "StartKeyScale", "1.18"],
  ["TouchControls.Portrait", "SelectKeyScale", "1.18"],
  ["TouchControls.Portrait", "UnthrottleKeyScale", "1.12"],
  ["TouchControls.Portrait", "LKeyScale", "1.24"],
  ["TouchControls.Portrait", "RKeyScale", "1.24"],
  ["TouchControls.Portrait", "PauseKeyScale", "1.08"],
  ["TouchControls.Portrait", "ActionButtonSpacing2", "1.05"],
  ["TouchControls.Portrait", "DPadSpacing", "1.04"],
  ["TouchControls.Portrait", "LeftStickHeadScale", "1.10"],
];

// Google Drive is client-side only: OAuth Web client IDs are public by design.
const GOOGLE_CLIENT_ID_KEY = "ppsspp_google_client_id";
const GOOGLE_TOKEN_KEY = "ppsspp_google_token";
const GOOGLE_OAUTH_STATE_KEY = "ppsspp_google_oauth_state";
const GOOGLE_PENDING_ACTION_KEY = "ppsspp_google_pending_action";
const GOOGLE_DRIVE_APP_ROOT = "PPSSPP Web";
const GOOGLE_DRIVE_SAVE_BUNDLE = "ppsspp-saves.ppsspp";
const GOOGLE_DRIVE_SCOPE = [
  "https://www.googleapis.com/auth/drive.file",
].join(" ");
const GOOGLE_GIS_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_AUTH_TIMEOUT_MS = 90000;
const GOOGLE_AUTO_SYNC_KEY      = "ppsspp_drive_autosync";      // "1" / "0"
const GOOGLE_AUTO_SYNC_RATE_KEY = "ppsspp_drive_autosync_rate"; // seconds
const NETWORK_ENABLE_KEY = "ppsspp_network_enable";
const NETWORK_SERVER_KEY = "ppsspp_network_server";
const NETWORK_NICK_KEY   = "ppsspp_network_nick";
const NETWORK_MAC_KEY    = "ppsspp_network_mac";
const PRELOAD_FAVORITES_KEY = "ppsspp_preload_favorites";
const PRELOAD_FAVORITES_MIGRATED_KEY = "ppsspp_preload_favorites_migrated_v1";
const PRELOAD_DEFAULTS_APPLIED_KEY = "ppsspp_preload_defaults_applied_v1";
const ADHOC_WS_PORT      = 27312;

let stableViewportWidth = 0;
let stableViewportHeight = 0;
let stableViewportOrientation = "";

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function viewportOrientation(width = window.innerWidth || 0, height = window.innerHeight || 0) {
  return width >= height ? "landscape" : "portrait";
}

function isTextEntryActive() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return el.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function syncViewportAfterFocus() {
  syncViewportSize({ reset: false });
  setTimeout(() => {
    syncViewportSize({ reset: false });
    if (isTextEntryActive()) {
      document.activeElement.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  }, 260);
}

function syncViewportSize(options = {}) {
  const reset = options?.reset === true;
  const vv = window.visualViewport;
  const activeFullscreen = !!fullscreenElement();
  const visualWidth = Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 0);
  const visualHeight = Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 0);
  const layoutWidth = Math.round(window.innerWidth || document.documentElement.clientWidth || visualWidth);
  const layoutHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || visualHeight);
  const width = activeFullscreen ? Math.max(1, layoutWidth || visualWidth) : Math.max(1, visualWidth || layoutWidth);
  const orientation = viewportOrientation(width, activeFullscreen ? layoutHeight : visualHeight);
  const orientationChanged = stableViewportOrientation && stableViewportOrientation !== orientation;
  let widthChanged = !stableViewportWidth || Math.abs(width - stableViewportWidth) > 80;
  if (reset || orientationChanged) {
    stableViewportWidth = 0;
    stableViewportHeight = 0;
    widthChanged = true;
  }
  stableViewportOrientation = orientation;
  const safeVisualHeight = Math.max(1, visualHeight || layoutHeight || 320);
  const safeLayoutHeight = Math.max(320, layoutHeight || safeVisualHeight);

  if (widthChanged) {
    stableViewportWidth = width;
    stableViewportHeight = Math.max(safeVisualHeight, safeLayoutHeight);
  }

  const keyboardOpen = isTextEntryActive() && stableViewportHeight && safeVisualHeight < stableViewportHeight * 0.82;
  if (!keyboardOpen) {
    stableViewportHeight = Math.max(safeVisualHeight, safeLayoutHeight);
  }

  document.body?.classList.toggle("keyboard-open", keyboardOpen);
  document.body?.classList.toggle("browser-fullscreen", activeFullscreen);
  const appHeight = activeFullscreen ? Math.max(1, safeLayoutHeight || safeVisualHeight) : Math.max(320, stableViewportHeight || visualHeight);
  document.documentElement.style.setProperty("--viewport-w", width + "px");
  document.documentElement.style.setProperty("--app-h", appHeight + "px");
  document.documentElement.style.setProperty("--visual-h", safeVisualHeight + "px");
}

function syncFullscreenOverlays() {
  const activeFullscreen = !!fullscreenElement();
  document.body?.classList.toggle("browser-fullscreen", activeFullscreen);
  if (activeFullscreen && fpsBadge) fpsBadge.style.display = "none";
}

function notifyRuntimeResize(options = {}) {
  syncViewportSize(options);
  window.dispatchEvent(new Event("resize"));
}

function scheduleRuntimeResize(reset = false) {
  [0, 60, 140, 300, 650].forEach((delay, index) => {
    setTimeout(() => notifyRuntimeResize({ reset: reset && index === 0 }), delay);
  });
}

function emulatorLaunchArgs() {
  return isMobileExperience() ? MOBILE_EMULATOR_ARGS.slice() : [];
}

function isMobileExperience() {
  return !!window.matchMedia?.("(pointer: coarse)")?.matches;
}

syncViewportSize({ reset: true });
window.addEventListener("resize", () => syncViewportSize({ reset: false }), { passive: true });
window.addEventListener("orientationchange", () => scheduleRuntimeResize(true), { passive: true });
window.screen?.orientation?.addEventListener?.("change", () => scheduleRuntimeResize(true));
window.visualViewport?.addEventListener("resize", () => scheduleRuntimeResize(false), { passive: true });
window.visualViewport?.addEventListener("scroll", () => syncViewportSize({ reset: false }), { passive: true });
document.addEventListener("focusin", syncViewportAfterFocus);
document.addEventListener("focusout", () => setTimeout(() => syncViewportSize({ reset: false }), 120));

function setBuildDir(dir) {
  BUILD_DIR = dir;
  ASSET_DIR = BUILD_DIR + "assets/";
}

async function hasBuildFile(dir, name) {
  try {
    const r = await fetch(dir + name + "?v=" + BUILD_STAMP, { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch(e) {
    return false;
  }
}

async function selectBuildDir() {
  if (await hasBuildFile(BUILD_DIR, "PPSSPPSDL.data")) return;

  const releaseDir = "build-wasm-release/";
  if (await hasBuildFile(releaseDir, "PPSSPPSDL.js") && await hasBuildFile(releaseDir, "PPSSPPSDL.data")) {
    setBuildDir(releaseDir);
    log("Using local release build: " + BUILD_DIR, "ok");
    return;
  }

  log("PPSSPPSDL.data not found in " + BUILD_DIR + ". Rebuild with wasm-release or publish release files into build-wasm/.", "warn");
}

/* ── DOM refs ───────────────────────────────────────────────────── */
/* ── Lucide SVG helper (for dynamically injected HTML) ──────────── */
const LUCIDE_PATHS = {
  play:     '<polygon points="5 3 19 12 5 21 5 3"/>',
  pause:    '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  trash:    '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  save:     '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  gamepad:  '<line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="17" y1="10" x2="17.01" y2="10"/><path d="M6 3h12l2 7-6 3-2 3-2-3-6-3z"/>',
  info:           '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  menu:           '<line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/>',
  preload:        '<path d="M10 16h.01"/><path d="M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="M21.946 12.013H2.054"/><path d="M6 16h.01"/>',
  'cloud-upload': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/>',
};
function svgIcon(name, cls = "lucide") {
  const d = LUCIDE_PATHS[name] || "";
  return `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const byId = id => document.getElementById(id);
function on(target, type, handler, options) {
  const el = typeof target === "string" ? byId(target) : target;
  if (!el) {
    console.warn("PPSSPP Web: missing DOM element for listener", target);
    return null;
  }
  el.addEventListener(type, handler, options);
  return el;
}

const canvas          = byId("canvas");
const stageEl         = document.querySelector(".stage");
const fileInput       = byId("gameFile");
const fileLabel       = byId("fileLabel");
const runtimeGameLabel = byId("runtimeIsoLabel") || byId("runtimeGameLabel");
const runtimeGameInput = byId("runtimeIsoFile") || byId("runtimeGameFile");
const startBtn        = byId("startBtn");
const fullscreenBtn   = byId("fullscreenBtn");
const statusEl        = byId("statusText");
const statusDot       = byId("statusDot");
const stageDotEl      = byId("stageDot");
const stageMiniTextEl = byId("stageMiniText");
const logEl           = byId("log");
const logFilter       = byId("logFilter");
const loadOverlay     = byId("loadOverlay");
const loadLabel       = byId("loadLabel");
[fileInput, runtimeGameInput, byId("libraryImportFile")]
  .filter(Boolean)
  .forEach(input => { input.accept = GAME_FILE_ACCEPT; });
const progressBar     = byId("progressBar");
const idleOverlay     = byId("idleOverlay");
const idleSubtitle    = byId("idleSubtitle");
const idleStartBtn    = byId("idleStartBtn");
const fpsBadge        = byId("fpsBadge");
const gpuBadge        = byId("gpuBadge");
const gamepadBadge    = byId("gamepadBadge");
const gamepadSelect   = byId("gamepadSelect");
const gpuSelectEl     = byId("gpuSelect");
const panelToggleBtn  = byId("panelToggleBtn");
const panelTabSelect  = byId("panelTabSelect");
const googleClientIdInput = byId("googleClientIdInput");
const driveAuthEl     = byId("iDriveAuth");
const driveFolderEl   = byId("iDriveFolder");
const driveRemoteEl   = byId("iDriveRemote");
const driveActivityEl = byId("driveActivity");
const driveRemoteList = byId("driveRemoteList");
const driveBadgeEl    = byId("driveBadge");
const driveBadgeText  = byId("driveBadgeText");
const networkEnableToggle = byId("networkEnableToggle");
const networkServerInput  = byId("networkServerInput");
const networkNickInput    = byId("networkNickInput");
const networkMacInput     = byId("networkMacInput");
const networkUseThisHostBtn = byId("networkUseThisHostBtn");
const networkTestBtn      = byId("networkTestBtn");
const networkSaveBtn      = byId("networkSaveBtn");
const networkActivityEl   = byId("networkActivity");
const netServerEl         = byId("iNetServer");
const netPortEl           = byId("iNetPort");

// Panel toggle (hidden by default; restore from localStorage)
const PANEL_KEY = "ppsspp_panel_open";
if (localStorage.getItem(PANEL_KEY) === "1") document.body.classList.add("panel-open");
on(panelToggleBtn, "click", () => {
  const open = document.body.classList.toggle("panel-open");
  localStorage.setItem(PANEL_KEY, open ? "1" : "0");
});

updateNetworkConfigUI();
networkUseThisHostBtn?.addEventListener("click", () => {
  if (networkServerInput) networkServerInput.value = defaultNetworkServerHost();
  saveNetworkConfigFromUI();
});
networkSaveBtn?.addEventListener("click", saveNetworkConfigFromUI);
networkEnableToggle?.addEventListener("change", saveNetworkConfigFromUI);
networkTestBtn?.addEventListener("click", testNetworkRelay);

/* ── State ──────────────────────────────────────────────────────── */
let selectedGame = null;
let selectedStoredGame = null;
let started      = false;
let runtimeReady = false;
const trackedAudioContexts = [];
const audioDebug = {
  callbacks: 0, nonsilent: 0, peak: 0, rate: 0, deviceStarted: false,
  pushes: 0, pushNonsilent: 0, pushPeak: 0,
  workletPeak: 0, workletTotal: 0, ringDropped: 0, underruns: 0, fallbackPeak: 0, fallbackDropped: 0,
};

function updateIdleOverlay() {
  if (!idleOverlay || started) return;
  let text = "Open a PSP game file or pick one from the library to start PPSSPP in the browser.";
  if (selectedGame) text = "Ready to launch " + selectedGame.name + ".";
  else if (selectedStoredGame) text = "Ready to launch " + selectedStoredGame + " from your library.";
  if (idleSubtitle) idleSubtitle.textContent = text;
}
updateIdleOverlay();

function setStartButtonMode(mode) {
  if (!startBtn) return;
  if (mode === "running") {
    startBtn.disabled = true;
    startBtn.style.display = "none";
    startBtn.title = "PPSSPP is running";
    startBtn.innerHTML = `${svgIcon("play")}<span class="btn-lbl"> Running</span>`;
  } else if (mode === "loading") {
    startBtn.disabled = true;
    startBtn.style.display = "";
    startBtn.title = "Starting PPSSPP";
    startBtn.innerHTML = `${svgIcon("play")}<span class="btn-lbl"> Launch</span>`;
  } else {
    startBtn.disabled = false;
    startBtn.style.display = "";
    startBtn.title = "Launch PPSSPP";
    startBtn.innerHTML = `${svgIcon("play")}<span class="btn-lbl"> Launch</span>`;
  }
}

/* ── Toast ──────────────────────────────────────────────────────── */
const toastEl = byId("toast");
function showToast(msg, ms = 3200) {
  if (!toastEl) {
    console.log("Toast:", msg);
    return;
  }
  toastEl.textContent = msg;
  toastEl.classList.add("visible");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove("visible"), ms);
}

/* ── OPFS Persistence ───────────────────────────────────────────── */
let _opfsRoot = null;
let _detectedMemstick = null;
let _lastPersistTime  = 0;
// path → "size:mtime" fingerprint of the last successfully persisted state
let _persistedFileState = new Map();

function hasOPFS() {
  return !!navigator.storage?.getDirectory;
}

async function opfsRoot() {
  if (!hasOPFS()) throw new Error("Origin Private File System is not available in this browser/context");
  if (_opfsRoot) return _opfsRoot;
  const origin = await navigator.storage.getDirectory();
  _opfsRoot = await origin.getDirectoryHandle(OPFS_ROOT_DIR, { create: true });
  return _opfsRoot;
}

async function opfsDir(parts, create) {
  let dir = await opfsRoot();
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
  return dir;
}

function opfsPathParts(path) {
  return path.split("/").filter(Boolean);
}

async function opfsParent(path, create, base = OPFS_PERSIST_DIR) {
  const parts = opfsPathParts(path);
  const name = parts.pop();
  if (!name) throw new Error("Invalid OPFS path: " + path);
  return { dir: await opfsDir([base, ...parts], create), name };
}

async function opfsPut(path, data) {
  const { dir, name } = await opfsParent(path, true);
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

async function opfsRead(path) {
  const { dir, name } = await opfsParent(path, false);
  const handle = await dir.getFileHandle(name);
  return new Uint8Array(await (await handle.getFile()).arrayBuffer());
}

async function opfsDelete(path) {
  const { dir, name } = await opfsParent(path, false);
  await dir.removeEntry(name);
}

async function opfsClearAll() {
  const root = await opfsRoot();
  try { await root.removeEntry(OPFS_PERSIST_DIR, { recursive: true }); } catch(e) {}
  try { await root.removeEntry(OPFS_GAMES_DIR, { recursive: true }); } catch(e) {}
  try { await root.removeEntry(OPFS_GAME_META_DIR, { recursive: true }); } catch(e) {}
  localStorage.removeItem(PRELOAD_FAVORITES_KEY);
  localStorage.removeItem(PRELOAD_FAVORITES_MIGRATED_KEY);
  await root.getDirectoryHandle(OPFS_PERSIST_DIR, { create: true });
  await root.getDirectoryHandle(OPFS_GAMES_DIR, { create: true });
  await root.getDirectoryHandle(OPFS_GAME_META_DIR, { create: true });
}

async function opfsWalk(base = OPFS_PERSIST_DIR, prefix = "", includeData = true) {
  const files = [];
  let dir;
  try { dir = await opfsDir([base, ...opfsPathParts(prefix)], false); }
  catch(e) { return files; }

  for await (const [name, handle] of dir.entries()) {
    const rel = prefix ? prefix + "/" + name : name;
    if (handle.kind === "directory") {
      files.push(...await opfsWalk(base, rel, includeData));
    } else {
      const file = await handle.getFile();
      const entry = {
        path: base === OPFS_PERSIST_DIR ? "/" + rel : rel,
        name,
        size: file.size,
      };
      if (includeData) entry.data = new Uint8Array(await file.arrayBuffer());
      files.push(entry);
    }
  }
  return files;
}

async function opfsPutGame(name, data) {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const { dir, name: fileName } = await opfsParent(safe, true, OPFS_GAMES_DIR);
  const handle = await dir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
  setPreloadFavorite(safe, true);
  try { await writeGameMetadata(safe, data); }
  catch(e) { log("Library metadata failed for " + safe + ": " + e.message, "warn"); }
  return safe;
}

async function opfsReadGame(name) {
  const { dir, name: fileName } = await opfsParent(name, false, OPFS_GAMES_DIR);
  const handle = await dir.getFileHandle(fileName);
  return new Uint8Array(await (await handle.getFile()).arrayBuffer());
}

async function opfsGetGameFile(name) {
  const { dir, name: fileName } = await opfsParent(name, false, OPFS_GAMES_DIR);
  const handle = await dir.getFileHandle(fileName);
  return await handle.getFile();
}

async function opfsDeleteGame(name) {
  const { dir, name: fileName } = await opfsParent(name, false, OPFS_GAMES_DIR);
  await dir.removeEntry(fileName);
  await deleteGameMetadata(name);
}

// Walk Emscripten FS recursively from root, return [{path, data}]
function fsWalkDir(FS, root) {
  const files = [];
  function walk(dir) {
    let entries; try { entries = FS.readdir(dir); } catch(e) { return; }
    for (const name of entries) {
      if (name === "." || name === "..") continue;
      const full = dir + "/" + name;
      let stat; try { stat = FS.stat(full); } catch(e) { continue; }
      if      (FS.isDir(stat.mode))  walk(full);
      else if (FS.isFile(stat.mode)) {
        try { files.push({ path: full, data: FS.readFile(full) }); } catch(e) {}
      }
    }
  }
  walk(root);
  return files;
}

// Walk FS collecting stat info only — no data read, very cheap
function fsStatDir(FS, root) {
  const stats = new Map(); // path → {size, mtime}
  function walk(dir) {
    let entries; try { entries = FS.readdir(dir); } catch(e) { return; }
    for (const name of entries) {
      if (name === "." || name === "..") continue;
      const full = dir + "/" + name;
      let st; try { st = FS.stat(full); } catch(e) { continue; }
      if      (FS.isDir(st.mode))  walk(full);
      else if (FS.isFile(st.mode)) stats.set(full, { size: st.size, mtime: st.mtime });
    }
  }
  walk(root);
  return stats;
}

function fsMkdirP(FS, fullPath) {
  const parts = fullPath.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur += "/" + p;
    try { FS.mkdir(cur); } catch(e) {}
  }
}

function detectMemstickDir(FS) {
  for (const root of PERSIST_ROOTS) {
    try { if (FS.analyzePath(root).exists) return root; } catch(e) {}
  }
  return PERSIST_ROOTS[0]; // default — PPSSPP will create it on first run
}

function formatBytes(n) {
  if (n < 1024)    return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}

function bytesToBase64(data) {
  const bytes = new Uint8Array(data);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBytes(data) {
  return Uint8Array.from(atob(data), c => c.charCodeAt(0));
}

function stripGameExtension(name) {
  return name.replace(GAME_FILE_EXT_RE, "");
}

function prettyGameName(name) {
  return stripGameExtension(name).replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim() || name;
}

function dataToObjectURL(data, type = "application/octet-stream") {
  return URL.createObjectURL(new Blob([data], { type }));
}

function readIsoDirRecord(view, offset) {
  const len = view.getUint8(offset);
  if (!len) return null;
  const extent = view.getUint32(offset + 2, true);
  const size = view.getUint32(offset + 10, true);
  const flags = view.getUint8(offset + 25);
  const nameLen = view.getUint8(offset + 32);
  let name = "";
  for (let i = 0; i < nameLen; i++) name += String.fromCharCode(view.getUint8(offset + 33 + i));
  name = name.replace(/;1$/i, "");
  return { len, extent, size, flags, name };
}

function isoFindEntry(bytes, wantedPath) {
  if (!bytes || bytes.byteLength < 17 * 2048) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pvd = 16 * 2048;
  if (view.getUint8(pvd) !== 1) return null;
  let ident = "";
  for (let i = 1; i < 6; i++) ident += String.fromCharCode(view.getUint8(pvd + i));
  if (ident !== "CD001") return null;
  const root = readIsoDirRecord(view, pvd + 156);
  if (!root) return null;

  const parts = wantedPath.toUpperCase().split("/").filter(Boolean);
  let dir = root;
  for (let depth = 0; depth < parts.length; depth++) {
    const target = parts[depth];
    const start = dir.extent * 2048;
    const end = Math.min(start + dir.size, bytes.byteLength);
    let found = null;

    for (let off = start; off < end;) {
      const len = view.getUint8(off);
      if (!len) {
        off = (Math.floor(off / 2048) + 1) * 2048;
        continue;
      }
      const rec = readIsoDirRecord(view, off);
      off += len;
      if (!rec || rec.name === "\x00" || rec.name === "\x01") continue;
      if (rec.name.toUpperCase() === target) {
        found = rec;
        break;
      }
    }

    if (!found) return null;
    if (depth < parts.length - 1 && !(found.flags & 2)) return null;
    dir = found;
  }

  const dataStart = dir.extent * 2048;
  if (dataStart + dir.size > bytes.byteLength) return null;
  return bytes.slice(dataStart, dataStart + dir.size);
}

function parsePsfTitle(data) {
  if (!data || data.byteLength < 20) return "";
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== 0x46535000) return "";
  const keyTable = view.getUint32(8, true);
  const dataTable = view.getUint32(12, true);
  const count = view.getUint32(16, true);
  const decoder = new TextDecoder();

  for (let i = 0; i < count; i++) {
    const off = 20 + i * 16;
    const keyOff = view.getUint16(off, true);
    const dataLen = view.getUint32(off + 4, true);
    const dataOff = view.getUint32(off + 12, true);
    let keyEnd = keyTable + keyOff;
    while (keyEnd < data.byteLength && data[keyEnd] !== 0) keyEnd++;
    const key = decoder.decode(data.slice(keyTable + keyOff, keyEnd));
    if (key !== "TITLE") continue;
    const raw = data.slice(dataTable + dataOff, dataTable + dataOff + dataLen);
    return decoder.decode(raw).replace(/\0+$/g, "").trim();
  }
  return "";
}

function extractIsoMetadata(name, data) {
  const meta = {
    fileName: name,
    title: prettyGameName(name),
    format: (name.split(".").pop() || "").toUpperCase(),
    coverBytes: null,
    coverType: "",
  };
  if (!/\.iso$/i.test(name)) return meta;

  try {
    const sfo = isoFindEntry(data, "PSP_GAME/PARAM.SFO");
    const title = parsePsfTitle(sfo);
    if (title) meta.title = title;
  } catch(e) {}

  try {
    const icon = isoFindEntry(data, "PSP_GAME/ICON0.PNG");
    if (icon?.byteLength) {
      meta.coverBytes = icon;
      meta.coverType = "image/png";
    }
  } catch(e) {}
  return meta;
}

async function opfsMetaPut(path, data) {
  const { dir, name } = await opfsParent(path, true, OPFS_GAME_META_DIR);
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

async function opfsMetaRead(path) {
  const { dir, name } = await opfsParent(path, false, OPFS_GAME_META_DIR);
  const handle = await dir.getFileHandle(name);
  return new Uint8Array(await (await handle.getFile()).arrayBuffer());
}

async function writeGameMetadata(name, data) {
  const meta = extractIsoMetadata(name, data);
  const json = {
    fileName: meta.fileName,
    title: meta.title,
    format: meta.format,
    coverType: meta.coverType,
    updated: Date.now(),
  };
  await opfsMetaPut(name + ".json", new TextEncoder().encode(JSON.stringify(json)));
  if (meta.coverBytes) await opfsMetaPut(name + ".cover", meta.coverBytes);
}

async function readGameMetadata(name) {
  try {
    const data = await opfsMetaRead(name + ".json");
    return JSON.parse(new TextDecoder().decode(data));
  } catch(e) {
    return { fileName: name, title: prettyGameName(name), format: (name.split(".").pop() || "").toUpperCase(), coverType: "" };
  }
}

async function readGameCoverURL(name, type) {
  if (!type) return "";
  try { return dataToObjectURL(await opfsMetaRead(name + ".cover"), type); }
  catch(e) { return ""; }
}

async function deleteGameMetadata(name) {
  const root = await opfsRoot();
  let dir;
  try { dir = await root.getDirectoryHandle(OPFS_GAME_META_DIR); } catch(e) { return; }
  try { await dir.removeEntry(name + ".json"); } catch(e) {}
  try { await dir.removeEntry(name + ".cover"); } catch(e) {}
}

// Categorize an OPFS path for the file browser
function opfsFileCategory(path) {
  if (/\/PSP\/SAVEDATA\//i.test(path))     return "Save Data";
  if (/\/PSP\/PPSSPP_STATE\//i.test(path)) return "Save States";
  if (/\/PSP\/SYSTEM\//i.test(path))       return "System / Config";
  if (/\/PSP\/GAME\//i.test(path))         return "Games (PSP)";
  if (/\/PSP\/SCREENSHOT\//i.test(path))   return "Screenshots";
  if (/\/PSP\/CHEATS\//i.test(path))       return "Cheats";
  if (/\.ini$|config\.json$/i.test(path))  return "Config";
  return "Other";
}

async function downloadOpfsFile(path) {
  try {
    const data = await opfsRead(path);
    const name = path.split("/").pop();
    const blob = new Blob([data], { type: "application/octet-stream" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: name }).click();
    URL.revokeObjectURL(url);
    showToast("✓ Downloaded " + name);
  } catch(e) { showToast("❌ " + e.message); }
}

async function deleteOpfsFile(path) {
  if (!confirm("Delete from OPFS:\n" + path.split("/").pop() + "?")) return;
  try { await opfsDelete(path); } catch(e) {}
  if (window.FS) { try { window.FS.unlink(path); } catch(e) {} }
  showToast("🗑 Deleted " + path.split("/").pop());
  updateStorageInfo(); refreshSavesTab();
}

async function updateStorageInfo() {
  try {
    const entries = await opfsWalk(OPFS_PERSIST_DIR, "", false);
    const games   = await opfsWalk(OPFS_GAMES_DIR, "", false);
    const allFiles = [...entries, ...games.map(g => ({ ...g, path: VIRTUAL_GAME_DIR + "/" + g.path }))];
    const bytes   = allFiles.reduce((s, e) => s + (e.data?.byteLength || e.size || 0), 0);
    const el = id => document.getElementById(id);
    el("iStorageFiles").textContent = String(allFiles.length);
    el("iStorageFiles").className   = allFiles.length ? "info-val good" : "info-val";
    el("iStorageSize").textContent  = formatBytes(bytes);
    el("iLastSync").textContent     = _lastPersistTime
      ? new Date(_lastPersistTime).toLocaleTimeString() : "Never";
    el("iMemstickPath").textContent = _detectedMemstick || PERSIST_ROOTS[0];

    // Render grouped file browser
    const listEl = document.getElementById("opfsFileList");
    if (listEl) {
      if (!allFiles.length) {
        listEl.innerHTML = `<span class="empty-row">No files persisted yet.</span>`;
      } else {
        // Group by category
        const cats = new Map();
        for (const { path, data, size } of allFiles) {
          const cat = path.startsWith(VIRTUAL_GAME_DIR + "/") ? "Game Library" : opfsFileCategory(path);
          if (!cats.has(cat)) cats.set(cat, []);
          cats.get(cat).push({ path, size: data?.byteLength || size || 0 });
        }
        // Sort categories: Config first, then alphabetical
        const catOrder = ["Game Library", "Config", "System / Config", "Save States", "Save Data", "Screenshots", "Cheats", "Games (PSP)", "Other"];
        const sorted = [...cats.entries()].sort((a, b) => {
          const ai = catOrder.indexOf(a[0]); const bi = catOrder.indexOf(b[0]);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
        let html = "";
        for (const [cat, files] of sorted) {
          const catBytes = files.reduce((s, f) => s + f.size, 0);
          html += `<div class="opfs-cat-header"><span>${esc(cat)} (${files.length})</span><span class="opfs-cat-size">${formatBytes(catBytes)}</span></div>`;
          for (const { path, size } of files.sort((a, b) => a.path.localeCompare(b.path))) {
            const name = path.split("/").pop();
            html += `<div class="opfs-file-row">`;
            html += `<div class="opfs-file-name" title="${esc(path)}">${esc(name)}</div>`;
            html += `<div class="opfs-file-size">${formatBytes(size)}</div>`;
            html += `<div class="opfs-file-actions">`;
            html += `<button title="Download" onclick="downloadStoredFile(${JSON.stringify(path)})">${svgIcon("download")}</button>`;
            html += `<button class="del" title="Delete" onclick="deleteStoredFile(${JSON.stringify(path)})">${svgIcon("trash")}</button>`;
            html += `</div>`;
            html += `</div>`;
          }
        }
        listEl.innerHTML = html;
      }
    }
  } catch(e) { log("OPFS storage info error: " + e.message, "warn"); }
}

async function downloadStoredFile(path) {
  if (path.startsWith(VIRTUAL_GAME_DIR + "/")) {
    const name = path.slice((VIRTUAL_GAME_DIR + "/").length);
    const data = await opfsReadGame(name);
    const url = URL.createObjectURL(new Blob([data], { type: "application/octet-stream" }));
    Object.assign(document.createElement("a"), { href: url, download: name }).click();
    URL.revokeObjectURL(url);
    showToast("✓ Downloaded " + name);
  } else {
    await downloadOpfsFile(path);
  }
}

async function deleteStoredFile(path) {
  if (path.startsWith(VIRTUAL_GAME_DIR + "/")) {
    const name = path.slice((VIRTUAL_GAME_DIR + "/").length);
    if (!confirm("Delete game file from OPFS:\n" + name + "?")) return;
    try {
      await opfsDeleteGame(name);
      if (window.FS) { try { window.FS.unlink(path); } catch(e) {} }
      setPreloadFavorite(name, false);
      refreshEmulatorGameBrowser("deleted " + name);
      showToast("🗑 Deleted " + name);
      await refreshLibrary();
      updateStorageInfo();
    } catch(e) {
      log("Delete game file failed: " + e.message, "err");
      showToast("❌ Delete failed: " + e.message);
    }
  } else {
    await deleteOpfsFile(path);
  }
}

async function togglePreloadFavorite(name) {
  const enable = !isPreloadFavorite(name);
  setPreloadFavorite(name, enable);
  if (!enable) {
    showToast("Removed startup preload: " + name);
    await refreshLibrary();
    return;
  }

  showToast("Startup preload enabled: " + name);
  if (started && window.FS && !window.FS.analyzePath?.(VIRTUAL_GAME_DIR + "/" + name)?.exists) {
    await playOrMountStoredGame(name);
  } else {
    await refreshLibrary();
  }
}

async function playOrMountStoredGame(name) {
  if (!started || !window.FS) {
    selectedStoredGame = name;
    selectedGame = null;
    if (fileLabel) fileLabel.title = name;
    updateIdleOverlay();
    const textNode = fileLabel?.firstChild;
    if (textNode && textNode.nodeType === 3) textNode.textContent = "\uD83D\uDCC2 " + name + " ";
    setStatus("Starting " + name, "run");
    showToast("Starting " + name + "…");
    start();
    return;
  }

  const FS = window.FS;
  const path = VIRTUAL_GAME_DIR + "/" + name;
  try {
    showToast("Mounting " + name + "…");
    FS.mkdirTree(VIRTUAL_GAME_DIR);
    FS.writeFile(path, await opfsReadGame(name));
    log("Mounted stored game file from OPFS: " + path, "ok");
    refreshEmulatorGameBrowser("mounted " + name);
    showToast("✓ " + name + " mounted");
    refreshLibrary();
  } catch(e) {
    log("Stored game mount failed: " + e.message, "err");
    showToast("❌ " + e.message);
  }
}

async function showGameInfo(name) {
  try {
    const meta = await ensureGameMetadata(name);
    const stat = (await opfsWalk(OPFS_GAMES_DIR, "", false)).find(g => g.path === name);
    const mounted = !!window.FS?.analyzePath?.(VIRTUAL_GAME_DIR + "/" + name).exists;
    const preloads = isPreloadFavorite(name);
    const title = meta.title || prettyGameName(name);
    const cover = await readGameCoverURL(name, meta.coverType);
    if (cover) _libraryCoverURLs.push(cover);

    const titleEl = byId("gameInfoTitle");
    const coverEl = byId("gameInfoCover");
    const rowsEl = byId("gameInfoRows");
    const modalEl = byId("gameInfoModal");
    if (!titleEl || !coverEl || !rowsEl || !modalEl) {
      showToast("Game details panel is not available in this page version.");
      return;
    }

    titleEl.textContent = title;
    coverEl.innerHTML = cover
      ? `<img src="${cover}" alt="${esc(title)} cover">`
      : `<div class="game-cover" style="height:100%;background:${gameAccent(name)}"><div class="game-cover-fallback">${esc(title.split(/\s+/).slice(0, 4).join(" "))}</div></div>`;
    rowsEl.innerHTML = [
      ["File", name],
      ["Format", meta.format || "Unknown"],
      ["Size", formatBytes(stat?.size || 0)],
      ["Stored", "OPFS /" + OPFS_GAMES_DIR + "/" + name],
      ["Runtime", VIRTUAL_GAME_DIR + "/" + name],
      ["Mounted", mounted ? "yes" : "no"],
      ["Preload", preloads ? "yes" : "no"],
      ["Cover", meta.coverType ? "yes" : "no"],
    ].map(([k, v]) => `<div class="game-info-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("");

    const favoriteBtn = byId("gameInfoFavoriteBtn");
    if (favoriteBtn) {
      favoriteBtn.innerHTML = `${svgIcon("preload")} ${preloads ? "Preloads" : "Preload"}`;
      favoriteBtn.classList.toggle("active", preloads);
      favoriteBtn.setAttribute("aria-pressed", preloads ? "true" : "false");
      favoriteBtn.onclick = async () => {
        closeGameInfo();
        await togglePreloadFavorite(name);
      };
    }

    const playBtn = byId("gameInfoPlayBtn");
    if (playBtn) {
      playBtn.textContent = started ? (mounted ? "Ready" : "Mount") : "Play";
      playBtn.disabled = started && mounted;
      playBtn.onclick = () => {
        closeGameInfo();
        playOrMountStoredGame(name);
      };
    }
    modalEl.classList.add("visible");
    modalEl.setAttribute("aria-hidden", "false");
  } catch(e) {
    log("Game info failed: " + e.message, "err");
    showToast("❌ Info failed: " + e.message);
  }
}

function closeGameInfo() {
  const modal = byId("gameInfoModal");
  if (!modal) return;
  modal.classList.remove("visible");
  modal.setAttribute("aria-hidden", "true");
}

function refreshEmulatorGameBrowser(reason) {
  const refresh = window.Module?._PPSSPP_RefreshGameBrowser;
  if (typeof refresh !== "function") {
    log("PPSSPP UI refresh hook is not available in this WASM build.", "dim");
    return false;
  }
  try {
    refresh();
    log("PPSSPP UI refresh requested" + (reason ? ": " + reason : "") + ".", "ok");
    return true;
  } catch(e) {
    log("PPSSPP UI refresh failed: " + (e?.message || e), "warn");
    return false;
  }
}

const mountOrSelectStoredGame = playOrMountStoredGame;
window.playOrMountStoredGame = playOrMountStoredGame;
window.mountOrSelectStoredGame = playOrMountStoredGame;
window.showGameInfo = showGameInfo;
window.closeGameInfo = closeGameInfo;
window.downloadStoredFile = downloadStoredFile;
window.deleteStoredFile = deleteStoredFile;

let _libraryCoverURLs = [];

function clearLibraryCoverURLs() {
  for (const url of _libraryCoverURLs) URL.revokeObjectURL(url);
  _libraryCoverURLs = [];
}

function loadPreloadFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRELOAD_FAVORITES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(name => typeof name === "string" && name) : [];
  } catch(e) {
    return [];
  }
}

function savePreloadFavorites(names) {
  const unique = [...new Set(names.filter(name => typeof name === "string" && name))].sort((a, b) => a.localeCompare(b));
  localStorage.setItem(PRELOAD_FAVORITES_KEY, JSON.stringify(unique));
  updatePreloadFavoriteSummary(unique.length);
  return unique;
}

function isPreloadFavorite(name) {
  return loadPreloadFavorites().includes(name);
}

function setPreloadFavorite(name, enabled) {
  const favorites = loadPreloadFavorites();
  const next = enabled ? [...favorites, name] : favorites.filter(item => item !== name);
  return savePreloadFavorites(next);
}

function ensurePreloadFavoritesMigrated(existingNames) {
  const existing = [...new Set(existingNames.filter(name => typeof name === "string" && name))];
  const migrated = localStorage.getItem(PRELOAD_FAVORITES_MIGRATED_KEY) === "1";
  const defaultsApplied = localStorage.getItem(PRELOAD_DEFAULTS_APPLIED_KEY) === "1";
  if (migrated && defaultsApplied) return loadPreloadFavorites();

  if (!migrated) localStorage.setItem(PRELOAD_FAVORITES_MIGRATED_KEY, "1");
  if (!existing.length) {
    localStorage.setItem(PRELOAD_DEFAULTS_APPLIED_KEY, "1");
    updatePreloadFavoriteSummary(0);
    return [];
  }

  const merged = savePreloadFavorites([...loadPreloadFavorites(), ...existing]);
  localStorage.setItem(PRELOAD_DEFAULTS_APPLIED_KEY, "1");
  log("Startup preload: enabled by default for " + existing.length + " existing library game" + (existing.length === 1 ? "" : "s") + ".", "ok");
  return merged;
}

function prunePreloadFavorites(existingNames) {
  const existing = new Set(existingNames);
  const favorites = ensurePreloadFavoritesMigrated(existingNames);
  const next = favorites.filter(name => existing.has(name));
  if (next.length !== favorites.length) savePreloadFavorites(next);
  else updatePreloadFavoriteSummary(next.length);
  return next;
}

function updatePreloadFavoriteSummary(count = loadPreloadFavorites().length) {
  const el = byId("libraryPreloadCount");
  if (el) el.textContent = count + " preload";
}

async function ensureGameMetadata(name) {
  const meta = await readGameMetadata(name);
  if (meta.updated) return meta;
  try {
    const bytes = await opfsReadGame(name);
    await writeGameMetadata(name, bytes);
    return await readGameMetadata(name);
  } catch(e) {
    return meta;
  }
}

function gameAccent(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const hue2 = (hue + 42) % 360;
  return `linear-gradient(135deg, hsl(${hue} 42% 28%), hsl(${hue2} 50% 13%) 58%, #080a0c)`;
}

async function refreshLibrary() {
  const grid = document.getElementById("libraryGrid");
  const empty = document.getElementById("libraryEmpty");
  const count = document.getElementById("libraryCount");
  if (!grid || !empty) return;

  clearLibraryCoverURLs();
  grid.style.display = "none";
  empty.style.display = "block";
  empty.textContent = "Loading library…";

  try {
    const games = await opfsWalk(OPFS_GAMES_DIR, "", false);
    games.sort((a, b) => a.path.localeCompare(b.path));
    const preloadFavorites = new Set(prunePreloadFavorites(games.map(game => game.path)));
    if (count) count.textContent = games.length + " game" + (games.length === 1 ? "" : "s");

    if (!games.length) {
      empty.innerHTML = "No games in OPFS yet.<br>Add a game file or launch one once.";
      return;
    }

    const cards = [];
    for (const game of games) {
      const meta = await ensureGameMetadata(game.path);
      const coverURL = await readGameCoverURL(game.path, meta.coverType);
      if (coverURL) _libraryCoverURLs.push(coverURL);
      const title = meta.title || prettyGameName(game.path);
      const format = meta.format || (game.path.split(".").pop() || "").toUpperCase();
      const mounted = !!window.FS?.analyzePath?.(VIRTUAL_GAME_DIR + "/" + game.path).exists;
      const preloads = preloadFavorites.has(game.path);
      const primary = started ? (mounted ? "Ready" : "Mount") : "Play";
      const primaryDisabled = started && mounted ? " disabled" : "";
      const fallback = title.split(/\s+/).slice(0, 4).join(" ");
      cards.push(`
        <div class="game-card">
          <div class="game-cover" style="background:${gameAccent(game.path)}">
            ${coverURL
              ? `<img src="${coverURL}" alt="${esc(title)} cover" loading="lazy">`
              : `<div class="game-cover-fallback">${esc(fallback)}</div>`}
          </div>
          <div class="game-card-body">
            <div class="game-card-title" title="${esc(title)}">${esc(title)}</div>
            <div class="game-card-meta" title="${esc(game.path)}">${esc(format)} · ${formatBytes(game.size || 0)}${preloads ? " · Preload" : ""}</div>
            <div class="game-card-actions">
              <button data-action="play" data-game="${esc(game.path)}"${primaryDisabled}>${primary}</button>
              <button class="icon-only preload-toggle${preloads ? " active" : ""}" title="${preloads ? "Remove from startup preload" : "Preload on startup"}" aria-pressed="${preloads ? "true" : "false"}" data-action="favorite" data-game="${esc(game.path)}">${svgIcon("preload")}</button>
              <button class="icon-only" title="Info" data-action="info" data-game="${esc(game.path)}">${svgIcon("info")}</button>
              <button class="icon-only drive-sync-btn" title="Upload game file to Drive" data-action="drive-upload" data-game="${esc(game.path)}">${svgIcon("cloud-upload")}</button>
              <button class="icon-only danger" title="Delete" data-action="delete" data-game="${esc(game.path)}">${svgIcon("trash")}</button>
            </div>
          </div>
        </div>
      `);
    }

    empty.style.display = "none";
    grid.style.display = "grid";
    grid.innerHTML = cards.join("");
  } catch(e) {
    empty.textContent = "Library error: " + e.message;
    if (count) count.textContent = "0 games";
  }
}

async function addGameToLibrary(file) {
  showToast("Adding " + file.name + "…");
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const storedName = await storeGameBytes(file.name, bytes);
    log("Library: added " + storedName + " to OPFS.", "ok");
    showToast("✓ Added " + storedName);
    await refreshLibrary();
    updateStorageInfo();
  } catch(e) {
    log("Library add failed: " + e.message, "err");
    showToast("❌ " + e.message);
  }
}

async function storeGameBytes(name, bytes) {
  const storedName = await opfsPutGame(name, bytes);
  return storedName;
}

function filenameFromContentDisposition(header) {
  if (!header) return "";
  const utf = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf) {
    try { return decodeURIComponent(utf[1].replace(/^"|"$/g, "")); } catch(e) {}
  }
  const simple = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  return simple ? simple[1].trim() : "";
}

function filenameFromURL(url) {
  try {
    const u = new URL(url, location.href);
    const name = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
    return name || "download.iso";
  } catch(e) {
    return "download.iso";
  }
}

async function readResponseBytes(response, label) {
  const total = Number(response.headers.get("content-length") || 0);
  if (!response.body?.getReader) return new Uint8Array(await response.arrayBuffer());

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (total) {
      const pct = received / total;
      showLoading("Downloading " + label + "… " + Math.round(pct * 100) + "%", pct);
      setStatus("Downloading " + label + " (" + formatBytes(received) + " / " + formatBytes(total) + ")", "run");
    } else {
      showLoading("Downloading " + label + "… " + formatBytes(received));
      setStatus("Downloading " + label + " (" + formatBytes(received) + ")", "run");
    }
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function addGameURLToLibrary(url) {
  const trimmed = url.trim();
  if (!trimmed) { showToast("Paste a game URL first"); return; }

  let parsed;
  try { parsed = new URL(trimmed, location.href); }
  catch(e) { showToast("❌ Invalid URL"); return; }
  if (!/^https?:$/i.test(parsed.protocol)) {
    showToast("❌ Only http/https links are supported");
    return;
  }

  const fallbackName = filenameFromURL(parsed.href);
  showToast("Downloading " + fallbackName + "…");
  showLoading("Downloading " + fallbackName + "…");
  setStatus("Downloading " + fallbackName, "run");

  try {
    const response = await fetch(parsed.href, { mode: "cors" });
    if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
    const headerName = filenameFromContentDisposition(response.headers.get("content-disposition"));
    const name = (headerName || fallbackName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const bytes = await readResponseBytes(response, name);
    const storedName = await storeGameBytes(name, bytes);
    hideLoading();
    log("Library: downloaded " + storedName + " from " + parsed.href + " (" + formatBytes(bytes.byteLength) + ").", "ok");
    showToast("✓ Downloaded " + storedName);
    setStatus("Library ready", "ok");
    const input = document.getElementById("libraryUrlInput");
    if (input) input.value = "";
    await refreshLibrary();
    updateStorageInfo();
  } catch(e) {
    hideLoading();
    const corsHint = /Failed to fetch|NetworkError|Load failed/i.test(e.message)
      ? " The server may need CORS enabled for browser downloads."
      : "";
    log("Library URL download failed: " + e.message + corsHint, "err");
    setStatus("Download failed", "err");
    showToast("❌ " + e.message, 5000);
  }
}

// Convert binary data to a data: URL for inline display
function toDataURL(data, ext) {
  try {
    const mime = /png/i.test(ext) ? "image/png" : "image/jpeg";
    const bytes = new Uint8Array(data);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return "data:" + mime + ";base64," + btoa(bin);
  } catch(e) { return null; }
}

/* ── Saves Tab ──────────────────────────────────────────────────── */
// PSP save paths:
//   SAVEDATA    → <memstick>/PSP/SAVEDATA/<GAMEID_TITLE>/<files>   (subdir per game)
//   PPSSPP_STATE → <memstick>/PSP/PPSSPP_STATE/<GAMEID>_ver_slot.ext  (FLAT, no subdir)
const SAVE_SUBDIRS = [
  { dir: "PSP/SAVEDATA",     flat: false, label: "Save Data"   },
  { dir: "PSP/PPSSPP_STATE", flat: true,  label: "Save States" },
];

function readSaveSlotFiles(FS, slotDir) {
  // returns [{name, path, size}] for all files inside a slot directory
  const files = [];
  let entries;
  try { entries = FS.readdir(slotDir); } catch(e) { return files; }
  for (const name of entries) {
    if (name === "." || name === "..") continue;
    const full = slotDir + "/" + name;
    try {
      const st = FS.stat(full);
      if (FS.isFile(st.mode)) files.push({ name, path: full, size: st.size });
    } catch(e) {}
  }
  return files;
}

// Build a unified file map from OPFS + live FS (FS takes priority as it's fresher)
async function buildSaveFileMap() {
  const opfsEntries = await opfsWalk();
  const map = new Map(); // path → {path, data, size, fromOPFS}
  for (const { path, data, size } of opfsEntries) {
    map.set(path, { path, data, size: data?.byteLength || size || 0, fromOPFS: true });
  }
  // Overlay with live FS if running (newer / authoritative)
  const FS = window.FS;
  if (FS) {
    const memstick = _detectedMemstick || detectMemstickDir(FS);
    const fsFiles  = fsWalkDir(FS, memstick);
    for (const { path, data } of fsFiles) {
      map.set(path, { path, data, size: data?.byteLength || 0, fromOPFS: false });
    }
  }
  return map;
}

// Extract game ID from a flat save-state filename like "ULES01384_1.00_0.ppst"
function gameIdFromStateFile(name) {
  // format: <GAMEID>_<ver>_<slot>.<ext>
  // GAMEID is everything up to the second-to-last underscore group
  const m = name.match(/^([A-Z]{4}\d{5}(?:_\d+\.?\d*)?)/i);
  return m ? m[1] : name.replace(/\.[^.]+$/, "");
}

// Group a flat file map into slots for display
function groupSavesBySlot(fileMap) {
  const slots = new Map(); // key → { subdir, label, flat, slotDir, game, files[] }

  for (const PERSIST_ROOT of PERSIST_ROOTS) {
    for (const { dir, flat, label } of SAVE_SUBDIRS) {
      const prefix = PERSIST_ROOT + "/" + dir + "/";

      for (const [path, entry] of fileMap) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);

        if (flat) {
          // PPSSPP_STATE: files are flat — e.g. "ULES01384_1.00_0.ppst"
          // rest has no slash (direct file in the dir)
          if (rest.includes("/")) continue; // skip if nested (shouldn't happen)
          const game    = gameIdFromStateFile(rest);
          const slotDir = PERSIST_ROOT + "/" + dir; // the dir itself is the "slot"
          const key     = dir + "\0" + game;
          if (!slots.has(key)) slots.set(key, { dir, label, flat: true, slotDir, game, files: [] });
          slots.get(key).files.push({ name: rest, path, size: entry.size, data: entry.data });
        } else {
          // SAVEDATA: <game>/<filename>
          const slash = rest.indexOf("/");
          if (slash === -1) continue; // bare file at subdir root, skip
          const game = rest.slice(0, slash);
          const name = rest.slice(slash + 1);
          if (!name || name.includes("/")) continue;
          const slotDir = PERSIST_ROOT + "/" + dir + "/" + game;
          const key     = dir + "\0" + slotDir;
          if (!slots.has(key)) slots.set(key, { dir, label, flat: false, slotDir, game, files: [] });
          slots.get(key).files.push({ name, path, size: entry.size, data: entry.data });
        }
      }
    }
  }
  return [...slots.values()];
}

async function refreshSavesTab() {
  const empty  = document.getElementById("savesEmpty");
  const list   = document.getElementById("savesList");
  const stats  = document.getElementById("savesStats");
  if (!empty || !list) return;

  // Show spinner while loading
  empty.style.display = "block";
  empty.innerHTML = `<span class="saves-loading">Loading saves&hellip;</span>`;
  list.style.display = "none";

  let fileMap;
  try { fileMap = await buildSaveFileMap(); }
  catch(e) { empty.innerHTML = "Error reading saves: " + esc(e.message); return; }

  const slots = groupSavesBySlot(fileMap);
  const fromFS  = !!window.FS;
  const source  = fromFS ? "live FS + OPFS" : "OPFS";

  if (!slots.length) {
    empty.style.display = "block";
    empty.innerHTML = "No save data found in OPFS or FS.<br><small>Play a game, create a save, then sync.</small>";
    list.style.display = "none";
    if (stats) stats.textContent = "";
    return;
  }

  let totalSlots = 0, totalBytes = 0;

  // Separate save data vs save states
  const saveDataSlots  = slots.filter(s => !s.flat);
  const saveStateSlots = slots.filter(s =>  s.flat);

  let html = "";

  /* ── Save Data section ── */
  if (saveDataSlots.length) {
    const sdBytes = saveDataSlots.reduce((s, sl) => s + sl.files.reduce((a, f) => a + f.size, 0), 0);
    html += `<div class="save-section-label"><span>${svgIcon("save")} Save Data</span><span>${saveDataSlots.length} slot${saveDataSlots.length !== 1 ? "s" : ""} · ${formatBytes(sdBytes)}</span></div>`;

    for (const { slotDir, game, files, flat } of saveDataSlots) {
      if (!files.length) continue;
      const slotBytes = files.reduce((s, f) => s + f.size, 0);
      totalSlots++; totalBytes += slotBytes;

      // Pick best thumbnail: ICON0.PNG > PIC1.PNG > first .png > first .jpg
      const byName = name => files.find(f => f.name.toUpperCase() === name);
      const thumbFile = byName("ICON0.PNG") || byName("PIC1.PNG") ||
                        files.find(f => /\.png$/i.test(f.name)) ||
                        files.find(f => /\.jpg$/i.test(f.name));
      const thumbExt  = thumbFile ? (thumbFile.name.split(".").pop() || "png") : "";
      const thumbURL  = thumbFile?.data ? toDataURL(thumbFile.data, thumbExt) : null;

      // Non-image files listed compactly
      const dataFiles = files.filter(f => !/\.(png|jpg|jpeg|bmp)$/i.test(f.name));
      const allPaths  = files.map(f => f.path);
      const fileSummary = dataFiles.map(f => f.name).join(" · ");

      html += `<div class="save-card">`;
      if (thumbURL) {
        html += `<img class="save-card-thumb" src="${thumbURL}" alt="cover" loading="lazy">`;
      } else {
        html += `<div class="save-card-thumb-placeholder">${svgIcon("save", "lucide save-ph-icon")}</div>`;
      }
      html += `<div class="save-card-body">`;
      html += `<div class="save-card-name" title="${esc(slotDir)}">${esc(game)}</div>`;
      html += `<div class="save-card-meta">${files.length} file${files.length !== 1 ? "s" : ""} &nbsp;·&nbsp; ${formatBytes(slotBytes)}</div>`;
      if (fileSummary) html += `<div class="save-card-files" title="${esc(fileSummary)}">${esc(fileSummary)}</div>`;
      html += `</div>`;
      html += `<div class="save-card-actions">`;
      html += `<button title="Download slot" data-save-action="download-slot" data-slot-dir="${esc(slotDir)}" data-game="${esc(game)}">${svgIcon("download")}</button>`;
      html += `<button class="drive-sync-btn" title="Upload slot to Drive" data-save-action="drive-upload-slot" data-slot-dir="${esc(slotDir)}" data-game="${esc(game)}">${svgIcon("cloud-upload")}</button>`;
      html += `<button class="del" title="Delete slot" data-save-action="delete-slot" data-slot-dir="${esc(slotDir)}" data-game="${esc(game)}">${svgIcon("trash")}</button>`;
      html += `</div>`;
      html += `</div>`;
    }
  }

  /* ── Save States section ── */
  if (saveStateSlots.length) {
    // Flatten all state files across game groups
    const allStateFiles = [];
    for (const { slotDir, game, files, flat } of saveStateSlots) {
      for (const f of files) allStateFiles.push({ f, slotDir, game, flat });
    }
    const ssBytes = allStateFiles.reduce((s, { f }) => s + f.size, 0);
    html += `<div class="save-section-label save-section-spaced"><span>${svgIcon("gamepad")} Save States</span><span>${allStateFiles.length} state${allStateFiles.length !== 1 ? "s" : ""} · ${formatBytes(ssBytes)}</span></div>`;

    // Pair .ppst/.sst with same-base .jpg thumbnail
    const stateByBase = new Map(); // base → { dataFile, thumbFile, slotDir, game, flat }
    for (const { f, slotDir, game, flat } of allStateFiles) {
      const dot  = f.name.lastIndexOf(".");
      const base = dot !== -1 ? f.name.slice(0, dot) : f.name;
      const ext  = dot !== -1 ? f.name.slice(dot + 1).toLowerCase() : "";
      if (!stateByBase.has(base)) stateByBase.set(base, { dataFile: null, thumbFile: null, slotDir, game, flat });
      if (ext === "jpg" || ext === "png") stateByBase.get(base).thumbFile = f;
      else stateByBase.get(base).dataFile = f;
    }

    for (const { dataFile, thumbFile, slotDir, game, flat } of stateByBase.values()) {
      const main = dataFile || thumbFile;
      if (!main) continue;
      totalSlots++; totalBytes += main.size + (thumbFile?.size || 0);
      const thumbURL = thumbFile?.data ? toDataURL(thumbFile.data, "jpg") : null;
      const allPaths = [main.path, ...(thumbFile && thumbFile !== main ? [thumbFile.path] : [])];
      const slotLabel = main.name.replace(/\.[^.]+$/, "");

      html += `<div class="save-state-row">`;
      if (thumbURL) {
        html += `<img class="save-state-thumb" src="${thumbURL}" alt="preview" loading="lazy">`;
      }
      html += `<div class="save-state-body">`;
      html += `<div class="save-state-name" title="${esc(main.path)}">${esc(slotLabel)}</div>`;
      html += `<div class="save-state-meta">${formatBytes(main.size)}</div>`;
      html += `</div>`;
      html += `<div class="save-state-actions">`;
      if (dataFile) html += `<button title="Download" data-save-action="download-file" data-path="${esc(dataFile.path)}">${svgIcon("download")}</button>`;
      html += `<button class="drive-sync-btn" title="Upload state to Drive" data-save-action="drive-upload-state" data-paths="${esc(JSON.stringify(allPaths))}" data-game="${esc(game)}">${svgIcon("cloud-upload")}</button>`;
      html += `<button class="del" title="Delete" data-save-action="delete-pair" data-paths="${esc(JSON.stringify(allPaths))}">${svgIcon("trash")}</button>`;
      html += `</div>`;
      html += `</div>`;
    }
  }

  empty.style.display = "none";
  list.style.display  = "block";
  list.innerHTML = html;
  if (stats) stats.textContent =
    totalSlots + " slot" + (totalSlots !== 1 ? "s" : "") +
    " · " + formatBytes(totalBytes) +
    " · source: " + source;
}

// Read file data from FS first, fallback to OPFS
async function readSaveFileData(path) {
  const FS = window.FS;
  if (FS) { try { return FS.readFile(path); } catch(e) {} }
  return opfsRead(path);
}

async function downloadSaveFile(path) {
  try {
    const data = await readSaveFileData(path);
    const name = path.split("/").pop();
    const blob = new Blob([data], { type: "application/octet-stream" });
    triggerDownload(blob, name);
    showToast("✓ Downloaded " + name);
  } catch(e) { showToast("❌ " + e.message); }
}

async function downloadSaveSlot(slotDir, gameName) {
  // Collect all OPFS entries for this slot
  const all   = await opfsWalk();
  const files = all.filter(e => e.path.startsWith(slotDir + "/"));
  // Also grab any FS-only files not yet persisted
  const FS = window.FS;
  if (FS) {
    const fsFiles = readSaveSlotFiles(FS, slotDir);
    for (const { path } of fsFiles) {
      if (!files.find(e => e.path === path)) {
        try { files.push({ path, data: FS.readFile(path) }); } catch(e) {}
      }
    }
  }
  if (!files.length) { showToast("No files in slot"); return; }
  const bundle = {
    version: 1, exported: new Date().toISOString(),
    slot: gameName, slotDir,
    files: files.map(({ path, data }) => ({
      name: path.split("/").pop(), path,
      data: bytesToBase64(data)
    }))
  };
  const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
  triggerDownload(blob, "ppsspp-slot-" + gameName.replace(/[^a-zA-Z0-9_-]/g, "_") + ".ppsspp");
  log("Downloaded slot: " + gameName + " (" + files.length + " files)", "ok");
  showToast("✓ Downloaded " + gameName);
}

/* ── Individual Drive upload helpers ────────────────────────────── */
async function uploadSingleSaveSlotToDrive(slotDir, gameName) {
  if (!googleAccessToken) { showToast("⚠ Connect Google Drive first"); return; }
  try {
    setDriveActivity("Uploading slot " + gameName + "…", "run");
    if (window.FS) await persistFiles(window.FS, "drive-slot");
    await ensureDriveFolders(true);
    const all = await opfsWalk();
    const slotFiles = all.filter(e => e.path.startsWith(slotDir + "/"));
    const FS = window.FS;
    if (FS) {
      const fsFiles = readSaveSlotFiles(FS, slotDir);
      for (const { path } of fsFiles) {
        if (!slotFiles.find(e => e.path === path)) {
          try { slotFiles.push({ path, data: FS.readFile(path) }); } catch(e) {}
        }
      }
    }
    if (!slotFiles.length) { showToast("No files in slot"); setDriveActivity("Idle"); return; }
    const bundle = {
      version: 1, exported: new Date().toISOString(),
      slot: gameName, slotDir,
      files: slotFiles.map(({ path, data }) => ({ name: path.split("/").pop(), path, data: bytesToBase64(data) }))
    };
    const bytes = new TextEncoder().encode(JSON.stringify(bundle));
    const remoteName = "ppsspp-slot-" + gameName.replace(/[^a-zA-Z0-9_-]/g, "_") + ".ppsspp";
    showLoading("Uploading " + remoteName + " to Drive…");
    await uploadBlobToDrive(remoteName, googleDriveSavesId, bytes, "application/json", "Uploading slot");
    log("Google Drive: uploaded slot " + gameName + " (" + slotFiles.length + " files).", "ok");
    setDriveActivity("Uploaded slot " + gameName, "ok");
    showToast("✓ Slot " + gameName + " uploaded to Drive");
    await refreshDriveList();
  } catch(e) {
    const message = googleAuthErrorMessage(e);
    log("Drive slot upload failed: " + message, "err");
    setDriveActivity("Slot upload failed: " + message, "bad");
    showToast("❌ " + message, 5000);
  } finally { hideLoading(); }
}

async function uploadSingleSaveStateToDrive(paths, gameName) {
  if (!googleAccessToken) { showToast("⚠ Connect Google Drive first"); return; }
  try {
    setDriveActivity("Uploading state for " + gameName + "…", "run");
    if (window.FS) await persistFiles(window.FS, "drive-state");
    await ensureDriveFolders(true);
    const FS = window.FS;
    const fileEntries = [];
    for (const path of paths) {
      let data;
      try { data = await opfsRead(path); } catch(e) {
        if (FS) { try { data = FS.readFile(path); } catch(e2) {} }
      }
      if (data) fileEntries.push({ path, data });
    }
    if (!fileEntries.length) { showToast("No state files found"); setDriveActivity("Idle"); return; }
    const baseName = paths[0].split("/").pop().replace(/\.[^.]+$/, "");
    const bundle = {
      version: 1, exported: new Date().toISOString(),
      slot: gameName,
      files: fileEntries.map(({ path, data }) => ({ name: path.split("/").pop(), path, data: bytesToBase64(data) }))
    };
    const bytes = new TextEncoder().encode(JSON.stringify(bundle));
    const remoteName = "ppsspp-state-" + gameName.replace(/[^a-zA-Z0-9_-]/g, "_") + "-" + baseName + ".ppsspp";
    showLoading("Uploading " + remoteName + " to Drive…");
    await uploadBlobToDrive(remoteName, googleDriveSavesId, bytes, "application/json", "Uploading state");
    log("Google Drive: uploaded state " + remoteName + ".", "ok");
    setDriveActivity("Uploaded state " + baseName, "ok");
    showToast("✓ State " + baseName + " uploaded to Drive");
    await refreshDriveList();
  } catch(e) {
    const message = googleAuthErrorMessage(e);
    log("Drive state upload failed: " + message, "err");
    setDriveActivity("State upload failed: " + message, "bad");
    showToast("❌ " + message, 5000);
  } finally { hideLoading(); }
}

async function uploadSingleGameToDrive(gameName) {
  if (!googleAccessToken) { showToast("⚠ Connect Google Drive first"); return; }
  try {
    setDriveActivity("Uploading game " + gameName + "…", "run");
    await ensureDriveFolders(true);
    showLoading("Uploading " + gameName + " to Drive…");
    const bytes = await opfsReadGame(gameName);
    await uploadBlobToDrive(gameName, googleDriveGamesId, bytes, "application/octet-stream", "Uploading game");
    log("Google Drive: uploaded game " + gameName + " (" + formatBytes(bytes.byteLength) + ").", "ok");
    setDriveActivity("Uploaded " + gameName + " to Drive", "ok");
    showToast("✓ " + gameName + " uploaded to Drive");
    await refreshDriveList();
  } catch(e) {
    const message = googleAuthErrorMessage(e);
    log("Drive game upload failed: " + message, "err");
    setDriveActivity("Game upload failed: " + message, "bad");
    showToast("❌ " + message, 5000);
  } finally { hideLoading(); }
}

async function deleteSaveFile(path) {
  if (!confirm("Delete file:\n" + path.split("/").pop() + "?")) return;
  // Remove from OPFS
  try { await opfsDelete(path); } catch(e) {}
  // Remove from FS if running
  const FS = window.FS;
  if (FS) { try { FS.unlink(path); } catch(e) {} }
  showToast("🗑 Deleted " + path.split("/").pop());
  refreshSavesTab(); updateStorageInfo();
}

async function deleteSavePair(paths) {
  const names = paths.map(p => p.split("/").pop()).join("\n");
  if (!confirm("Delete:\n" + names + "?\n\nThis cannot be undone.")) return;
  const FS = window.FS;
  for (const path of paths) {
    try { await opfsDelete(path); } catch(e) {}
    if (FS) { try { FS.unlink(path); } catch(e) {} }
  }
  showToast("🗑 Deleted " + paths.map(p => p.split("/").pop()).join(", "));
  refreshSavesTab(); updateStorageInfo();
}

async function deleteSaveSlot(slotDir, gameName) {
  if (!confirm("Delete ALL saves for:\n" + gameName + "?\n\nThis cannot be undone.")) return;
  // Delete all OPFS entries under this slot
  const all   = await opfsWalk();
  const paths = all.filter(e => e.path.startsWith(slotDir + "/")).map(e => e.path);
  for (const path of paths) {
    try { await opfsDelete(path); } catch(e) {}
  }
  // Also remove from live FS
  const FS = window.FS;
  if (FS) {
    try {
      const files = readSaveSlotFiles(FS, slotDir);
      for (const { path } of files) { try { FS.unlink(path); } catch(e) {} }
      try { FS.rmdir(slotDir); } catch(e) {}
    } catch(e) {}
  }
  log("Deleted slot: " + gameName, "warn");
  showToast("🗑 Deleted slot: " + gameName);
  refreshSavesTab(); updateStorageInfo();
}

async function importSaveSlot(file) {
  try {
    const bundle = JSON.parse(await file.text());
    if (!Array.isArray(bundle.files)) throw new Error("Invalid slot bundle");
    let count = 0;
    const FS = window.FS;
    for (const { path, data } of bundle.files) {
      const bytes = base64ToBytes(data);
      // Always save to OPFS
      await opfsPut(path, bytes);
      // Also write to live FS if running
      if (FS) {
        try {
          fsMkdirP(FS, path.substring(0, path.lastIndexOf("/")));
          FS.writeFile(path, bytes);
        } catch(e) {}
      }
      count++;
    }
    log("Imported slot '" + (bundle.slot || file.name) + "' (" + count + " files)", "ok");
    showToast("✓ Imported slot: " + (bundle.slot || file.name));
    refreshSavesTab(); updateStorageInfo();
  } catch(e) { log("Slot import error: " + e.message, "err"); showToast("❌ Import failed: " + e.message); }
}

// Restore persisted files into Emscripten FS before PPSSPP starts
async function loadPersistedFiles(FS) {
  try {
    const entries = await opfsWalk();
    if (!entries.length) { log("Persistence: no saved data in OPFS.", "dim"); return; }
    let ok = 0;
    for (const { path, data } of entries) {
      try {
        fsMkdirP(FS, path.substring(0, path.lastIndexOf("/")));
        FS.writeFile(path, data);
        ok++;
      } catch(e) { log("Persist restore failed " + path + ": " + e.message, "warn"); }
    }
    log("Persistence: restored " + ok + "/" + entries.length + " files from OPFS.", "ok");
    showToast("✓ Restored " + ok + " saved files");
    // Seed dirty-tracking so the first auto-sync cycle is fully incremental
    _detectedMemstick = detectMemstickDir(FS);
    const initStats = fsStatDir(FS, _detectedMemstick);
    for (const [path, { size, mtime }] of initStats)
      _persistedFileState.set(path, size + ":" + mtime);
  } catch(e) { log("Persistence: OPFS load error: " + e.message, "warn"); }
}

function patchIniValue(text, section, key, value) {
  const lines = text ? text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n") : [];
  const sectionHeader = "[" + section + "]";
  const sectionRe = /^\s*\[([^\]]+)\]\s*$/;
  const keyRe = new RegExp("^\\s*" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*=");
  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(sectionRe);
    if (!match) continue;
    if (match[1] === section) {
      sectionStart = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (sectionRe.test(lines[j])) { sectionEnd = j; break; }
      }
      break;
    }
  }

  if (sectionStart === -1) {
    if (lines.length && lines[lines.length - 1] !== "") lines.push("");
    lines.push(sectionHeader, key + " = " + value);
  } else {
    for (let i = sectionStart + 1; i < sectionEnd; i++) {
      if (keyRe.test(lines[i])) {
        lines[i] = key + " = " + value;
        return lines.join("\n").replace(/\n*$/, "\n");
      }
    }
    lines.splice(sectionEnd, 0, key + " = " + value);
  }

  return lines.join("\n").replace(/\n*$/, "\n");
}

function defaultNetworkServerHost() {
  const host = location.hostname || "127.0.0.1";
  return host === "localhost" ? "127.0.0.1" : host;
}

function normalizeNetworkServerHost(value) {
  let host = String(value || "").trim();
  if (!host) return defaultNetworkServerHost();

  try {
    const parsed = new URL(host.includes("://") ? host : "ws://" + host);
    host = parsed.hostname || host;
  } catch(e) {
    host = host.split(/[/?#]/, 1)[0];
    if (host.startsWith("[") && host.includes("]")) {
      host = host.slice(1, host.indexOf("]"));
    } else {
      host = host.replace(/:\d+$/, "");
    }
  }

  host = host.trim();
  return host || defaultNetworkServerHost();
}

function browserRelayServerHost() {
  return normalizeNetworkServerHost(defaultNetworkServerHost());
}

function randomPspMac() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  bytes[0] = (bytes[0] & 0xFE) | 0x02;
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(":");
}

function sanitizeNetworkNick(value) {
  const clean = String(value || "WebPlayer").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16);
  return clean.length >= 3 ? clean : "WebPlayer";
}

function sanitizeNetworkMac(value) {
  const clean = String(value || "").trim().toLowerCase();
  return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(clean) ? clean : randomPspMac();
}

function loadNetworkConfig() {
  if (localStorage.getItem(NETWORK_ENABLE_KEY) === null) {
    localStorage.setItem(NETWORK_ENABLE_KEY, "1");
  }
  let server = localStorage.getItem(NETWORK_SERVER_KEY);
  if (!server) {
    server = browserRelayServerHost();
  } else {
    server = normalizeNetworkServerHost(server);
  }
  if (server !== browserRelayServerHost()) server = browserRelayServerHost();
  localStorage.setItem(NETWORK_SERVER_KEY, server);
  let nick = localStorage.getItem(NETWORK_NICK_KEY);
  if (!nick) {
    nick = "WebPlayer";
    localStorage.setItem(NETWORK_NICK_KEY, nick);
  }
  let mac = localStorage.getItem(NETWORK_MAC_KEY);
  if (!mac || !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) {
    mac = randomPspMac();
    localStorage.setItem(NETWORK_MAC_KEY, mac);
  }
  return {
    enabled: localStorage.getItem(NETWORK_ENABLE_KEY) === "1",
    server,
    nick: sanitizeNetworkNick(nick),
    mac: sanitizeNetworkMac(mac),
  };
}

function testWebSocket(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { ws.close(); } catch(e) {}
      reject(new Error("timeout"));
    }, timeoutMs);
    let ws;
    try {
      ws = new WebSocket(url, "binary");
      ws.binaryType = "arraybuffer";
      ws.onopen = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        ws.close();
        resolve();
      };
      ws.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error("connection failed"));
      };
    } catch(e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

async function testNetworkRelay() {
  const cfg = saveNetworkConfigFromUI();
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  const relayHost = browserRelayServerHost();
  const base = `${scheme}://${relayHost}:${ADHOC_WS_PORT}`;
  updateNetworkConfigUI(cfg, "Testing relay...");
  try {
    await testWebSocket(base + "/", 5000);
    await testWebSocket(base + `/udp?mac=${encodeURIComponent(cfg.mac)}&port=39999`, 5000);
    updateNetworkConfigUI(cfg, "Relay OK. Use this host as the ad hoc server in browser builds.");
    log("Network: relay test passed for " + base, "ok");
  } catch(e) {
    const message = "Relay test failed: " + (e?.message || e) + ". Accept the HTTPS certificate and use this host, not a public desktop-only server.";
    updateNetworkConfigUI(cfg, message);
    log("Network: " + message, "err");
  }
}

function saveNetworkConfigFromUI() {
  const cfg = {
    enabled: !!networkEnableToggle?.checked,
    server: browserRelayServerHost(),
    nick: sanitizeNetworkNick(networkNickInput?.value),
    mac: sanitizeNetworkMac(networkMacInput?.value),
  };
  localStorage.setItem(NETWORK_ENABLE_KEY, cfg.enabled ? "1" : "0");
  localStorage.setItem(NETWORK_SERVER_KEY, cfg.server);
  localStorage.setItem(NETWORK_NICK_KEY, cfg.nick);
  localStorage.setItem(NETWORK_MAC_KEY, cfg.mac);
  updateNetworkConfigUI(cfg, "Saved. Restart PPSSPP to re-apply network defaults.");
  return cfg;
}

function updateNetworkConfigUI(cfg = loadNetworkConfig(), message = "") {
  if (networkEnableToggle) networkEnableToggle.checked = cfg.enabled;
  if (networkServerInput) networkServerInput.value = cfg.server;
  if (networkNickInput) networkNickInput.value = cfg.nick;
  if (networkMacInput) networkMacInput.value = cfg.mac;
  if (netServerEl) netServerEl.textContent = cfg.server;
  if (netPortEl) netPortEl.textContent = String(ADHOC_WS_PORT);
  if (networkActivityEl && message) networkActivityEl.textContent = message;
}

function installWebSocketNetworkShim() {
  if (installWebSocketNetworkShim.installed || !window.WebSocket) return;
  installWebSocketNetworkShim.installed = true;
  const NativeWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    let nextUrl = String(url);
    if (location.protocol === "https:" && nextUrl.startsWith("ws://")) {
      try {
        const parsed = new URL(nextUrl);
        if (parsed.port === String(ADHOC_WS_PORT) || normalizeNetworkServerHost(parsed.hostname) === browserRelayServerHost()) {
          parsed.protocol = "wss:";
          nextUrl = parsed.toString();
        }
      } catch(e) {}
    }
    return new NativeWebSocket(nextUrl, protocols);
  };
  window.WebSocket.prototype = NativeWebSocket.prototype;
  Object.defineProperty(window.WebSocket, "OPEN", { value: NativeWebSocket.OPEN });
  Object.defineProperty(window.WebSocket, "CONNECTING", { value: NativeWebSocket.CONNECTING });
  Object.defineProperty(window.WebSocket, "CLOSING", { value: NativeWebSocket.CLOSING });
  Object.defineProperty(window.WebSocket, "CLOSED", { value: NativeWebSocket.CLOSED });
}

function numericHostToText(host) {
  if (typeof host !== "number") return String(host || "");
  return [host & 255, (host >> 8) & 255, (host >> 16) & 255, (host >> 24) & 255].join(".");
}

function relayPacket(dstHost, dstPort, payload) {
  const hostBytes = new TextEncoder().encode(numericHostToText(dstHost));
  if (hostBytes.length > 255) throw new Error("Relay host is too long");
  const frame = new Uint8Array(4 + hostBytes.length + 2 + payload.byteLength);
  frame[0] = 0x50; frame[1] = 0x55; frame[2] = 0x31; frame[3] = hostBytes.length;
  frame.set(hostBytes, 4);
  frame[4 + hostBytes.length] = (dstPort >> 8) & 255;
  frame[5 + hostBytes.length] = dstPort & 255;
  frame.set(payload, 6 + hostBytes.length);
  return frame;
}

function streamRelayPacket(kind, connId, payload = new Uint8Array(0)) {
  const frame = new Uint8Array(8 + payload.byteLength);
  frame[0] = 0x50; frame[1] = 0x54; frame[2] = 0x31; frame[3] = kind;
  frame[4] = (connId >>> 24) & 255;
  frame[5] = (connId >>> 16) & 255;
  frame[6] = (connId >>> 8) & 255;
  frame[7] = connId & 255;
  frame.set(payload, 8);
  return frame;
}

function relayUrl(path, params) {
  const cfg = loadNetworkConfig();
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  const query = new URLSearchParams(params);
  return `${scheme}://${cfg.server}:${ADHOC_WS_PORT}${path}?${query.toString()}`;
}

function socketPayload(buffer, offset, length) {
  if (ArrayBuffer.isView(buffer)) {
    offset += buffer.byteOffset;
    buffer = buffer.buffer;
  }
  let payload = buffer.slice(offset, offset + length);
  if (payload instanceof SharedArrayBuffer) {
    payload = new Uint8Array(new Uint8Array(payload)).buffer;
  }
  return new Uint8Array(payload);
}

function installSockFSAdhocRelay() {
  const SOCKFS = window.SOCKFS;
  if (!SOCKFS?.websocket_sock_ops || SOCKFS.websocket_sock_ops.__ppssppRelayInstalled) return false;

  const ops = SOCKFS.websocket_sock_ops;
  const originalBind = ops.bind.bind(ops);
  const originalListen = ops.listen.bind(ops);
  const originalConnect = ops.connect.bind(ops);
  const originalClose = ops.close.bind(ops);
  const originalSendmsg = ops.sendmsg.bind(ops);
  const decoder = new TextDecoder();

  function openRelay(sock) {
    const cfg = loadNetworkConfig();
    if (!cfg.enabled || sock.type !== 2 || !sock.sport || sock.__ppssppRelay) return;
    const url = relayUrl("/udp", { mac: cfg.mac, port: sock.sport });
    const relay = {
      ws: new WebSocket(url, "binary"),
      queue: [],
      open: false,
    };
    relay.ws.binaryType = "arraybuffer";
    relay.ws.onopen = () => {
      relay.open = true;
      while (relay.queue.length) relay.ws.send(relay.queue.shift());
    };
    relay.ws.onmessage = event => {
      const data = new Uint8Array(event.data);
      if (data.length < 7 || data[0] !== 0x50 || data[1] !== 0x55 || data[2] !== 0x31) return;
      const hostLen = data[3];
      const headerLen = 4 + hostLen + 2;
      if (data.length < headerLen) return;
      const sourceHost = decoder.decode(data.slice(4, 4 + hostLen));
      const sourcePort = (data[4 + hostLen] << 8) | data[5 + hostLen];
      sock.recv_queue.push({
        addr: sourceHost,
        port: sourcePort,
        data: data.slice(headerLen),
      });
      SOCKFS.emit("message", sock.stream.fd);
    };
    relay.ws.onclose = () => { relay.open = false; };
    relay.ws.onerror = () => { relay.open = false; };
    sock.__ppssppRelay = relay;
  }

  function makeVirtualStreamSocket(listenSock, listenRelay, connId, sourceHost, sourcePort) {
    const socket = {
      url: `ws://${sourceHost}:${sourcePort}`,
      binaryType: "arraybuffer",
      readyState: WebSocket.OPEN,
      send(data) {
        if (this.readyState !== WebSocket.OPEN) return;
        const payload = data instanceof Uint8Array ? data : new Uint8Array(data);
        listenRelay.ws.send(streamRelayPacket(2, connId, payload));
      },
      close() {
        if (this.readyState === WebSocket.CLOSED) return;
        this.readyState = WebSocket.CLOSED;
        try { listenRelay.ws.send(streamRelayPacket(3, connId)); } catch(e) {}
        setTimeout(() => this.onclose?.(), 0);
      },
      closeLocal() {
        if (this.readyState === WebSocket.CLOSED) return;
        this.readyState = WebSocket.CLOSED;
        setTimeout(() => this.onclose?.(), 0);
      },
    };
    const newsock = SOCKFS.createSocket(listenSock.family, listenSock.type, listenSock.protocol);
    const peer = ops.createPeer(newsock, socket);
    newsock.daddr = peer.addr;
    newsock.dport = peer.port;
    newsock.stream.flags = listenSock.stream.flags;
    listenSock.__ppssppTcpAccepted[connId] = socket;
    listenSock.pending.push(newsock);
    SOCKFS.emit("connection", newsock.stream.fd);
  }

  function openTcpListener(sock) {
    const cfg = loadNetworkConfig();
    if (!cfg.enabled || sock.type !== 1 || !sock.sport || sock.__ppssppTcpListenRelay) return;
    const relay = {
      ws: new WebSocket(relayUrl("/tcp-listen", { mac: cfg.mac, port: sock.sport }), "binary"),
      open: false,
    };
    sock.__ppssppTcpAccepted = {};
    relay.ws.binaryType = "arraybuffer";
    relay.ws.onopen = () => {
      relay.open = true;
      SOCKFS.emit("listen", sock.stream.fd);
    };
    relay.ws.onmessage = event => {
      const data = new Uint8Array(event.data);
      if (data.length < 8 || data[0] !== 0x50 || data[1] !== 0x54 || data[2] !== 0x31) return;
      const kind = data[3];
      const connId = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];
      if (kind === 1) {
        if (data.length < 11) return;
        const hostLen = data[8];
        const headerLen = 9 + hostLen + 2;
        if (data.length < headerLen) return;
        const sourceHost = decoder.decode(data.slice(9, 9 + hostLen));
        const sourcePort = (data[9 + hostLen] << 8) | data[10 + hostLen];
        makeVirtualStreamSocket(sock, relay, connId, sourceHost, sourcePort);
      } else if (kind === 2) {
        const accepted = sock.__ppssppTcpAccepted?.[connId];
        if (!accepted || accepted.readyState !== WebSocket.OPEN) return;
        const payload = data.slice(8);
        accepted.onmessage?.({ data: payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength) });
      } else if (kind === 3) {
        const accepted = sock.__ppssppTcpAccepted?.[connId];
        accepted?.closeLocal();
        delete sock.__ppssppTcpAccepted?.[connId];
      }
    };
    relay.ws.onclose = () => { relay.open = false; };
    relay.ws.onerror = () => { relay.open = false; };
    sock.__ppssppTcpListenRelay = relay;
    sock.server = {
      close() {
        try { relay.ws.close(); } catch(e) {}
      },
    };
  }

  ops.bind = function(sock, addr, port) {
    const result = originalBind(sock, addr, port);
    openRelay(sock);
    return result;
  };

  ops.listen = function(sock, backlog) {
    if (sock.type !== 1 || !loadNetworkConfig().enabled) {
      return originalListen(sock, backlog);
    }
    if (sock.server) throw new FS.ErrnoError(28);
    openTcpListener(sock);
  };

  ops.connect = function(sock, addr, port) {
    if (sock.type !== 1 || !loadNetworkConfig().enabled) {
      return originalConnect(sock, addr, port);
    }
    if (sock.server) throw new FS.ErrnoError(138);
    if (!sock.sport) sock.sport = 49152 + Math.floor(Math.random() * 12000);
    const cfg = loadNetworkConfig();
    const url = relayUrl("/tcp-connect", {
      mac: cfg.mac,
      port: sock.sport,
      dst: numericHostToText(addr),
      dstport: port,
    });
    const ws = new WebSocket(url, "binary");
    ws.binaryType = "arraybuffer";
    const peer = { addr, port, socket: ws, msg_send_queue: [] };
    ops.addPeer(sock, peer);
    ops.handlePeerEvents(sock, peer);
    sock.daddr = addr;
    sock.dport = port;
    sock.connecting = true;
  };

  ops.sendmsg = function(sock, buffer, offset, length, addr, port) {
    if (sock.type !== 2 || !loadNetworkConfig().enabled) {
      return originalSendmsg(sock, buffer, offset, length, addr, port);
    }
    openRelay(sock);
    if (!sock.__ppssppRelay || addr === undefined || port === undefined) {
      return originalSendmsg(sock, buffer, offset, length, addr, port);
    }
    const frame = relayPacket(addr, port, socketPayload(buffer, offset, length));
    const relay = sock.__ppssppRelay;
    if (relay.open && relay.ws.readyState === WebSocket.OPEN) relay.ws.send(frame);
    else relay.queue.push(frame);
    return length;
  };

  ops.close = function(sock) {
    if (sock.__ppssppRelay) {
      try { sock.__ppssppRelay.ws.close(); } catch(e) {}
      sock.__ppssppRelay = null;
    }
    if (sock.__ppssppTcpListenRelay) {
      try { sock.__ppssppTcpListenRelay.ws.close(); } catch(e) {}
      sock.__ppssppTcpListenRelay = null;
      sock.__ppssppTcpAccepted = {};
    }
    return originalClose(sock);
  };

  ops.__ppssppRelayInstalled = true;
  log("Network: SOCKFS UDP/PTP relay installed.", "ok");
  return true;
}

async function applyNetworkConfig(FS, text) {
  const cfg = loadNetworkConfig();
  let patched = text;
  patched = patchIniValue(patched, "Network", "EnableWlan", cfg.enabled ? "True" : "False");
  patched = patchIniValue(patched, "Network", "proAdhocServer", cfg.server);
  patched = patchIniValue(patched, "Network", "EnableAdhocServer", "False");
  patched = patchIniValue(patched, "Network", "ForcedFirstConnect", "True");
  patched = patchIniValue(patched, "Network", "PortOffset", "10000");
  patched = patchIniValue(patched, "Network", "MinTimeout", "1");
  patched = patchIniValue(patched, "Network", "EnableUPnP", "False");
  patched = patchIniValue(patched, "SystemParam", "NickName", cfg.nick);
  patched = patchIniValue(patched, "SystemParam", "MacAddress", cfg.mac);
  patched = patchIniValue(patched, "SystemParam", "WlanAdhocChannel", "0");
  if (cfg.enabled) installWebSocketNetworkShim();
  return patched;
}

async function forceGamesDirectoryConfig(FS) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const applyMobileTouchDefaults = isMobileExperience();

  for (const root of PERSIST_ROOTS) {
    const iniPath = root + "/PSP/SYSTEM/ppsspp.ini";
    try {
      fsMkdirP(FS, root + "/PSP/SYSTEM");
      let text = "";
      try { text = decoder.decode(FS.readFile(iniPath)); } catch(e) {}
      let patched = patchIniValue(text, "General", "CurrentDirectory", VIRTUAL_GAME_DIR);
      patched = await applyNetworkConfig(FS, patched);
      for (const [section, key, value] of WEB_NATIVE_TIMING_CONFIG) {
        patched = patchIniValue(patched, section, key, value);
      }
      for (const [section, key, value] of WEB_STABILITY_CONFIG) {
        patched = patchIniValue(patched, section, key, value);
      }
      if (applyMobileTouchDefaults) {
        for (const [section, key, value] of MOBILE_TOUCH_CONFIG) {
          patched = patchIniValue(patched, section, key, value);
        }
      }
      const bytes = encoder.encode(patched);
      FS.writeFile(iniPath, bytes);
      await opfsPut(iniPath, bytes);
      log("Config: web native timing/audio defaults applied to " + iniPath + (applyMobileTouchDefaults ? " (mobile touch/UI enabled)" : ""), "ok");
    } catch(e) {
      log("Config: failed to apply web defaults at " + iniPath + ": " + e.message, "warn");
    }
  }
}

// Save config+saves from Emscripten FS to OPFS — incremental (only changed/deleted files)
async function persistFiles(FS, label) {
  _detectedMemstick = detectMemstickDir(FS);
  const currentStats = fsStatDir(FS, _detectedMemstick);

  if (!currentStats.size) {
    log("Persistence" + (label ? " [" + label + "]" : "") + ": nothing at " + _detectedMemstick, "dim");
    updateStorageInfo(); return;
  }

  // Collect files whose size or mtime has changed since last persist
  const dirty = [];
  for (const [path, { size, mtime }] of currentStats) {
    const fp = size + ":" + mtime;
    if (_persistedFileState.get(path) !== fp) dirty.push({ path, fp });
  }

  // Collect files that were persisted but no longer exist in FS
  const deleted = [];
  for (const path of _persistedFileState.keys()) {
    if (!currentStats.has(path)) deleted.push(path);
  }

  if (!dirty.length && !deleted.length) {
    log("Persistence [" + (label || "auto") + "]: up-to-date, nothing to sync.", "dim");
    return;
  }

  let written = 0, removed = 0;
  try {
    for (const { path, fp } of dirty) {
      try {
        const data = FS.readFile(path);
        await opfsPut(path, data);
        _persistedFileState.set(path, fp);
        written++;
      } catch(e) { log("Persist write failed " + path + ": " + e.message, "warn"); }
    }
    for (const path of deleted) {
      try { await opfsDelete(path); } catch(e) {}
      _persistedFileState.delete(path);
      removed++;
    }
    _lastPersistTime = Date.now();
    const parts = [];
    if (written) parts.push(written + " written");
    if (removed) parts.push(removed + " removed");
    log("Persistence [" + (label || "manual") + "]: " + parts.join(", ") +
        " of " + currentStats.size + " total files.", "ok");
    updateStorageInfo();
  } catch(e) { log("Persistence: OPFS write error: " + e.message, "warn"); }
}

function startAutoPersist() {
  setInterval(() => {
    const FS = window.FS;
    if (!started || !FS) return;
    persistFiles(FS, "auto");
  }, PERSIST_SYNC_MS);
}

/* ── Drive auto-sync ─────────────────────────────────────────────── */
let _driveAutoSyncTimer = null;
let _driveAutoSyncLastAt = 0;

function driveAutoSyncEnabled() {
  return localStorage.getItem(GOOGLE_AUTO_SYNC_KEY) === "1";
}

function driveAutoSyncRate() {
  return Math.max(60, Number(localStorage.getItem(GOOGLE_AUTO_SYNC_RATE_KEY) || 300));
}

function updateDriveAutoSyncUI() {
  const toggle   = document.getElementById("driveAutoSyncToggle");
  const interval = document.getElementById("driveAutoSyncInterval");
  const status   = document.getElementById("driveAutoSyncStatus");
  if (!toggle || !interval) return;
  const enabled = driveAutoSyncEnabled();
  const connected = !!googleAccessToken;
  toggle.checked = enabled;
  toggle.disabled = !connected;
  interval.disabled = !enabled || !connected;
  interval.value = String(driveAutoSyncRate());
  if (!connected) {
    if (status) status.textContent = "Connect Drive to use auto-sync";
    interval.disabled = true;
  } else if (!enabled) {
    if (status) status.textContent = "";
  } else {
    const rateMin = Math.round(driveAutoSyncRate() / 60);
    const lastAgo = _driveAutoSyncLastAt
      ? Math.round((Date.now() - _driveAutoSyncLastAt) / 1000) + "s ago"
      : "never";
    if (status) status.textContent = "Last: " + lastAgo;
  }
}

async function runDriveAutoSync() {
  if (!googleAccessToken || !driveAutoSyncEnabled() || !started) return;
  if (activeDriveAction) return; // don't overlap a manual action
  try {
    if (driveBadgeEl) driveBadgeEl.classList.add("syncing");
    if (driveBadgeText) driveBadgeText.textContent = "Syncing…";
    setDriveActivity("Auto-sync: uploading saves…", "run");
    if (window.FS) await persistFiles(window.FS, "drive-auto");
    await ensureDriveFolders(true);
    const bundle = await buildSavesBundle();
    if (bundle) {
      const bytes = new TextEncoder().encode(JSON.stringify(bundle));
      await uploadBlobToDrive(GOOGLE_DRIVE_SAVE_BUNDLE, googleDriveSavesId, bytes, "application/json", "Auto-sync saves");
      log("Drive auto-sync: uploaded saves bundle (" + bundle.files.length + " files).", "ok");
    }
    _driveAutoSyncLastAt = Date.now();
    setDriveActivity("Auto-sync complete: " + new Date().toLocaleTimeString(), "ok");
    if (driveBadgeText) driveBadgeText.textContent = "Drive ✓";
    setTimeout(() => { if (driveBadgeText && googleAccessToken) driveBadgeText.textContent = "Drive"; }, 3000);
  } catch(e) {
    const message = googleAuthErrorMessage(e);
    log("Drive auto-sync failed: " + message, "warn");
    setDriveActivity("Auto-sync failed: " + message, "bad");
    if (driveBadgeText) driveBadgeText.textContent = "Drive ✗";
    setTimeout(() => { if (driveBadgeText && googleAccessToken) driveBadgeText.textContent = "Drive"; }, 4000);
  } finally {
    if (driveBadgeEl) driveBadgeEl.classList.remove("syncing");
    updateDriveAutoSyncUI();
  }
}

function restartDriveAutoSyncTimer() {
  if (_driveAutoSyncTimer) { clearInterval(_driveAutoSyncTimer); _driveAutoSyncTimer = null; }
  if (!driveAutoSyncEnabled() || !googleAccessToken) { updateDriveAutoSyncUI(); return; }
  const ms = driveAutoSyncRate() * 1000;
  _driveAutoSyncTimer = setInterval(runDriveAutoSync, ms);
  log("Drive auto-sync enabled: every " + Math.round(ms / 60000) + " min.", "ok");
  updateDriveAutoSyncUI();
}

/* ── Export / Import saves ──────────────────────────────────────── */
async function buildSavesBundle() {
  const FS = window.FS;
  const root  = FS ? detectMemstickDir(FS) : (_detectedMemstick || PERSIST_ROOTS[0]);
  const files = FS ? fsWalkDir(FS, root) : await opfsWalk();
  if (!files.length) return null;
  return {
    version: 1,
    exported: new Date().toISOString(),
    ppssppMemstick: root,
    files: files.map(({ path, data }) => ({
      path,
      data: bytesToBase64(data)
    }))
  };
}

async function exportSaves() {
  const bundle = await buildSavesBundle();
  if (!bundle) { showToast("No save data to export."); return; }
  const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href: url, download: "ppsspp-saves-" + new Date().toISOString().slice(0, 10) + ".ppsspp"
  });
  a.click(); URL.revokeObjectURL(url);
  log("Exported " + bundle.files.length + " files.", "ok");
  showToast("✓ Exported " + bundle.files.length + " files");
}

async function importSavesBundle(bundle, label) {
  const FS = window.FS;
  if (!Array.isArray(bundle.files)) throw new Error("Invalid bundle format");
  let count = 0;
  for (const { path, data } of bundle.files) {
    const bytes = base64ToBytes(data);
    await opfsPut(path, bytes);
    if (FS) {
      fsMkdirP(FS, path.substring(0, path.lastIndexOf("/")));
      FS.writeFile(path, bytes);
    }
    count++;
  }
  log("Imported " + count + " files from " + label, "ok");
  showToast("✓ Imported " + count + " save files");
  refreshSavesTab(); updateStorageInfo();
  return count;
}

async function importSaves(file) {
  try {
    const bundle = JSON.parse(await file.text());
    await importSavesBundle(bundle, file.name);
  } catch(e) { log("Import error: " + e.message, "err"); showToast("❌ Import failed: " + e.message); }
}

/* ── Google Drive sync (100% client side) ───────────────────────── */
let googleTokenClient = null;
let googleAccessToken = "";
let googleTokenExpiresAt = 0;
let googleDriveRootId = "";
let googleDriveSavesId = "";
let googleDriveGamesId = "";
let googleDriveRemoteCache = { saves: [], games: [] };
let activeDriveAction = "";

function googleClientId() {
  return (window.PPSSPP_GOOGLE_CLIENT_ID || localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || "").trim();
}

function googleRedirectUri() {
  return location.origin + location.pathname;
}

function shouldUseRedirectOAuth() {
  return true;
}

function googleAuthErrorMessage(error) {
  const msg = String(error?.message || error || "Google login failed");
  if (/timed out/i.test(msg)) return "Google login timed out. Try again, or check that popups and redirects are allowed.";
  if (/popup|closed|cancel/i.test(msg)) return "Google login was closed before it completed.";
  if (/redirect_uri_mismatch/i.test(msg)) return "Google rejected the redirect URI. Add this URL in Google Cloud: " + googleRedirectUri();
  if (/idpiframe|third.?party|cookie/i.test(msg)) return "Google login was blocked by browser privacy settings. Try redirect login or allow third-party cookies for Google.";
  return msg;
}

function setGoogleToken(token, expiresIn) {
  googleAccessToken = token || "";
  googleTokenExpiresAt = googleAccessToken ? Date.now() + Number(expiresIn || 3600) * 1000 : 0;
  if (googleAccessToken) {
    localStorage.setItem(GOOGLE_TOKEN_KEY, JSON.stringify({
      accessToken: googleAccessToken,
      expiresAt: googleTokenExpiresAt,
    }));
  } else {
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
  }
}

function restoreGoogleToken() {
  if (googleAccessToken && Date.now() < googleTokenExpiresAt - 60000) return true;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(GOOGLE_TOKEN_KEY) || "null"); } catch(e) {}
  if (!saved?.accessToken || !saved?.expiresAt || Date.now() >= Number(saved.expiresAt) - 60000) {
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
    return false;
  }
  googleAccessToken = saved.accessToken;
  googleTokenExpiresAt = Number(saved.expiresAt);
  setDriveInfo("Connected", "good");
  return true;
}

function handleGoogleRedirectCallback() {
  if (!location.hash.includes("access_token=") && !location.hash.includes("error=")) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("access_token");
  const error = params.get("error");
  const state = params.get("state") || "";
  const expectedState = localStorage.getItem(GOOGLE_OAUTH_STATE_KEY) || "";
  localStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);
  history.replaceState(null, document.title, location.pathname + location.search);

  if (error) {
    takePendingDriveAction();
    setDriveActivity("Connect failed: " + googleAuthErrorMessage(error), "bad");
    return true;
  }
  if (!token) return true;
  if (expectedState && state !== expectedState) {
    takePendingDriveAction();
    setDriveActivity("Connect failed: OAuth state mismatch", "bad");
    return true;
  }

  setGoogleToken(token, params.get("expires_in") || 3600);
  setDriveInfo("Connected", "good");
  const pendingAction = takePendingDriveAction();
  setDriveActivity(pendingAction ? "Google connected. Resuming Drive action…" : "Google connected. Reading Drive…", "run");
  showToast("Google Drive connected");
  if (pendingAction) {
    resumePendingDriveAction(pendingAction);
  } else {
    setTimeout(() => refreshDriveList().catch(e => {
      const message = googleAuthErrorMessage(e);
      log("Google Drive refresh failed after login: " + message, "err");
      setDriveActivity("Refresh failed: " + message, "bad");
    }), 0);
  }
  return true;
}

function startGoogleRedirectLogin(clientId) {
  const state = window.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2);
  localStorage.setItem(GOOGLE_OAUTH_STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "token",
    scope: GOOGLE_DRIVE_SCOPE,
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  location.assign("https://accounts.google.com/o/oauth2/v2/auth?" + params);
}

async function runDriveAction(name, action) {
  activeDriveAction = name || "";
  try {
    return await action();
  } finally {
    activeDriveAction = "";
  }
}

function rememberPendingDriveAction() {
  if (activeDriveAction) localStorage.setItem(GOOGLE_PENDING_ACTION_KEY, activeDriveAction);
}

function takePendingDriveAction() {
  const action = localStorage.getItem(GOOGLE_PENDING_ACTION_KEY) || "";
  localStorage.removeItem(GOOGLE_PENDING_ACTION_KEY);
  return action;
}

function resumePendingDriveAction(action) {
  if (!action) return;
  setTimeout(() => {
    if (action === "refresh") refreshDriveList().catch(e => setDriveActivity("Refresh failed: " + googleAuthErrorMessage(e), "bad"));
    else if (action === "upload-saves") uploadSavesToDrive();
    else if (action === "restore-saves") restoreDriveSave();
    else if (action === "upload-games") uploadGamesToDrive();
    else if (action === "download-games") downloadAllDriveGames();
  }, 150);
}

function setDriveInfo(auth, cls) {
  document.body.classList.toggle("drive-connected", !!googleAccessToken);
  // Header badge
  if (driveBadgeEl) {
    if (googleAccessToken) {
      driveBadgeEl.style.display = "";
      driveBadgeEl.className = "badge drive-badge active";
      driveBadgeEl.title = "Google Drive connected — click to go to Drive tab";
      if (driveBadgeText) driveBadgeText.textContent = "Drive";
    } else {
      driveBadgeEl.style.display = "none";
      driveBadgeEl.className = "badge drive-badge";
    }
  }
  if (driveAuthEl) {
    driveAuthEl.textContent = auth || (googleAccessToken ? "Connected" : "Not connected");
    driveAuthEl.className = "info-val" + (cls ? " " + cls : (googleAccessToken ? " good" : ""));
  }
  if (driveFolderEl) {
    driveFolderEl.textContent = googleDriveRootId ? GOOGLE_DRIVE_APP_ROOT : "\u2014";
    driveFolderEl.className = "info-val" + (googleDriveRootId ? " good" : "");
  }
  if (driveRemoteEl) {
    const s = googleDriveRemoteCache.saves.length;
    const g = googleDriveRemoteCache.games.length;
    driveRemoteEl.textContent = googleAccessToken ? (s + " saves · " + g + " games") : "\u2014";
  }
}

function setDriveActivity(text, cls) {
  if (!driveActivityEl) return;
  driveActivityEl.textContent = text || "Idle";
  driveActivityEl.className = "drive-activity" + (cls ? " " + cls : "");
}

function initDriveConfigUI() {
  if (googleClientIdInput) googleClientIdInput.value = googleClientId();
  restoreGoogleToken();
  setDriveInfo();
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-google-gis]");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Identity Services failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = GOOGLE_GIS_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.googleGis = "1";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google Identity Services failed to load"));
    document.head.appendChild(script);
  });
}

async function ensureGoogleToken(interactive) {
  const clientId = googleClientId();
  if (!clientId) throw new Error("Set a Google OAuth Web client ID first");
  if (restoreGoogleToken()) return googleAccessToken;
  if (!interactive) throw new Error("Connect Google Drive first");

  if (shouldUseRedirectOAuth()) {
    rememberPendingDriveAction();
    setDriveActivity("Continue Google login in this tab…", "run");
    startGoogleRedirectLogin(clientId);
    return new Promise(() => {});
  }

  await loadGoogleIdentityScript();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error("Google login timed out. Browser popup may have been blocked."));
    }, GOOGLE_AUTH_TIMEOUT_MS);
    googleTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          finish(reject, new Error(response.error_description || response.error));
          return;
        }
        setGoogleToken(response.access_token, response.expires_in);
        setDriveInfo("Connected", "good");
        finish(resolve, googleAccessToken);
      },
      error_callback: (error) => {
        const type = String(error?.type || error?.message || "");
        if (/popup_failed_to_open|popup_blocked/i.test(type)) {
          setDriveActivity("Popup blocked; switching to redirect login…", "run");
          startGoogleRedirectLogin(clientId);
          return;
        }
        finish(reject, new Error(error?.message || error?.type || "Google popup failed"));
      },
    });
    try { googleTokenClient.requestAccessToken({ prompt: "consent" }); }
    catch(e) { finish(reject, e); }
  });
}

async function ensureDriveReady(interactive) {
  await ensureDriveFolders(interactive);
  return true;
}

function disconnectGoogleDrive() {
  const token = googleAccessToken;
  setGoogleToken("", 0);
  takePendingDriveAction();
  googleDriveRootId = "";
  googleDriveSavesId = "";
  googleDriveGamesId = "";
  googleDriveRemoteCache = { saves: [], games: [] };
  if (token && window.google?.accounts?.oauth2?.revoke) {
    try { window.google.accounts.oauth2.revoke(token, () => {}); } catch(e) {}
  }
  restartDriveAutoSyncTimer(); // will stop timer since not connected
  renderDriveRemoteList();
  setDriveInfo("Not connected");
  setDriveActivity("Disconnected");
  showToast("Google Drive disconnected");
}

async function driveFetch(url, options = {}) {
  const token = await ensureGoogleToken(false);
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", "Bearer " + token);
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    setGoogleToken("", 0);
    throw new Error("Google session expired. Connect again.");
  }
  if (!response.ok) {
    let detail = "";
    try { detail = (await response.json()).error?.message || ""; } catch(e) {}
    throw new Error("Drive HTTP " + response.status + (detail ? ": " + detail : ""));
  }
  return response;
}

function driveQuote(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function driveList(q, fields) {
  const files = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q,
      fields: "nextPageToken, files(" + fields + ")",
      pageSize: "1000",
      spaces: "drive",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await driveFetch("https://www.googleapis.com/drive/v3/files?" + params);
    const json = await res.json();
    files.push(...(json.files || []));
    pageToken = json.nextPageToken || "";
  } while (pageToken);
  return files;
}

async function driveFindFile(name, parentId, mimeType) {
  let q = "name = '" + driveQuote(name) + "' and trashed = false";
  if (parentId) q += " and '" + driveQuote(parentId) + "' in parents";
  if (mimeType) q += " and mimeType = '" + driveQuote(mimeType) + "'";
  const files = await driveList(q, "id,name,mimeType,size,modifiedTime");
  return files.sort((a, b) => String(b.modifiedTime || "").localeCompare(String(a.modifiedTime || "")))[0] || null;
}

async function driveEnsureFolder(name, parentId) {
  const folderMime = "application/vnd.google-apps.folder";
  const existing = await driveFindFile(name, parentId, folderMime);
  if (existing) return existing.id;

  const metadata = { name, mimeType: folderMime };
  if (parentId) metadata.parents = [parentId];
  const res = await driveFetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  return (await res.json()).id;
}

async function ensureDriveFolders(interactive = false) {
  await ensureGoogleToken(interactive);
  if (!googleDriveRootId) googleDriveRootId = await driveEnsureFolder(GOOGLE_DRIVE_APP_ROOT);
  if (!googleDriveSavesId) googleDriveSavesId = await driveEnsureFolder("saves", googleDriveRootId);
  if (!googleDriveGamesId) googleDriveGamesId = await driveEnsureFolder("games", googleDriveRootId);
  setDriveInfo("Connected", "good");
}

async function uploadBlobToDrive(name, parentId, data, mimeType, progressLabel) {
  const existing = await driveFindFile(name, parentId);
  const method = existing ? "PATCH" : "POST";
  const url = existing
    ? "https://www.googleapis.com/upload/drive/v3/files/" + encodeURIComponent(existing.id) + "?uploadType=resumable&fields=id,name,size,modifiedTime"
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,modifiedTime";
  const metadata = { name, mimeType };
  if (!existing) metadata.parents = [parentId];
  const init = await driveFetch(url, {
    method,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
    },
    body: JSON.stringify(metadata),
  });
  const uploadUrl = init.headers.get("Location");
  if (!uploadUrl) throw new Error("Drive did not return an upload session");

  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const token = await ensureGoogleToken(false);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const pct = ev.loaded / ev.total;
      showLoading((progressLabel || "Uploading " + name) + "… " + Math.round(pct * 100) + "%", pct);
      setStatus("Drive upload: " + name + " (" + formatBytes(ev.loaded) + " / " + formatBytes(ev.total) + ")", "run");
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setStatus("Drive upload: " + name + " – done", "ok");
        try { resolve(JSON.parse(xhr.responseText || "{}")); }
        catch(e) { resolve({ name }); }
      } else {
        setStatus("Drive upload failed: HTTP " + xhr.status, "err");
        reject(new Error("Drive upload failed: HTTP " + xhr.status));
      }
    };
    xhr.onerror = () => reject(new Error("Drive upload network error"));
    xhr.send(blob);
  });
}

async function refreshDriveList() {
  setDriveActivity("Reading Drive folders…", "run");
  await ensureDriveReady(true);
  const fields = "id,name,mimeType,size,modifiedTime";
  googleDriveRemoteCache.saves = await driveList("'" + driveQuote(googleDriveSavesId) + "' in parents and trashed = false", fields);
  googleDriveRemoteCache.games = await driveList("'" + driveQuote(googleDriveGamesId) + "' in parents and trashed = false", fields);
  googleDriveRemoteCache.saves.sort((a, b) => String(b.modifiedTime || "").localeCompare(String(a.modifiedTime || "")));
  googleDriveRemoteCache.games.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  renderDriveRemoteList();
  setDriveInfo("Connected", "good");
  setDriveActivity("Drive ready: " + googleDriveRemoteCache.saves.length + " save bundle(s), " + googleDriveRemoteCache.games.length + " game file(s)", "ok");
  updateDriveAutoSyncUI();
}

function renderDriveRemoteList() {
  if (!driveRemoteList) return;
  const saves = googleDriveRemoteCache.saves || [];
  const games = googleDriveRemoteCache.games || [];
  if (!googleAccessToken) {
    driveRemoteList.innerHTML = `<span class="drive-empty">Connect Google Drive to list remote saves and games.</span>`;
    return;
  }
  if (!saves.length && !games.length) {
    driveRemoteList.innerHTML = `<span class="drive-empty">No Drive files yet. Upload saves or your game library.</span>`;
    return;
  }
  let html = "";
  if (saves.length) {
    html += `<div class="drive-section-label"><span>Saves</span><span>${saves.length}</span></div>`;
    for (const file of saves) {
      html += `<div class="drive-file-row">
        <div class="drive-file-name" title="${esc(file.name)}">${esc(file.name)}</div>
        <div class="drive-file-size">${formatBytes(Number(file.size || 0))}</div>
        <button title="Restore" data-drive-action="restore-save" data-id="${esc(file.id)}">${svgIcon("upload")}</button>
      </div>`;
    }
  }
  if (games.length) {
    html += `<div class="drive-section-label"><span>Games</span><span>${games.length}</span></div>`;
    for (const file of games) {
      html += `<div class="drive-file-row">
        <div class="drive-file-name" title="${esc(file.name)}">${esc(file.name)}</div>
        <div class="drive-file-size">${formatBytes(Number(file.size || 0))}</div>
        <button title="Download to OPFS" data-drive-action="download-game" data-id="${esc(file.id)}">${svgIcon("download")}</button>
      </div>`;
    }
  }
  driveRemoteList.innerHTML = html;
}

async function driveDownloadBytes(file, label) {
  const res = await driveFetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(file.id) + "?alt=media");
  return readResponseBytes(res, label || file.name);
}

async function connectGoogleDrive() {
  try {
    setDriveActivity("Opening Google login…", "run");
    await ensureGoogleToken(true);
    showToast("Google Drive connected");
    restartDriveAutoSyncTimer();
    await refreshDriveList();
  } catch(e) {
    const message = googleAuthErrorMessage(e);
    log("Google Drive connect failed: " + message, "err");
    setDriveInfo("Connect failed", "bad");
    setDriveActivity("Connect failed: " + message, "bad");
    showToast("❌ " + message, 5000);
  } finally {
    hideLoading();
  }
}

async function uploadSavesToDrive() {
  try {
    setDriveActivity("Preparing save bundle…", "run");
    if (window.FS) await persistFiles(window.FS, "drive");
    await ensureDriveFolders(true);
    const bundle = await buildSavesBundle();
    if (!bundle) {
      setDriveActivity("No save data found to upload", "warn");
      showToast("No save data to upload.");
      return;
    }
    const bytes = new TextEncoder().encode(JSON.stringify(bundle));
    setDriveActivity("Uploading saves bundle (" + formatBytes(bytes.byteLength) + ")…", "run");
    showLoading("Uploading saves to Drive…");
    await uploadBlobToDrive(GOOGLE_DRIVE_SAVE_BUNDLE, googleDriveSavesId, bytes, "application/json", "Uploading saves");
    log("Google Drive: uploaded saves bundle with " + bundle.files.length + " files.", "ok");
    setDriveActivity("Uploaded saves bundle with " + bundle.files.length + " file(s)", "ok");
    showToast("✓ Saves uploaded to Drive");
    await refreshDriveList();
  } catch(e) {
    const message = googleAuthErrorMessage(e);
    log("Google Drive save upload failed: " + message, "err");
    setDriveActivity("Save upload failed: " + message, "bad");
    showToast("❌ " + message, 5000);
  } finally {
    hideLoading();
  }
}

async function restoreDriveSave(file) {
  try {
    setDriveActivity("Preparing save restore…", "run");
    await ensureDriveFolders(true);
    if (!file && !googleDriveRemoteCache.saves.length) await refreshDriveList();
    const target = file || googleDriveRemoteCache.saves[0];
    if (!target) {
      setDriveActivity("No Drive save bundle found", "warn");
      showToast("No Drive save bundle found");
      return;
    }
    showLoading("Downloading saves from Drive…");
    setDriveActivity("Downloading " + target.name + "…", "run");
    const bytes = await driveDownloadBytes(target, target.name);
    const bundle = JSON.parse(new TextDecoder().decode(bytes));
    await importSavesBundle(bundle, "Google Drive " + target.name);
    log("Google Drive: restored saves from " + target.name + ".", "ok");
    setDriveActivity("Restored saves from " + target.name, "ok");
    setStatus("Restored saves from Drive", "ok");
    showToast("✓ Restored saves from Drive");
  } catch(e) {
    const message = googleAuthErrorMessage(e);
    log("Google Drive save restore failed: " + message, "err");
    setDriveActivity("Save restore failed: " + message, "bad");
    showToast("❌ " + message, 5000);
  } finally {
    hideLoading();
  }
}

async function uploadGamesToDrive() {
  try {
    setDriveActivity("Scanning local game library…", "run");
    await ensureDriveFolders(true);
    const games = await opfsWalk(OPFS_GAMES_DIR, "", false);
    if (!games.length) {
      setDriveActivity("No local games in OPFS to upload", "warn");
      showToast("No local games in OPFS to upload");
      return;
    }
    let done = 0;
    for (const game of games) {
      setDriveActivity("Uploading game " + (done + 1) + "/" + games.length + ": " + game.path, "run");
      const bytes = await opfsReadGame(game.path);
      await uploadBlobToDrive(game.path, googleDriveGamesId, bytes, "application/octet-stream",
        "Uploading game " + (done + 1) + "/" + games.length);
      done++;
      log("Google Drive: uploaded game " + game.path + " (" + formatBytes(bytes.byteLength) + ").", "ok");
    }
    setDriveActivity("Uploaded " + done + " game" + (done === 1 ? "" : "s") + " to Drive", "ok");
    showToast("✓ Uploaded " + done + " game" + (done === 1 ? "" : "s") + " to Drive");
    await refreshDriveList();
  } catch(e) {
    const message = googleAuthErrorMessage(e);
    log("Google Drive game upload failed: " + message, "err");
    setDriveActivity("Game upload failed: " + message, "bad");
    showToast("❌ " + message, 5000);
  } finally {
    hideLoading();
  }
}

async function downloadDriveGame(file) {
  try {
    setDriveActivity("Preparing game download…", "run");
    await ensureDriveFolders(true);
    showLoading("Downloading " + file.name + " from Drive…");
    setDriveActivity("Downloading " + file.name + "…", "run");
    const bytes = await driveDownloadBytes(file, file.name);
    const storedName = await storeGameBytes(file.name, bytes);
    log("Google Drive: downloaded game " + storedName + " (" + formatBytes(bytes.byteLength) + ").", "ok");
    setDriveActivity("Downloaded " + storedName + " to OPFS", "ok");
    setStatus("Downloaded " + storedName + " to OPFS", "ok");
    showToast("✓ Downloaded " + storedName);
    await refreshLibrary();
    updateStorageInfo();
  } catch(e) {
    const message = googleAuthErrorMessage(e);
    log("Google Drive game download failed: " + message, "err");
    setDriveActivity("Game download failed: " + message, "bad");
    showToast("❌ " + message, 5000);
  } finally {
    hideLoading();
  }
}

async function downloadAllDriveGames() {
  try {
    setDriveActivity("Preparing remote game downloads…", "run");
    await ensureDriveFolders(true);
    if (!googleDriveRemoteCache.games.length) await refreshDriveList();
    const games = googleDriveRemoteCache.games;
    if (!games.length) {
      setDriveActivity("No remote games found", "warn");
      showToast("No remote games found");
      return;
    }
    for (const game of games) await downloadDriveGame(game);
    setDriveActivity("Downloaded " + games.length + " remote game" + (games.length === 1 ? "" : "s"), "ok");
    showToast("✓ Downloaded " + games.length + " remote game" + (games.length === 1 ? "" : "s"));
  } catch(e) {
    const message = googleAuthErrorMessage(e);
    log("Google Drive bulk game download failed: " + message, "err");
    setDriveActivity("Bulk game download failed: " + message, "bad");
    showToast("❌ " + message, 5000);
  } finally {
    hideLoading();
  }
}

/* ── Runtime game loading (while PPSSPP is running) ─────────────── */
async function loadGameAtRuntime(file) {
  const FS = window.FS;
  if (!FS) { showToast("⚠ Start PPSSPP first"); return; }
  const safe = file.name.replace(/[^a-zA-Z0-9._\-]/g, "_");
  const path = VIRTUAL_GAME_DIR + "/" + safe;
  log("Loading game at runtime: " + file.name + " → " + path, "info");
  showToast("Loading " + file.name + "…");
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    try { FS.mkdirTree(VIRTUAL_GAME_DIR); } catch(e) {}
    FS.writeFile(path, bytes);
    await opfsPutGame(file.name, bytes);
    refreshEmulatorGameBrowser("mounted " + safe);
    log("Game file ready at " + path + " and saved to OPFS. Open it from PPSSPP\u2019s game browser (Home \u2192 Games).", "ok");
    showToast("✓ " + file.name + " loaded → open from PPSSPP game browser", 5000);
    refreshLibrary();
    updateStorageInfo();
  } catch(e) { log("Runtime game load failed: " + e.message, "err"); showToast("❌ " + e.message); }
}

/* ── AudioWorklet player ────────────────────────────────────────── */
let audioWorkletPlayer     = null;
let audioWorkletIniting    = false;
let scriptFallbackPlayer   = null;
let useScriptFallbackAudio = true;
let gameAudioGain          = 1.0;

const WORKLET_CODE = `
class PPSSPPAudio extends AudioWorkletProcessor {
  constructor(o) {
super(o);
const s = o.processorOptions.sab;
this.wi   = new Int32Array(s, 0, 1);
this.ri   = new Int32Array(s, 4, 1);
this.cap  = o.processorOptions.cap;
this.data = new Float32Array(s, 8, this.cap * 2);
this.tick = 0; this.total = 0;
  }
  process(_, outputs) {
const ch = outputs[0];
if (!ch || !ch[0]) return true;
const n = ch[0].length;
let r = Atomics.load(this.ri, 0);
const w = Atomics.load(this.wi, 0);
const avail = (w - r + this.cap) % this.cap;
const read  = Math.min(n, avail);
let peak = 0;
for (let i = 0; i < read; i++) {
  const idx = r * 2;
  const l = this.data[idx], rr = this.data[idx + 1];
  ch[0][i] = l; if (ch[1]) ch[1][i] = rr;
  peak = Math.max(peak, Math.abs(l), Math.abs(rr));
  r = (r + 1) % this.cap;
}
for (let i = read; i < n; i++) { ch[0][i] = 0; if (ch[1]) ch[1][i] = 0; }
Atomics.store(this.ri, 0, r);
this.total += read; this.tick++;
if (this.tick === 1 || this.tick % 344 === 0)
  this.port.postMessage({ type:'status', tick:this.tick, avail, read, total:this.total, peak });
return true;
  }
}
registerProcessor('ppsspp-audio', PPSSPPAudio);
`;

async function initAudioWorkletPlayer(ctx) {
  if (audioWorkletPlayer || audioWorkletIniting || !ctx) return;
  if (!window.crossOriginIsolated) {
    log("AUDIO: SharedArrayBuffer unavailable (crossOriginIsolated=false). Check COOP/COEP server headers.", "warn");
    return;
  }
  audioWorkletIniting = true;
  try {
    const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
    const burl = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(burl);
    URL.revokeObjectURL(burl);
    const cap = 16384;
    const sab = new SharedArrayBuffer(8 + cap * 2 * 4);
    const node = new AudioWorkletNode(ctx, "ppsspp-audio", {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
      processorOptions: { sab, cap },
    });
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    if (!useScriptFallbackAudio) { node.connect(gain); gain.connect(ctx.destination); }
    node.port.onmessage = (ev) => {
      if (ev.data?.type === "status") {
        const d = ev.data;
        audioDebug.workletPeak  = d.peak  || 0;
        audioDebug.workletTotal = d.total || audioDebug.workletTotal;
        if (d.tick <= 3 || d.tick % 344 === 0)
          log(`Worklet tick=${d.tick}: avail=${d.avail} read=${d.read} peak=${(d.peak||0).toFixed(4)} consumed=${d.total}`);
      }
    };
    node.onprocessorerror = (e) => log("AUDIO: AudioWorklet processor error: " + (e?.message || e), "err");
    audioWorkletPlayer = {
      node, gain,
      wi: new Int32Array(sab, 0, 1), ri: new Int32Array(sab, 4, 1),
      data: new Float32Array(sab, 8, cap * 2), cap,
    };
    log("AUDIO: AudioWorklet ready (sampleRate=" + ctx.sampleRate + ", buffer=" + cap + " frames).", "ok");
  } catch (e) {
    log("AUDIO: AudioWorklet init failed: " + (e?.message || e), "err");
  } finally { audioWorkletIniting = false; }
}

function initScriptFallbackPlayer(ctx) {
  if (scriptFallbackPlayer || !ctx) return;
  try {
    const cap = 32768;
    const data = new Float32Array(cap * 2);
    const processor = ctx.createScriptProcessor(2048, 0, 2);
    const gain = ctx.createGain();
    let r = 0, w = 0, total = 0, tick = 0;
    processor.onaudioprocess = (event) => {
      const left  = event.outputBuffer.getChannelData(0);
      const right = event.outputBuffer.getChannelData(1);
      const n = left.length;
      const avail = (w - r + cap) % cap;
      const read  = Math.min(n, avail);
      let peak = 0;
      for (let i = 0; i < read; i++) {
        const idx = r * 2;
        left[i] = data[idx]; right[i] = data[idx + 1];
        peak = Math.max(peak, Math.abs(data[idx]), Math.abs(data[idx + 1]));
        r = (r + 1) % cap;
      }
      for (let i = read; i < n; i++) { left[i] = 0; right[i] = 0; }
      total += read; audioDebug.fallbackPeak = peak; tick++;
      if (tick === 1 || tick % 22 === 0)
        log("ScriptProcessor tick=" + tick + ": avail=" + avail + " read=" + read + " peak=" + peak.toFixed(4) + " consumed=" + total);
    };
    gain.gain.value = gameAudioGain;
    processor.connect(gain); gain.connect(ctx.destination);
    scriptFallbackPlayer = {
      data, cap, processor, gain,
      push(samples, frames) {
        const push = Math.min(frames, cap - 1);
        const used = (w - r + cap) % cap;
        const free = cap - 1 - used;
        if (push > free) {
          const drop = push - free; r = (r + drop) % cap;
          audioDebug.fallbackDropped += drop;
        }
        for (let i = 0; i < push; i++) {
          data[w * 2]     = Math.max(-1, Math.min(1, samples[i * 2]     || 0));
          data[w * 2 + 1] = Math.max(-1, Math.min(1, samples[i * 2 + 1] || 0));
          w = (w + 1) % cap;
        }
      }
    };
    log("AUDIO: ScriptProcessor fallback ready (buffer=" + cap + " frames, gain=" + gameAudioGain + ").", "ok");
  } catch (e) { log("AUDIO: ScriptProcessor fallback init failed: " + (e?.message || e), "err"); }
}

/* Called from SDL C callback via EM_ASM – must be fast */
function pushGameAudioSamples(samples, frames) {
  scriptFallbackPlayer?.push(samples, frames);
  if (useScriptFallbackAudio) return;
  const p = audioWorkletPlayer;
  if (!p || !samples || frames <= 0) return;
  let w = Atomics.load(p.wi, 0);
  let r = Atomics.load(p.ri, 0);
  const used = (w - r + p.cap) % p.cap;
  let free = p.cap - 1 - used;
  const push = Math.min(frames, p.cap - 1);
  if (push > free) {
    const drop = push - free; r = (r + drop) % p.cap;
    Atomics.store(p.ri, 0, r); audioDebug.ringDropped += drop; free += drop;
  }
  for (let i = 0; i < push; i++) {
    p.data[w * 2]     = Math.max(-1, Math.min(1, samples[i * 2]     || 0));
    p.data[w * 2 + 1] = Math.max(-1, Math.min(1, samples[i * 2 + 1] || 0));
    w = (w + 1) % p.cap;
  }
  Atomics.store(p.wi, 0, w);
}

/* ── Log system ─────────────────────────────────────────────────── */
const MAX_LOG_LINES = 500;
let logLines = [], pendingLines = [], logRafId = 0, filterText = "";

function classifyLine(text) {
  const t = text.toLowerCase();
  if (/error|abort|failed|fail|crash/.test(t)) return "err";
  if (/warn/.test(t))                          return "warn";
  if (/\b(ok|ready|loaded|initialized|done)\b/.test(t)) return "ok";
  if (/audio|gpu|webgl|shader/.test(t))        return "info";
  if (/stdout:|stderr:/.test(t))               return "dim";
  return "";
}

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }

function buildLineHtml(rawLine, forceLevel) {
  const m   = rawLine.match(/^(\[\d{1,2}:\d{2}:\d{2}\]) (.*)$/s);
  const ts  = m ? esc(m[1]) : "";
  const txt = esc(m ? m[2] : rawLine);
  const cls = forceLevel || classifyLine(rawLine);
  const inner = cls
    ? '<span class="l-ts">' + ts + '</span> <span class="l-' + cls + '">' + txt + '</span>'
    : '<span class="l-ts">' + ts + '</span> ' + txt;
  return { raw: rawLine, html: inner };
}

function flushLog() {
  logRafId = 0;
  if (!pendingLines.length) return;
  for (const e of pendingLines) logLines.push(e);
  pendingLines = [];
  if (logLines.length > MAX_LOG_LINES) logLines.splice(0, logLines.length - MAX_LOG_LINES);
  renderLog();
}

function renderLog() {
  if (!logEl) return;
  const ft = filterText.toLowerCase();
  const vis = ft ? logLines.filter(e => e.raw.toLowerCase().includes(ft)) : logLines;
  logEl.innerHTML = vis.map(e => e.html).join("\n") + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

on(logFilter, "input", () => { filterText = logFilter.value.trim(); renderLog(); });
on("clearLogBtn", "click", () => { logLines = []; pendingLines = []; if (logEl) logEl.innerHTML = ""; });

function log(text, level) {
  const ts  = new Date().toLocaleTimeString("en-GB", { hour12: false });
  const raw = "[" + ts + "] " + text;
  pendingLines.push(buildLineHtml(raw, level || ""));
  console.log(raw);
  updateAudioDebugFromLog(text);
  if (!logRafId) logRafId = requestAnimationFrame(flushLog);
}

/* ── Status ─────────────────────────────────────────────────────── */
function setStatus(text, kind) {
  if (statusEl) statusEl.textContent = text;
  if (statusDot) statusDot.className = "status-dot" + (kind ? " " + kind : "");
  // also update the always-visible stage overlay
  if (stageMiniTextEl) stageMiniTextEl.textContent = text;
  if (stageDotEl) stageDotEl.className = "stage-dot" + (kind ? " " + kind : "");
  log((kind === "err" ? "ERROR: " : "") + text, kind === "err" ? "err" : undefined);
}

function showLoading(label, progress) {
  loadOverlay?.classList.add("visible");
  if (loadLabel) loadLabel.textContent = label;
  if (progressBar) progressBar.style.width = (progress != null && progress >= 0) ? (progress * 100).toFixed(1) + "%" : "0%";
}
function hideLoading() {
  loadOverlay?.classList.remove("visible");
  if (progressBar) progressBar.style.width = "0%";
  if (loadLabel) loadLabel.textContent = "";
}

/* ── System info panel ──────────────────────────────────────────── */
function setInfoVal(id, val, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent  = val;
  el.className    = "info-val" + (cls ? " " + cls : "");
}

function updateInfoPanel() {
  const sdlCtx = window.Module?.SDL2?.audioContext || trackedAudioContexts[trackedAudioContexts.length - 1];
  setInfoVal("iACtx",  sdlCtx ? sdlCtx.state : "none", sdlCtx?.state === "running" ? "good" : "warn");
  setInfoVal("iASR",   sdlCtx ? sdlCtx.sampleRate + " Hz" : "\u2014");
  setInfoVal("iACB",   String(audioDebug.callbacks));
  setInfoVal("iAPeak", audioDebug.peak ? String(audioDebug.peak) : "0");
  setInfoVal("iCOI",   String(window.crossOriginIsolated), window.crossOriginIsolated ? "good" : "bad");
  setInfoVal("iSAB",   typeof SharedArrayBuffer !== "undefined" ? "yes" : "no",
                       typeof SharedArrayBuffer !== "undefined" ? "good" : "bad");
  setInfoVal("iHWC",   String(navigator.hardwareConcurrency || "?"));
}

/* ── Audio helpers ──────────────────────────────────────────────── */
function updateAudioDebugFromLog(text) {
  if (text.includes("SDL audio device started")) audioDebug.deviceStarted = true;
  const m  = text.match(/WASM audio callback count=(\d+) nonsilent=(\d+) frames=(\d+) peak=(\d+) rate=(\d+)/);
  if (m) { audioDebug.callbacks = +m[1]; audioDebug.nonsilent = +m[2]; audioDebug.peak = +m[4]; audioDebug.rate = +m[5]; }
  const m2 = text.match(/WASM audio push count=(\d+) nonsilent=(\d+) frames=(\d+) peak=(\d+)/);
  if (m2) { audioDebug.pushes = +m2[1]; audioDebug.pushNonsilent = +m2[2]; audioDebug.pushPeak = +m2[4]; audioDebug.peak = Math.max(audioDebug.peak, +m2[4]); }
}

async function reportAudioStatus() {
  if (!started) return;
  const SDL2 = window.Module?.SDL2 || window.SDL2;
  const all  = [...trackedAudioContexts];
  if (SDL2?.audioContext && !all.includes(SDL2.audioContext)) all.push(SDL2.audioContext);
  for (const ctx of all)
    if (ctx?.state === "suspended") try { await ctx.resume(); log("AudioContext auto-resumed: state=" + ctx.state); } catch(e) {}
  const sdlCtx = window.Module?.SDL2?.audioContext;
  const state  = sdlCtx ? sdlCtx.state : "none";
  if (audioDebug.callbacks === 0)
    log("AUDIO: SDL callbacks=0, ctx=" + state + ". Waiting for game start or click Audio.");
  else
    log("AUDIO: callbacks=" + audioDebug.callbacks + " (nonsilent=" + audioDebug.nonsilent + "), peak=" + audioDebug.peak + ", underruns=" + audioDebug.underruns + ", dropped=" + audioDebug.ringDropped + ", ctx=" + state + ".");
  updateInfoPanel();
}

function installAudioContextTracking() {
  for (const name of ["AudioContext", "webkitAudioContext"]) {
    const Orig = window[name];
    if (!Orig || Orig.__ppssppTracked) continue;
    function Tracked(...args) {
      const ctx = new Orig(...args);
      trackedAudioContexts.push(ctx);
      log(name + " created: state=" + ctx.state + ", sampleRate=" + ctx.sampleRate);
      ctx.addEventListener?.("statechange", () => log(name + " state -> " + ctx.state));
      return ctx;
    }
    Tracked.prototype = Orig.prototype;
    Object.setPrototypeOf(Tracked, Orig);
    Tracked.__ppssppTracked = true;
    window[name] = Tracked;
  }
}

function describeAudio() {
  const SDL2 = window.Module?.SDL2 || window.SDL2;
  const ctx  = SDL2?.audioContext || trackedAudioContexts[trackedAudioContexts.length - 1];
  if (!ctx) { log("Audio: no AudioContext created."); return; }
  log("Audio: state=" + ctx.state + ", sampleRate=" + ctx.sampleRate + ", contexts=" + trackedAudioContexts.length);
}

async function createOrResumeAudioContext() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { log("WebAudio not available in this browser.", "warn"); return null; }
    let ctx = window.Module?.SDL2?.audioContext || trackedAudioContexts[trackedAudioContexts.length - 1];
    if (!ctx || ctx.state === "closed") ctx = new AC();
    if (ctx.state === "suspended") await ctx.resume();
    log("AudioContext ready: state=" + ctx.state + ", sampleRate=" + ctx.sampleRate, "ok");
    return ctx;
  } catch(e) { log("AudioContext creation failed: " + (e?.message || e), "err"); return null; }
}

async function unlockAudio() {
  // Collect ALL known contexts: SDL's + any tracked
  const sdlCtx = window.Module?.SDL2?.audioContext;
  const all = [...trackedAudioContexts];
  if (sdlCtx && !all.includes(sdlCtx)) all.push(sdlCtx);
  for (const ctx of all) {
    if (!ctx || ctx.state === 'closed') continue;
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
      try { await ctx.resume(); } catch(e) {}
    }
  }
}

function playWebAudioTone(ctx) {
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = "square"; osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.setValueAtTime(0.2, ctx.currentTime + 0.45);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.5);
  log("WebAudio beep sent: state=" + ctx.state + ", t=" + ctx.currentTime.toFixed(3));
}

function playHtmlAudioTone() {
  const sr = 44100, dur = 0.5, n = Math.floor(sr * dur);
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const ws  = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  ws(0,"RIFF"); v.setUint32(4,36+n*2,true); ws(8,"WAVE"); ws(12,"fmt ");
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*2,true);
  v.setUint16(32,2,true);  v.setUint16(34,16,true);
  ws(36,"data"); v.setUint32(40,n*2,true);
  for (let i = 0; i < n; i++) {
    const env  = Math.min(1,i/600)*Math.min(1,(n-i)/1200);
    v.setInt16(44+i*2, Math.round(Math.sin(2*Math.PI*660*i/sr)*0.35*env*32767), true);
  }
  const url = URL.createObjectURL(new Blob([buf],{type:"audio/wav"}));
  const a   = new Audio(url);
  a.volume  = 1.0;
  a.addEventListener("ended", () => URL.revokeObjectURL(url), {once:true});
  a.play().then(()=>log("HTML Audio beep sent.")).catch(e=>log("HTML Audio beep blocked: "+(e?.message||e),"warn"));
}

installAudioContextTracking();

/* ── ScriptProcessor → AudioWorklet polyfill (Chrome 126+ compat) ── */
/* Chrome removed createScriptProcessor; SDL's WASM backend uses it.  */
/* Replacement: AudioWorklet with a hardware-clock playhead.          */
/* It prebuffers a small lookahead, but only generates audio up to    */
/* ctx.currentTime + lookahead so timer jitter cannot make it run hot.*/
const SP_SHIM_WORKLET = `
class PPSSPPSpShim extends AudioWorkletProcessor {
  constructor(opts) {
super(opts);
const p        = opts.processorOptions || {};
this._nCh      = p.channels || 2;
this._cap      = p.cap      || 65536;
this._ctrl     = new Int32Array(p.sab, 0, 8);
this._data     = new Float32Array(p.sab, 32, this._cap * this._nCh);
this._last     = new Float32Array(this._nCh);
this._ramp     = 0;
this._rampFrames = 128;
this._tick     = 0;
  }
  process(inputs, outputs) {
const ch = outputs[0];
if (!ch || !ch[0]) return true;
const n = ch[0].length;
let r = Atomics.load(this._ctrl, 1);
const w = Atomics.load(this._ctrl, 0);
const avail = (w - r + this._cap) % this._cap;
const read  = Math.min(n, avail);
let ramp = this._ramp;
for (let i = 0; i < read; i++) {
  const blend = ramp > 0 ? 1.0 - ramp / this._rampFrames : 1.0;
  for (let c = 0; c < ch.length; c++) {
    const src = this._data[r * this._nCh + Math.min(c, this._nCh - 1)];
    const out = ramp > 0 ? this._last[c] * (1.0 - blend) + src * blend : src;
    ch[c][i] = out;
    this._last[c] = out;
  }
  if (ramp > 0) ramp--;
  r = (r + 1) % this._cap;
}
this._ramp = ramp;
if (read < n) {
  Atomics.add(this._ctrl, 4, 1);
  this._ramp = this._rampFrames;
  for (let i = read; i < n; i++) {
    for (let c = 0; c < ch.length; c++) {
      this._last[c] *= 0.985;
      ch[c][i] = Math.abs(this._last[c]) < 0.00001 ? 0 : this._last[c];
    }
  }
}
Atomics.store(this._ctrl, 1, r);
Atomics.add(this._ctrl, 2, read);
// Report consumed count periodically so main thread can track ring fill.
if ((++this._tick & 15) === 0)
  this.port.postMessage({ type: 'status', avail, underruns: Atomics.load(this._ctrl, 4) });
return true;
  }
}
registerProcessor('ppsspp-sp-shim', PPSSPPSpShim);
`;

const _spModuleCtxSet  = new WeakSet();
const _spModulePending = new WeakMap(); // ctx → Promise

async function ensureSpShimModule(ctx) {
  if (_spModuleCtxSet.has(ctx)) return true;
  if (_spModulePending.has(ctx)) return _spModulePending.get(ctx);
  const p = (async () => {
    try {
      const blob = new Blob([SP_SHIM_WORKLET], { type: 'application/javascript' });
      const url  = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      _spModuleCtxSet.add(ctx);
      log('AUDIO: SP→Worklet shim module loaded.', 'ok');
      return true;
    } catch(e) {
      log('AUDIO: SP shim module failed: ' + (e?.message || e), 'warn');
      return false;
    }
  })();
  _spModulePending.set(ctx, p);
  return p;
}

/* ── makeScriptProcessorShim ──────────────────────────────────────
 * Replaces ScriptProcessorNode with an AudioWorkletNode.
 * The pump is locked to a produced-audio playhead:
 *   - It may prebuffer a small lookahead.
 *   - It never generates past the hardware playhead + lookahead.
 *   - Timer bursts can top up the buffer, but cannot advance audio time.
 * ────────────────────────────────────────────────────────────────*/
function makeScriptProcessorShim(ctx, bufferSize, nIn, nOut) {
  const nCh          = Math.max(1, nOut || 2);
  const bufsz        = bufferSize || 2048;
  const SR           = ctx.sampleRate || 44100;
  const RING_CAP     = 32768;          // ring capacity in frames
  const LOOKAHEAD    = Math.max(SR * 0.070, bufsz * 2);
  const MAX_FILL     = Math.max(SR * 0.180, bufsz * 5);
  const MAX_BURST    = 16;             // max pushes per pump call

  let _handler = null;
  let _wn      = null;
  let _gain    = null;
  let _dest    = null;
  let _timerId = null;
  let _fakeBuf = null;
  let _fakeChannels = [];
  let _ctrl    = null;
  let _data    = null;

  // Clock-sync state (all in frames)
  let _playheadStartTime = 0;
  let _producedFrames = 0;
  let _workletDropped = 0;
  let _lastUnderruns = 0;
  let _adaptiveExtra = 0;
  let _lastUnderrunTime = 0;
  let _pushCount = 0;

  try {
    _fakeBuf = ctx.createBuffer(nCh, bufsz, SR);
    _fakeChannels = Array.from({ length: nCh }, (_, c) => _fakeBuf.getChannelData(c));
  } catch(e) {}

  /* Push ONE SDL callback's worth of audio to the worklet ring */
  function pushOne() {
    if (!_handler || !_fakeBuf || !_wn || !_ctrl || !_data) return false;
    let w = Atomics.load(_ctrl, 0);
    let r = Atomics.load(_ctrl, 1);
    const used = (w - r + RING_CAP) % RING_CAP;
    const free = RING_CAP - 1 - used;
    if (bufsz > free) {
      return false;
    }
    try { _handler({ outputBuffer: _fakeBuf }); } catch(e) { return false; }
    const measurePeak = (_pushCount++ & 15) === 0;
    let peak = 0;
    for (let i = 0; i < bufsz; i++) {
      for (let c = 0; c < nCh; c++) {
        const sample = _fakeChannels[c][i];
        _data[w * nCh + c] = sample;
        if (measurePeak) peak = Math.max(peak, Math.abs(sample));
      }
      w = (w + 1) % RING_CAP;
    }
    audioDebug.callbacks++;
    audioDebug.rate = SR;
    if (measurePeak) {
      audioDebug.peak = Math.round(peak * 32767);
      if (peak > 0) audioDebug.nonsilent++;
    }
    Atomics.store(_ctrl, 0, w);
    _producedFrames += bufsz;
    return true;
  }

  function resetPlayhead(now) {
    _playheadStartTime = now || ctx.currentTime || 0;
    _producedFrames = 0;
  }

  /* Clock-locked pump: safe to call as often as desired. */
  function pump() {
    if (ctx.state !== 'running' || !_handler || !_wn) return;
    if (!_playheadStartTime) resetPlayhead(ctx.currentTime);

    _workletDropped = Atomics.load(_ctrl, 3);
    const underruns = Atomics.load(_ctrl, 4);
    if (underruns !== _lastUnderruns) {
      _lastUnderruns = underruns;
      _lastUnderrunTime = ctx.currentTime;
      _adaptiveExtra = Math.min(SR * 0.120, _adaptiveExtra + bufsz);
      audioDebug.underruns = underruns;
    } else if (_adaptiveExtra > 0 && ctx.currentTime - _lastUnderrunTime > 3.0) {
      _adaptiveExtra = Math.max(0, _adaptiveExtra - bufsz * 0.25);
    }

    const writePos = Atomics.load(_ctrl, 0);
    const readPos = Atomics.load(_ctrl, 1);
    const ringFill = (writePos - readPos + RING_CAP) % RING_CAP;
    const targetFill = LOOKAHEAD + _adaptiveExtra;
    const maxFill = MAX_FILL + _adaptiveExtra;
    if (ringFill > maxFill) return;

    let elapsedFrames = Math.max(0, Math.floor((ctx.currentTime - _playheadStartTime) * SR));
    if (_producedFrames < elapsedFrames - maxFill) {
      resetPlayhead(ctx.currentTime);
      elapsedFrames = 0;
    }
    const targetProducedFrames = elapsedFrames + targetFill;
    const maxProducedFrames = elapsedFrames + maxFill;

    // Push only until the produced playhead reaches the lookahead window.
    let n = 0;
    while (
      _producedFrames + bufsz <= targetProducedFrames &&
      _producedFrames + bufsz <= maxProducedFrames &&
      ringFill + n * bufsz < maxFill &&
      n < MAX_BURST
    ) {
      if (!pushOne()) break;
      n++;
    }
  }

  function startPump() {
    if (_timerId) return;
    pump();
    // Short tick with ring-fill gating: stable under main-thread jitter without over-pushing.
    _timerId = setInterval(pump, 2);
    log('AUDIO SP-shim: pump started (bufsz=' + bufsz + ' SR=' + SR +
        ' lookahead=' + Math.round(LOOKAHEAD) + 'fr / ' +
        (LOOKAHEAD * 1000 / SR).toFixed(0) + 'ms).', 'ok');
  }

  function tryFinalize() {
    if (!_wn || !_dest) return;
    _gain = ctx.createGain();
    _gain.gain.value = 1.0;
    _wn.connect(_gain);
    _gain.connect(_dest);
    if (_handler) startPump();
    log('AUDIO SP-shim: connected to destination.', 'ok');
  }

  (async () => {
    const ok = await ensureSpShimModule(ctx);
    if (!ok) { log('AUDIO: SP shim worklet load failed.', 'warn'); return; }
    try {
      if (typeof SharedArrayBuffer === 'undefined') {
        log('AUDIO: SharedArrayBuffer unavailable, SP shim cannot run without extra copies.', 'err');
        return;
      }
      const sab = new SharedArrayBuffer(32 + RING_CAP * nCh * 4);
      _ctrl = new Int32Array(sab, 0, 8);
      _data = new Float32Array(sab, 32, RING_CAP * nCh);
      _wn = new AudioWorkletNode(ctx, 'ppsspp-sp-shim', {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [nCh],
        processorOptions: { channels: nCh, cap: RING_CAP, sab },
      });
      _wn.onprocessorerror = (e) =>
        log('AUDIO: SP shim processor error: ' + (e?.message || e), 'err');
      tryFinalize();
    } catch(e) {
      log('AUDIO: SP shim AudioWorkletNode failed: ' + (e?.message || e), 'err');
    }
  })();

  return {
    get onaudioprocess()   { return _handler; },
    set onaudioprocess(fn) {
      _handler = fn;
      // Handler assigned after connect? Start pump now.
      if (_wn && _dest && !_timerId) startPump();
    },
    connect(dest) { _dest = dest; tryFinalize(); },
    disconnect() {
      if (_timerId) { clearInterval(_timerId); _timerId = null; }
      try { if (_gain) _gain.disconnect(); } catch(e) {}
      try { if (_wn)   _wn.disconnect();   } catch(e) {}
    },
    addEventListener()    {},
    removeEventListener() {},
  };
}

async function installScriptProcessorPolyfill(ctx) {
  if (!ctx || !ctx.audioWorklet) {
    log('AUDIO: AudioWorklet not available — ScriptProcessor polyfill skipped.', 'warn');
    return;
  }
  // Pre-load the shim worklet module NOW (inside user gesture) so it's
  // ready before SDL synchronously calls createScriptProcessor.
  await ensureSpShimModule(ctx);

  // Patch AudioContext.prototype globally — covers SDL's own context too.
  const proto = AudioContext.prototype;
  if (proto._ppssppSpPatched) return;
  proto._ppssppSpPatched = true;

  const _origCreate = proto.createScriptProcessor;
  proto.createScriptProcessor = function(bufSize, nIn, nOut) {
    // Always use the shim — avoids Chrome's deprecated/broken native node
    // and the "onaudioprocess never fires" bug on Chrome 126+.
    // On Firefox/Safari the shim works identically.
    log('AUDIO: createScriptProcessor → WorkletShim (bufSz=' + bufSize +
        ', nCh=' + (nOut || 2) + ').', 'info');
    return makeScriptProcessorShim(this, bufSize, nIn, nOut);
  };
  log('AUDIO: ScriptProcessor→AudioWorklet polyfill active (all browsers).', 'ok');
}

/* ── Gamepad ────────────────────────────────────────────────────── */
const connectedGamepads = new Map();
const GAMEPAD_POLL_MS = 1000;
const GAMEPAD_SDL_RECONNECT_MS = 5000;
const GAMEPAD_SELECT_KEY = "ppsspp_active_gamepad_index";
let gamepadPollTimer = 0;
let activeGamepadIndex = Number(localStorage.getItem(GAMEPAD_SELECT_KEY) ?? -1);
if (!Number.isInteger(activeGamepadIndex)) activeGamepadIndex = -1;
window.__ppssppActiveGamepadIndex = activeGamepadIndex;
const nativeGetGamepads = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : null;

function installGamepadSelectionFilter() {
  if (!nativeGetGamepads || navigator.__ppssppGamepadFiltered) return;
  try {
    Object.defineProperty(navigator, "__ppssppGamepadFiltered", { value: true });
    navigator.getGamepads = function() {
      const pads = nativeGetGamepads();
      if (!pads || !isActiveGamepadPresent()) return pads;

      const filtered = Array.from(pads);
      for (let i = 0; i < filtered.length; i++) {
        if (filtered[i] && filtered[i].index !== window.__ppssppActiveGamepadIndex)
          filtered[i] = null;
      }
      return filtered;
    };
  } catch(e) {
    log("GAMEPAD: controller filter unavailable in this browser: " + (e?.message || e), "warn");
  }
}

function isActiveGamepadPresent() {
  if (window.__ppssppActiveGamepadIndex < 0) return false;
  if (connectedGamepads.has(window.__ppssppActiveGamepadIndex)) return true;
  try {
    return !!nativeGetGamepads?.().find(gp => gp && gp.connected !== false && gp.index === window.__ppssppActiveGamepadIndex);
  } catch(e) {
    return false;
  }
}

function shouldHideGamepadFromSDL(gp) {
  return !!gp && isActiveGamepadPresent() && gp.index !== window.__ppssppActiveGamepadIndex;
}

window.addEventListener("gamepadconnected", e => {
  if (shouldHideGamepadFromSDL(e.gamepad)) {
    e.stopImmediatePropagation();
    rememberGamepad(e.gamepad, "available", { refreshSDL: false });
  }
}, true);
window.addEventListener("gamepaddisconnected", e => {
  if (shouldHideGamepadFromSDL(e.gamepad)) {
    e.stopImmediatePropagation();
    connectedGamepads.delete(e.gamepad.index);
    updateGamepadSelector();
  }
}, true);

function redispatchSelectedGamepadConnection(reason) {
  if (activeGamepadIndex < 0 || typeof GamepadEvent !== "function") return;
  const gp = connectedGamepads.get(activeGamepadIndex) || getBrowserGamepads().find(p => p.index === activeGamepadIndex);
  if (!gp) return;
  try {
    const ev = new GamepadEvent("gamepadconnected", { gamepad: gp });
    ev.__ppssppSynthetic = true;
    window.dispatchEvent(ev);
    log('GAMEPAD selected controller exposed to SDL: [' + gp.index + '] "' + gp.id + '" (' + reason + ')', "info");
  } catch(e) {
  }
}

function shortGamepadName(id) {
  return (id || "Gamepad").replace(/\s+/g, " ").trim().slice(0, 34);
}

function updateGamepadBadge() {
  if (!gamepadBadge) return;
  const n = connectedGamepads.size;
  if (n === 0) { gamepadBadge.textContent = "\uD83C\uDFAE No controller"; gamepadBadge.className = "badge"; }
  else {
    const active = connectedGamepads.get(activeGamepadIndex);
    const names = activeGamepadIndex >= 0 && active
      ? "Active: " + shortGamepadName(active.id).slice(0, 22)
      : [...connectedGamepads.values()].map(g => shortGamepadName(g.id).slice(0,22)).join(", ");
    gamepadBadge.textContent = "\uD83C\uDFAE " + n + ": " + names;
    gamepadBadge.className   = "badge active";
  }
}

function updateGamepadSelector() {
  if (!gamepadSelect) {
    updateGamepadBadge();
    return;
  }
  const previous = String(activeGamepadIndex);
  gamepadSelect.innerHTML = "";

  const auto = document.createElement("option");
  auto.value = "-1";
  auto.textContent = "All controllers";
  gamepadSelect.appendChild(auto);

  const sorted = [...connectedGamepads.values()].sort((a, b) => a.index - b.index);
  for (const gp of sorted) {
    const opt = document.createElement("option");
    opt.value = String(gp.index);
    opt.textContent = "Pad " + (gp.index + 1) + ": " + shortGamepadName(gp.id);
    gamepadSelect.appendChild(opt);
  }

  if (activeGamepadIndex >= 0 && !connectedGamepads.has(activeGamepadIndex)) {
    const missing = document.createElement("option");
    missing.value = previous;
    missing.textContent = "Pad " + (activeGamepadIndex + 1) + " (waiting)";
    gamepadSelect.appendChild(missing);
  }

  gamepadSelect.value = previous;
  gamepadSelect.disabled = !navigator.getGamepads;
  updateGamepadBadge();
}

function setActiveGamepadIndex(index, source = "selector") {
  activeGamepadIndex = Number.isInteger(index) ? index : -1;
  window.__ppssppActiveGamepadIndex = activeGamepadIndex;
  localStorage.setItem(GAMEPAD_SELECT_KEY, String(activeGamepadIndex));

  const gp = connectedGamepads.get(activeGamepadIndex);
  const label = activeGamepadIndex < 0 ? "All controllers" : (gp ? shortGamepadName(gp.id) : "Pad " + (activeGamepadIndex + 1));
  log("GAMEPAD active controller: " + label + " (" + source + ")", "info");
  updateGamepadSelector();
  reconnectKnownGamepadsForSDL("controller select", true);
  redispatchSelectedGamepadConnection("controller select");
  canvas?.focus();
}

function flashGamepadBadge() {
  if (!gamepadBadge) return;
  gamepadBadge.style.transition = "none";
  gamepadBadge.style.outline    = "2px solid var(--accent)";
  setTimeout(() => { gamepadBadge.style.transition = ""; gamepadBadge.style.outline = ""; }, 800);
}

function getBrowserGamepads() {
  try {
    return nativeGetGamepads ? Array.from(nativeGetGamepads()).filter(Boolean) : [];
  } catch(e) {
    log("GAMEPAD: scan failed: " + (e?.message || e), "warn");
    return [];
  }
}

function gamepadInfo(gp) {
  return {
    id: gp.id || "Gamepad",
    index: gp.index,
    mapping: gp.mapping || "",
    axes: gp.axes?.length || 0,
    buttons: gp.buttons?.length || 0,
    timestamp: gp.timestamp || 0,
    lastSeen: performance.now(),
    lastSDLReconnect: connectedGamepads.get(gp.index)?.lastSDLReconnect || 0,
  };
}

function dispatchSDLGamepadReconnect(gp, reason, force = false) {
  const state = connectedGamepads.get(gp.index);
  if (!started || !window.Module || !state) return false;

  const now = performance.now();
  if (!force && now - state.lastSDLReconnect < GAMEPAD_SDL_RECONNECT_MS) return false;
  state.lastSDLReconnect = now;

  try {
    if (typeof GamepadEvent !== "function") return false;
    const ev = new GamepadEvent("gamepadconnected", { gamepad: gp });
    ev.__ppssppSynthetic = true;
    window.dispatchEvent(ev);
    log('GAMEPAD reconnect hint for SDL: [' + gp.index + '] "' + gp.id + '" (' + reason + ')', "info");
    return true;
  } catch(e) {
    return false;
  }
}

function rememberGamepad(gp, source, options = {}) {
  if (!gp || gp.connected === false) return false;

  const prev = connectedGamepads.get(gp.index);
  const next = gamepadInfo(gp);
  if (prev) {
    next.lastSDLReconnect = prev.lastSDLReconnect;
    connectedGamepads.set(gp.index, next);
    return false;
  }

  connectedGamepads.set(gp.index, next);
  log('GAMEPAD ' + source + ': [' + gp.index + '] "' + gp.id + '" axes=' + next.axes + ' buttons=' + next.buttons + ' mapping="' + next.mapping + '"', "ok");
  updateGamepadSelector();
  flashGamepadBadge();
  if (options.refreshSDL) dispatchSDLGamepadReconnect(gp, source, options.forceSDL);
  return true;
}

function reconcileGamepads(source = "scan", options = {}) {
  const pads = getBrowserGamepads();
  const present = new Set();
  for (const gp of pads) {
    if (!gp || gp.connected === false) continue;
    present.add(gp.index);
    rememberGamepad(gp, source, options);
  }

  let removed = false;
  for (const [index, state] of connectedGamepads) {
    if (!present.has(index)) {
      connectedGamepads.delete(index);
      removed = true;
      log('GAMEPAD missing: [' + index + '] "' + state.id + '"');
    }
  }

  if (removed || pads.length) updateGamepadSelector();
  if (!pads.length && options.verbose)
    log("GAMEPAD: no controller detected. Press a button once if the browser is hiding it.", "warn");
  return pads.length;
}

function reconnectKnownGamepadsForSDL(reason, force = false) {
  let n = 0;
  for (const gp of getBrowserGamepads()) {
    if (!gp || gp.connected === false) continue;
    rememberGamepad(gp, reason);
    if (dispatchSDLGamepadReconnect(gp, reason, force)) n++;
  }
  if (n > 0) {
    canvas?.focus();
    flashGamepadBadge();
  }
  return n;
}

function startSmartGamepadPolling() {
  if (gamepadPollTimer || !navigator.getGamepads) return;
  reconcileGamepads("startup scan");
  gamepadPollTimer = setInterval(() => {
    reconcileGamepads("runtime scan", { refreshSDL: true });
  }, GAMEPAD_POLL_MS);
}

function onGamepadConnected(e) {
  const gp = e.gamepad;
  rememberGamepad(gp, e.__ppssppSynthetic ? "refreshed" : "connected", { refreshSDL: false });
  canvas?.focus();
}
function onGamepadDisconnected(e) {
  const gp = e.gamepad; connectedGamepads.delete(gp.index);
  log('GAMEPAD disconnected: [' + gp.index + '] "' + gp.id + '"');
  updateGamepadSelector();
}
window.addEventListener("gamepadconnected",    onGamepadConnected);
window.addEventListener("gamepaddisconnected", onGamepadDisconnected);

function probeExistingGamepads() {
  reconcileGamepads("present", { verbose: true, refreshSDL: true, forceSDL: true });
}

function showGamepadDiag() {
  if (!navigator.getGamepads) { log("GAMEPAD: navigator.getGamepads API unavailable.", "warn"); return; }
  let found = 0;
  for (const gp of getBrowserGamepads()) {
    if (!gp) continue; found++;
    const axes = Array.from(gp.axes).map(v=>v.toFixed(2)).join(", ");
    const btns = Array.from(gp.buttons).map((b,i)=>b.pressed?"B"+i+"("+b.value.toFixed(2)+")":null).filter(Boolean).join(", ")||"none";
    log('GAMEPAD[' + gp.index + '] "' + gp.id.slice(0,60) + '" mapping=' + gp.mapping);
    log("  axes=[" + axes + "]");
    log("  pressed=[" + btns + "]");
  }
  if (!found) log("GAMEPAD: no controller detected — press a button on your controller first.", "warn");
}

on(gamepadSelect, "change", () => {
  const index = Number(gamepadSelect.value);
  setActiveGamepadIndex(Number.isInteger(index) ? index : -1);
});
on(gamepadSelect, "pointerdown", () => {
  probeExistingGamepads();
  reconnectKnownGamepadsForSDL("controller menu", false);
});
on(gamepadSelect, "focus", () => {
  probeExistingGamepads();
});
window.addEventListener("focus", () => {
  startSmartGamepadPolling();
  reconnectKnownGamepadsForSDL("window focus");
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) reconnectKnownGamepadsForSDL("page visible");
});
installGamepadSelectionFilter();
updateGamepadSelector();
startSmartGamepadPolling();

/* ── GPU probe ──────────────────────────────────────────────────── */
function probeWebGLFeaturesWithPref(powerPreference) {
  const pc = document.createElement("canvas");
  const gl = pc.getContext("webgl2", { powerPreference, alpha: false, antialias: false, depth: true, stencil: true, preserveDrawingBuffer: false });
  setInfoVal("iWebgl2", gl ? "yes" : "no", gl ? "good" : "bad");
  if (!gl) {
    log("WebGL2 unavailable — GLES3/WebGL2 rendering cannot start.", "err");
    if (gpuBadge) {
      gpuBadge.textContent = "\uD83D\uDDA5 No WebGL2";
      gpuBadge.className = "badge error";
    }
    return;
  }
  const dbg      = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const vendor   = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)   : gl.getParameter(gl.VENDOR);
  const version  = gl.getParameter(gl.VERSION);
  const glslVer  = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
  const maxTex   = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const anisoExt = gl.getExtension("EXT_texture_filter_anisotropic");
  const maxAniso = anisoExt ? gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
  const hasStencil   = !!gl.getExtension("WEBGL_stencil_texturing");
  const hasMultiDraw = !!gl.getExtension("WEBGL_multi_draw");
  let simd = false;
  try { simd = WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11])); } catch(e) {}

  log("GPU: " + renderer);
  log("GPU vendor: " + vendor);
  log("WebGL: " + version);
  log("GLSL: " + glslVer);
  log("MaxTexture: " + maxTex + " | MaxAnisotropy: " + maxAniso);
  log("stencil_texturing: " + hasStencil + " | multi_draw: " + hasMultiDraw, hasStencil ? undefined : "warn");
  if (!hasStencil) log("WARNING: without WEBGL_stencil_texturing some games may show black scenes.", "warn");

  setInfoVal("iRenderer", renderer);
  setInfoVal("iVendor",   vendor);
  setInfoVal("iVersion",  version);
  setInfoVal("iGlsl",     glslVer);
  setInfoVal("iMaxTex",   String(maxTex));
  setInfoVal("iAniso",    String(maxAniso));
  setInfoVal("iStencil",  hasStencil   ? "yes" : "no", hasStencil   ? "good" : "warn");
  setInfoVal("iMultiDraw",hasMultiDraw ? "yes" : "no", hasMultiDraw ? "good" : "");
  setInfoVal("iSIMD",     simd         ? "yes" : "no", simd         ? "good" : "warn");
  setInfoVal("iHWC",      String(navigator.hardwareConcurrency || "?"));
  setInfoVal("iCOI",      String(window.crossOriginIsolated), window.crossOriginIsolated ? "good" : "bad");
  setInfoVal("iSAB",      typeof SharedArrayBuffer !== "undefined" ? "yes" : "no",
                          typeof SharedArrayBuffer !== "undefined" ? "good" : "bad");

  const short = renderer.replace(/\(.*?\)/g,"").trim().slice(0,32);
  if (gpuBadge) {
    gpuBadge.textContent = "\uD83D\uDDA5 " + short;
    gpuBadge.className   = "badge active";
    gpuBadge.title       = "[" + powerPreference + "]\n" + renderer + "\n" + vendor + "\n" + version + "\nGLSL: " + glslVer + "\nMaxTex: " + maxTex + "  MaxAniso: " + maxAniso + "\nstencil_texturing: " + hasStencil + "  multi_draw: " + hasMultiDraw;
  }
}

function probeWebGLFeatures() { probeWebGLFeaturesWithPref(gpuSelectEl?.value || "high-performance"); }

on(gpuSelectEl, "change", () => {
  log('GPU selector changed to "' + gpuSelectEl.value + '" — re-probing WebGL...');
  probeWebGLFeaturesWithPref(gpuSelectEl.value);
});

/* ── Error handlers ─────────────────────────────────────────────── */
window.addEventListener("error",             (e) => log("JS ERROR: " + (e.message || e.error || "unknown"), "err"));
window.addEventListener("unhandledrejection",(e) => log("PROMISE ERROR: " + (e.reason?.stack || e.reason || "unknown"), "err"));

const COI_RELOAD_KEY = "ppsspp-coi-reload-count";

async function reloadForCrossOriginIsolation(reason) {
  if (window.crossOriginIsolated) {
    sessionStorage.removeItem(COI_RELOAD_KEY);
    return true;
  }

  const attempts = Number(sessionStorage.getItem(COI_RELOAD_KEY) || "0");
  if (attempts >= 3) {
    log("Cross-origin isolation still unavailable after reload attempts. SharedArrayBuffer cannot be used on this page.", "err");
    setStatus("SharedArrayBuffer unavailable. Reload the page or clear site data.", "err");
    hideLoading();
    setStartButtonMode("idle");
    return false;
  }

  if (!("serviceWorker" in navigator)) {
    log("Service workers are unavailable, cannot synthesize COOP/COEP headers for GitHub Pages.", "err");
    setStatus("This browser cannot enable SharedArrayBuffer for GitHub Pages.", "err");
    return false;
  }

  sessionStorage.setItem(COI_RELOAD_KEY, String(attempts + 1));
  log("Cross-origin isolation required for WASM threads; reloading through service worker" + (reason ? " (" + reason + ")" : "") + ".", "warn");
  setStatus("Preparing SharedArrayBuffer isolation\u2026", "run");
  showLoading("Preparing secure runtime\u2026");

  try {
    await navigator.serviceWorker.register("sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;
  } catch(e) {
    log("SW registration before isolation reload failed: " + (e?.message || e), "warn");
  }

  location.reload();
  return false;
}

/* ── Asset / game loading ───────────────────────────────────────── */
function dirname(p) { const s = p.lastIndexOf("/"); return s === -1 ? "" : p.slice(0, s); }

async function preloadAssets(FS) {
  const atlasMeta = VIRTUAL_ASSETS + "/font_atlas.meta";
  const atlasZim = VIRTUAL_ASSETS + "/font_atlas.zim";
  if (USE_PRELOADED_ASSETS) {
    log("Assets are provided by PPSSPPSDL.data; waiting on Emscripten preload dependencies.", "ok");
    return;
  }

  if (FS.analyzePath(atlasMeta).exists && FS.analyzePath(atlasZim).exists) {
    log("Assets already mounted by Emscripten preload package.", "ok");
    return;
  }

  log("Fetching asset manifest: " + MANIFEST);
  const r = await fetch(MANIFEST, { cache: "no-store" });
  if (!r.ok) throw new Error("Asset manifest not found: " + r.status);
  const files = (await r.text()).split("\n").map(l=>l.trim()).filter(Boolean);
  FS.mkdirTree(VIRTUAL_ASSETS);
  log("Assets in manifest: " + files.length);
  let idx = 0;
  const workers = Math.min(8, Math.max(2, navigator.hardwareConcurrency || 4), files.length);
  async function loadNext() {
    while (idx < files.length) {
      const i = idx++, rel = files[i];
      const target = VIRTUAL_ASSETS + "/" + rel;
      const dir = dirname(target); if (dir) FS.mkdirTree(dir);
      setStatus("Loading asset " + (i+1) + "/" + files.length + ": " + rel, "run");
      showLoading("Loading assets\u2026 " + (i+1) + " / " + files.length, (i+1) / files.length);
      const res = await fetch(ASSET_DIR + rel);
      if (!res.ok) throw new Error("Asset not found: " + rel + " (" + res.status + ")");
      FS.writeFile(target, new Uint8Array(await res.arrayBuffer()));
    }
  }
  await Promise.all(Array.from({ length: workers }, loadNext));
  if (!FS.analyzePath(atlasMeta).exists)
    throw new Error("Critical asset missing: font_atlas.meta");
  if (!FS.analyzePath(atlasZim).exists)
    throw new Error("Critical asset missing: font_atlas.zim");
  log("All assets loaded into MEMFS.", "ok");
}

async function preloadStoredGames(FS) {
  const games = await opfsWalk(OPFS_GAMES_DIR, "", false);
  if (!games.length) {
    log("OPFS games: no stored game files.", "dim");
    return 0;
  }

  FS.mkdirTree(VIRTUAL_GAME_DIR);
  const favorites = prunePreloadFavorites(games.map(game => game.path)).filter(name => name !== selectedStoredGame);
  if (!favorites.length) {
    log("OPFS games: " + games.length + " stored file(s) available. No startup preload games selected.", "ok");
    return 0;
  }

  let ok = 0;
  let bytesMounted = 0;
  for (const name of favorites) {
    const target = VIRTUAL_GAME_DIR + "/" + name;
    try {
      setStatus("Preloading game " + (ok + 1) + "/" + favorites.length + ": " + name, "run");
      showLoading("Preloading game: " + name);
      const data = await opfsReadGame(name);
      FS.writeFile(target, data);
      ok++;
      bytesMounted += data.byteLength || 0;
      log("Startup preload mounted: " + target + " (" + formatBytes(data.byteLength || 0) + ")", "ok");
    } catch(e) {
      log("Startup preload failed " + name + ": " + e.message, "warn");
    }
  }
  log("OPFS games: preloaded " + ok + "/" + favorites.length + " game file(s) into " + VIRTUAL_GAME_DIR + " (" + formatBytes(bytesMounted) + ").", "ok");
  return ok;
}

let fastGameMountSeq = 0;
function makeWorkerFsGameFile(file, safeName) {
  if (!file || file.name === safeName || typeof File !== "function") return file;
  return new File([file], safeName, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified || Date.now(),
  });
}

function mountGameFileFast(FS, file, safeName, label) {
  const workerFS = globalThis.WORKERFS || window.WORKERFS;
  if (!workerFS || !FS?.mount) return null;

  const mountFile = makeWorkerFsGameFile(file, safeName);
  const mountDir = VIRTUAL_GAME_DIR + "/.fast-" + (++fastGameMountSeq);
  try {
    FS.mkdirTree(VIRTUAL_GAME_DIR);
    FS.mkdirTree(mountDir);
    FS.mount(workerFS, { files: [mountFile] }, mountDir);
    const path = mountDir + "/" + mountFile.name;
    log("Fast-mounted game via WORKERFS" + (label ? " (" + label + ")" : "") + ": " + path, "ok");
    return path;
  } catch(e) {
    log("Fast game mount failed, falling back to MEMFS: " + e.message, "warn");
    try { if (FS.analyzePath?.(mountDir)?.exists) FS.rmdir(mountDir); } catch(_) {}
    return null;
  }
}

function persistSelectedGameInBackground(file) {
  if (!file) return;
  (async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await opfsPutGame(file.name, bytes);
    log("Game saved to OPFS after fast mount: " + file.name, "ok");
    refreshLibrary();
    updateStorageInfo();
  })().catch(e => log("Could not persist fast-mounted game in OPFS: " + e.message, "warn"));
}

async function preloadGame(FS) {
  if (!selectedGame && !selectedStoredGame) return null;
  FS.mkdirTree(VIRTUAL_GAME_DIR);
  const sourceName = selectedGame ? selectedGame.name : selectedStoredGame;
  const safe = sourceName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = VIRTUAL_GAME_DIR + "/" + safe;
  setStatus("Fast loading game: " + sourceName, "run");
  showLoading("Fast loading game: " + sourceName);

  if (selectedGame) {
    const fastPath = mountGameFileFast(FS, selectedGame, safe, "selected file");
    if (fastPath) {
      persistSelectedGameInBackground(selectedGame);
      return fastPath;
    }
  } else if (selectedStoredGame) {
    const storedFile = await opfsGetGameFile(selectedStoredGame);
    const fastPath = mountGameFileFast(FS, storedFile, safe, "OPFS");
    if (fastPath) return fastPath;
  }

  setStatus("Loading game into memory: " + sourceName, "run");
  showLoading("Loading game: " + sourceName);
  const bytes = selectedGame
    ? new Uint8Array(await selectedGame.arrayBuffer())
    : await opfsReadGame(selectedStoredGame);
  FS.writeFile(path, bytes);
  try { if (selectedGame) await opfsPutGame(selectedGame.name, bytes); }
  catch(e) { log("Could not persist game in OPFS: " + e.message, "warn"); }
  log("Game mounted in MEMFS" + (selectedGame ? " and saved to OPFS" : " from OPFS") + ": " + path, "ok");
  return path;
}

/* ── Panel navigation ───────────────────────────────────────────── */
function activatePanelTab(tabName) {
  const name = tabName || "library";
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
  const id = "tab" + name.charAt(0).toUpperCase() + name.slice(1);
  const panel = document.getElementById(id);
  if (panel) panel.classList.add("active");
  if (panelTabSelect && panelTabSelect.value !== name) panelTabSelect.value = name;
  if (name === "library") refreshLibrary();
  if (name === "drive") initDriveConfigUI();
  if (name === "network") updateNetworkConfigUI();
}

panelTabSelect?.addEventListener("change", e => activatePanelTab(e.currentTarget.value));
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => activatePanelTab(tab.dataset.tab));
});

/* ── FPS counter ────────────────────────────────────────────────── */
let fpsFrames = 0, fpsLast = performance.now();
(function tickFps() {
  fpsFrames++;
  const now = performance.now();
  if (now - fpsLast >= 1000) {
    const fps = Math.round(fpsFrames * 1000 / (now - fpsLast));
    fpsFrames = 0; fpsLast = now;
    if (started && fpsBadge && !fullscreenElement()) {
      fpsBadge.style.display = "block";
      fpsBadge.textContent = fps + " FPS";
    } else if (fpsBadge) {
      fpsBadge.style.display = "none";
    }
  }
  requestAnimationFrame(tickFps);
})();

/* ── Launch ─────────────────────────────────────────────────────── */
async function start() {
  if (started) return;
  if (!canvas) {
    setStatus("Runtime UI is not ready: canvas element missing", "err");
    return;
  }
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
    await reloadForCrossOriginIsolation("launch");
    return;
  }
  sessionStorage.removeItem(COI_RELOAD_KEY);
  started = true;
  document.body.classList.add("emulator-started");
  log("Launch button clicked.", "info");
  setStartButtonMode("loading");
  fileLabel?.classList.add("disabled");
  if (fileInput) fileInput.disabled = true;
  if (gpuSelectEl) gpuSelectEl.disabled = true;
  canvas?.focus();
  showLoading("Initializing audio\u2026");
  await selectBuildDir();

  let preAudioCtx = null;
  try {
    preAudioCtx = new AudioContext({ latencyHint: "interactive" });
    await preAudioCtx.resume();
    log("AUDIO: AudioContext pre-initialized for SDL (state=" + preAudioCtx.state + ", sr=" + preAudioCtx.sampleRate + ").", "ok");
    // Install ScriptProcessor→AudioWorklet polyfill for Chrome 126+ compat.
    // This MUST run inside the user gesture (button click) so the worklet
    // module loads on the already-running AudioContext.
    await installScriptProcessorPolyfill(preAudioCtx);
  } catch(e) { log("AUDIO: pre-init AudioContext failed: " + (e?.message || e), "warn"); }

  let gameArg = null;
  const chosenPowerPref = gpuSelectEl?.value || "high-performance";
  log('GPU powerPreference: "' + chosenPowerPref + '"', "info");
  if (localStorage.getItem("ppsspp_touch_mouse_fallback") === "1") {
    installTouchMouseShim();
  }

  window.Module = {
    canvas,
    webglContextAttributes: {
      powerPreference: chosenPowerPref,
      alpha: false, antialias: false, depth: true, stencil: true,
      preserveDrawingBuffer: false, desynchronized: true,
      failIfMajorPerformanceCaveat: false,
    },
    SDL2: preAudioCtx ? { audioContext: preAudioCtx } : {},
    arguments: [],
    locateFile(path) {
      let url = BUILD_DIR + path;
      if (path.endsWith(".wasm") || path.endsWith(".worker.js") || path.endsWith(".data")) url += "?v=" + BUILD_STAMP;
      log("locateFile: " + path + " -> " + url);
      return url;
    },
    print(text)    { log("stdout: " + text); },
    printErr(text) {
      updateAudioDebugFromLog(text);
      if (!/WASM audio (push|callback) count=/.test(text)) log("stderr: " + text);
    },
    setStatus(text) { if (text) setStatus(text, "run"); },
    monitorRunDependencies(left) {
      log("Run dependencies remaining: " + left);
      if (left > 0) setStatus("Runtime init: " + left + " dependencies", "run");
    },
    preRun: [function () {
      log("preRun started.");
      addRunDependency("ppsspp-assets");
      (async () => {
        try {
          await preloadAssets(FS);
          // Restore persisted config and saves from OPFS
          setStatus("Restoring saves from OPFS\u2026", "run");
          showLoading("Restoring saves\u2026");
          await loadPersistedFiles(FS);
          await preloadStoredGames(FS);
          await forceGamesDirectoryConfig(FS);
          gameArg = await preloadGame(FS);
          Module.arguments.length = 0;
          Module.arguments.push(...emulatorLaunchArgs());
          if (gameArg) Module.arguments.push(gameArg);
          log("PPSSPP arguments: " + JSON.stringify(Module.arguments), "info");
          setStatus("Starting PPSSPP\u2026", "run");
          showLoading("Starting PPSSPP\u2026");
        } catch(err) {
          log("preRun failed: " + (err?.stack || err), "err");
          setStatus(err.message || String(err), "err");
          hideLoading(); throw err;
        } finally {
          log("preRun complete, removing asset dependency.");
          removeRunDependency("ppsspp-assets");
        }
      })();
    }],
    onRuntimeInitialized() {
      log("Runtime initialized.", "ok");
      runtimeReady = true;
      setStatus(gameArg ? "Game running" : "Library ready", "ok");
      hideLoading();
      setStartButtonMode("running");
      // Show runtime game loader button
      if (runtimeGameLabel) runtimeGameLabel.style.display = "";
      // Start auto-persist loop (every 30s)
      startAutoPersist();
      updateStorageInfo();
      refreshLibrary();
      setTimeout(() => setStatus(gameArg ? "Game running" : "Library ready", "ok"), 600);
      setTimeout(describeAudio, 1000);
      setTimeout(() => reconnectKnownGamepadsForSDL("runtime ready", true), 300);
      setTimeout(() => reconnectKnownGamepadsForSDL("runtime settled", true), 1500);
      setInterval(reportAudioStatus, 5000);
      setInterval(updateInfoPanel,   2000);
      // Initial persist after PPSSPP creates its directories
      setTimeout(() => persistFiles(window.FS, "init"), 8000);
    },
    onAbort(reason) {
      log("Runtime abort: " + reason, "err");
      setStatus("Abort: " + reason, "err");
      runtimeReady = false;
      hideLoading();
    }
  };

  const script = document.createElement("script");
  script.src   = BUILD_DIR + "PPSSPPSDL.js?v=" + BUILD_STAMP;
  log("Loading script: " + script.src);
  script.onload  = () => {
    log("PPSSPPSDL.js loaded.", "ok");
    if (loadNetworkConfig().enabled && !installSockFSAdhocRelay()) {
      log("Network: SOCKFS relay hook was not available in this build.", "warn");
    }
  };
  script.onerror = () => { setStatus("Failed to load PPSSPPSDL.js", "err"); hideLoading(); };
  document.body.appendChild(script);
}

/* ── Touch-to-mouse shim ───────────────────────────────────────── */
// Emergency fallback only. This converts touch to a single mouse pointer, so it
// intentionally disables multitouch and should stay off for normal mobile play.
function installTouchMouseShim() {
  if (installTouchMouseShim.installed) return;
  installTouchMouseShim.installed = true;

  const opts = { capture: true, passive: false };

  // Track the primary (first) active touch id for single-pointer emulation.
  let primaryId = null;

  function isCanvasTouch(e) {
    return e.target === canvas || e.composedPath?.().includes(canvas);
  }

  function toMouse(type, clientX, clientY, buttons) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true,
      clientX, clientY,
      button: 0, buttons,
      movementX: 0, movementY: 0,
    }));
  }

  window.addEventListener('touchstart', (e) => {
    if (!isCanvasTouch(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    for (const t of e.changedTouches) {
      if (primaryId === null) {
        primaryId = t.identifier;
        // Move first so SDL knows the coordinates before the button event.
        toMouse('mousemove', t.clientX, t.clientY, 1);
        toMouse('mousedown', t.clientX, t.clientY, 1);
      }
    }
  }, opts);

  window.addEventListener('touchmove', (e) => {
    if (!isCanvasTouch(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    for (const t of e.changedTouches) {
      if (t.identifier === primaryId) {
        toMouse('mousemove', t.clientX, t.clientY, 1);
        break;
      }
    }
  }, opts);

  window.addEventListener('touchend', (e) => {
    if (!isCanvasTouch(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    for (const t of e.changedTouches) {
      if (t.identifier === primaryId) {
        primaryId = null;
        toMouse('mouseup', t.clientX, t.clientY, 0);
        break;
      }
    }
  }, opts);

  window.addEventListener('touchcancel', (e) => {
    if (!isCanvasTouch(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    for (const t of e.changedTouches) {
      if (t.identifier === primaryId) {
        primaryId = null;
        toMouse('mouseup', t.clientX, t.clientY, 0);
        break;
      }
    }
  }, opts);

  log('Touch-to-mouse shim installed before SDL touch handlers.', 'info');
}

/* ── Event wiring ───────────────────────────────────────────────── */
on(fileInput, "change", () => {
  selectedGame = fileInput?.files?.[0] || null;
  selectedStoredGame = null;
  if (fileLabel) fileLabel.title = selectedGame ? selectedGame.name : "Open game";
  // Update the visible text node inside the label
  const textNode = fileLabel?.firstChild;
  if (textNode && textNode.nodeType === 3)
    textNode.textContent = (selectedGame ? "\uD83D\uDCC2 " + selectedGame.name : "\uD83D\uDCC2 Open Game") + " ";
  updateIdleOverlay();
  setStatus(selectedGame ? "Selected: " + selectedGame.name : "Ready. Open a game file or use Library.");
});

on(startBtn, "click", () => {
  start();
});
on(idleStartBtn, "click", start);

on("refreshLibraryBtn", "click", refreshLibrary);
on("libraryGrid", "click", e => {
  const button = e.target.closest("button[data-action]");
  if (!button) return;
  const name = button.dataset.game;
  if (!name) return;
  if (button.dataset.action === "play") playOrMountStoredGame(name);
  else if (button.dataset.action === "favorite") togglePreloadFavorite(name);
  else if (button.dataset.action === "info") showGameInfo(name);
  else if (button.dataset.action === "drive-upload") runDriveAction("upload-game", () => uploadSingleGameToDrive(name));
  else if (button.dataset.action === "delete") deleteStoredFile(VIRTUAL_GAME_DIR + "/" + name);
});
on("libraryImportFile", "change", e => {
  const f = e.target.files[0]; if (!f) return;
  e.target.value = "";
  addGameToLibrary(f);
});
on("libraryDownloadUrlBtn", "click", () => {
  addGameURLToLibrary(byId("libraryUrlInput")?.value || "");
});
on("libraryUrlInput", "keydown", e => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  addGameURLToLibrary(e.currentTarget.value);
});
on("gameInfoCloseBtn", "click", closeGameInfo);
on("gameInfoModal", "click", e => {
  if (e.target.id === "gameInfoModal") closeGameInfo();
});

// ── Runtime game loading ─────────────────────────────────────────
runtimeGameInput?.addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  e.target.value = "";
  loadGameAtRuntime(f);
});

// ── Saves tab buttons ─────────────────────────────────────────────
on("refreshSavesBtn", "click", refreshSavesTab);
on("exportAllSavesBtn", "click", exportSaves);
on("savesList", "click", async e => {
  const button = e.target.closest("button[data-save-action]");
  if (!button) return;
  const action = button.dataset.saveAction;
  try {
    if (action === "download-slot") {
      await downloadSaveSlot(button.dataset.slotDir, button.dataset.game);
    } else if (action === "drive-upload-slot") {
      await runDriveAction("upload-slot", () => uploadSingleSaveSlotToDrive(button.dataset.slotDir, button.dataset.game));
    } else if (action === "delete-slot") {
      await deleteSaveSlot(button.dataset.slotDir, button.dataset.game);
    } else if (action === "download-file") {
      await downloadSaveFile(button.dataset.path);
    } else if (action === "drive-upload-state") {
      await runDriveAction("upload-state", () => uploadSingleSaveStateToDrive(JSON.parse(button.dataset.paths || "[]"), button.dataset.game));
    } else if (action === "delete-pair") {
      await deleteSavePair(JSON.parse(button.dataset.paths || "[]"));
    }
  } catch(err) {
    showToast("❌ " + (err?.message || err));
    log("Save action failed: " + (err?.message || err), "err");
  }
});
on("importSaveSlotFile", "change", e => {
  const f = e.target.files[0]; if (!f) return;
  importSaveSlot(f); e.target.value = "";
});
on("deleteAllSavesBtn", "click", async () => {
  if (!confirm("Delete ALL save data and save states?\nThis cannot be undone.")) return;
  // Delete only save-related OPFS entries (not config files or games)
  const all = await opfsWalk();
  for (const { path } of all) {
    const isSave = SAVE_SUBDIRS.some(sub => path.includes("/" + sub.dir + "/"));
    if (!isSave) continue;
    try { await opfsDelete(path); } catch(e) {}
  }
  // Also wipe from live FS if running
  const FS = window.FS;
  if (FS) {
    const memstick = _detectedMemstick || detectMemstickDir(FS);
    for (const { dir, flat } of SAVE_SUBDIRS) {
      const base = memstick + "/" + dir;
      if (flat) {
        // flat: delete all files in the dir
        let entries; try { entries = FS.readdir(base).filter(n=>n!=="."&&n!==".."); } catch(e){ entries=[]; }
        for (const name of entries) { try { FS.unlink(base + "/" + name); } catch(e){} }
      } else {
        let games; try { games = FS.readdir(base).filter(n=>n!=="."&&n!==".."); } catch(e){ games=[]; }
        for (const g of games) {
          const slotDir = base + "/" + g;
          const files = readSaveSlotFiles(FS, slotDir);
          for (const {path} of files) { try { FS.unlink(path); } catch(e){} }
          try { FS.rmdir(slotDir); } catch(e){}
        }
      }
    }
  }
  showToast("🗑 All save data deleted");
  refreshSavesTab(); updateStorageInfo();
});

// ── Storage panel buttons ────────────────────────────────────────
on("syncNowBtn", "click", async () => {
  const FS = window.FS;
  if (!FS) { showToast("⚠ Start PPSSPP first"); return; }
  await persistFiles(FS, "manual");
  showToast("✓ Synced to OPFS");
});

on("exportSavesBtn", "click", exportSaves);

on("importSavesFile", "change", e => {
  const f = e.target.files[0]; if (!f) return;
  e.target.value = "";
  importSaves(f);
});

// ── Google Drive buttons ─────────────────────────────────────────
initDriveConfigUI();
restartDriveAutoSyncTimer(); // restore auto-sync timer if was enabled
if (handleGoogleRedirectCallback()) activatePanelTab("drive");
window.addEventListener("storage", e => {
  if (e.key !== GOOGLE_TOKEN_KEY) return;
  if (restoreGoogleToken()) {
    setDriveActivity("Google connected. Reading Drive…", "run");
    restartDriveAutoSyncTimer();
    refreshDriveList().catch(err => {
      const message = googleAuthErrorMessage(err);
      log("Google Drive refresh failed after cross-tab login: " + message, "err");
      setDriveActivity("Refresh failed: " + message, "bad");
    });
  } else {
    disconnectGoogleDrive();
  }
});
on("saveGoogleClientIdBtn", "click", () => {
  const value = (googleClientIdInput?.value || "").trim();
  if (value) localStorage.setItem(GOOGLE_CLIENT_ID_KEY, value);
  else localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
  setGoogleToken("", 0);
  takePendingDriveAction();
  googleTokenClient = null;
  setDriveInfo(value ? "Client ID saved" : "Client ID cleared", value ? "good" : "");
  showToast(value ? "Google client ID saved" : "Google client ID cleared");
});
on("toggleGoogleClientIdBtn", "click", () => {
  if (!googleClientIdInput) return;
  const visible = googleClientIdInput.type === "text";
  googleClientIdInput.type = visible ? "password" : "text";
  const button = byId("toggleGoogleClientIdBtn");
  if (button) {
    button.title = visible ? "Show client ID" : "Hide client ID";
    button.textContent = visible ? "\uD83D\uDC41" : "\u25CF";
  }
});
on("driveConnectBtn", "click", connectGoogleDrive);
on("driveDisconnectBtn", "click", disconnectGoogleDrive);
on("driveRefreshBtn", "click", async () => {
  try { await runDriveAction("refresh", refreshDriveList); showToast("✓ Drive refreshed"); }
  catch(e) {
    const message = googleAuthErrorMessage(e);
    log("Google Drive refresh failed: " + message, "err");
    setDriveActivity("Refresh failed: " + message, "bad");
    showToast("❌ " + message, 5000);
  }
});
on("driveUploadSavesBtn", "click", () => runDriveAction("upload-saves", uploadSavesToDrive));
on("driveRestoreSavesBtn", "click", () => runDriveAction("restore-saves", () => restoreDriveSave()));
on("driveUploadGamesBtn", "click", () => runDriveAction("upload-games", uploadGamesToDrive));
on("driveDownloadGamesBtn", "click", () => runDriveAction("download-games", downloadAllDriveGames));

// Drive auto-sync controls
on("driveAutoSyncToggle", "change", e => {
  localStorage.setItem(GOOGLE_AUTO_SYNC_KEY, e.target.checked ? "1" : "0");
  restartDriveAutoSyncTimer();
  showToast(e.target.checked ? "✓ Drive auto-sync enabled" : "Drive auto-sync disabled");
});
on("driveAutoSyncInterval", "change", e => {
  localStorage.setItem(GOOGLE_AUTO_SYNC_RATE_KEY, e.target.value);
  restartDriveAutoSyncTimer();
});

// Drive badge → navigate to Drive tab
driveBadgeEl?.addEventListener("click", () => activatePanelTab("drive"));
driveBadgeEl?.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") activatePanelTab("drive"); });

driveRemoteList?.addEventListener("click", e => {
  const button = e.target.closest("button[data-drive-action]");
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.driveAction === "restore-save") {
    const file = googleDriveRemoteCache.saves.find(f => f.id === id);
    if (file) restoreDriveSave(file);
  } else if (button.dataset.driveAction === "download-game") {
    const file = googleDriveRemoteCache.games.find(f => f.id === id);
    if (file) downloadDriveGame(file);
  }
});

on("clearStorageBtn", "click", async () => {
  if (!confirm("Delete ALL saved data and stored games from OPFS? This cannot be undone.")) return;
  await opfsClearAll();
  _lastPersistTime = 0;
  refreshLibrary();
  updateStorageInfo();
  log("OPFS storage cleared.", "warn");
  showToast("🗑 All saved data cleared");
});

window.addEventListener("pointerdown", () => { if (started) unlockAudio(); });
window.addEventListener("keydown",      () => { if (started) unlockAudio(); });
// Re-resume AudioContext when the tab becomes visible again (Chrome suspends on tab-switch)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && started) unlockAudio();
});
// Also resume on any focus event (covers tab-switching, alt-tab, etc.)
window.addEventListener("focus", () => { if (started) unlockAudio(); });

// ── Fullscreen + cursor auto-hide ─────────────────────────────────
let _fsCursorTimer = null;
function _hideCursor() { document.body.classList.add("fs-cursor-hidden"); }
function _showCursor() {
  document.body.classList.remove("fs-cursor-hidden");
  clearTimeout(_fsCursorTimer);
  if (fullscreenElement()) _fsCursorTimer = setTimeout(_hideCursor, 2000);
}

function isFullscreenActive() {
  return !!fullscreenElement();
}

function fullscreenTarget() {
  return stageEl || canvas || document.documentElement;
}

async function requestBrowserFullscreen() {
  const target = fullscreenTarget();
  if (!target) return false;

  try {
    if (target.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: "hide" });
      return true;
    }
    if (target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen();
      return true;
    }
  } catch(e) {
    log("Browser fullscreen request failed: " + (e?.message || e), "warn");
  }
  return false;
}

async function exitBrowserFullscreen() {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return true;
    }
    if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
      return true;
    }
  } catch(e) {
    log("Browser fullscreen exit failed: " + (e?.message || e), "warn");
  }
  return false;
}

function handleFullscreenChange() {
  syncFullscreenOverlays();
  scheduleRuntimeResize(true);
  if (fullscreenElement()) {
    _fsCursorTimer = setTimeout(_hideCursor, 2000);
    document.addEventListener("mousemove", _showCursor);
    document.addEventListener("pointerdown", _showCursor);
  } else {
    clearTimeout(_fsCursorTimer);
    document.body.classList.remove("fs-cursor-hidden");
    document.removeEventListener("mousemove", _showCursor);
    document.removeEventListener("pointerdown", _showCursor);
  }
}

document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

async function togglePPSSPPFullscreen() {
  if (isFullscreenActive()) {
    if (await exitBrowserFullscreen()) {
      scheduleRuntimeResize(true);
      return;
    }
  }

  if (await requestBrowserFullscreen()) {
    scheduleRuntimeResize(true);
    return;
  }

  const toggleFullscreen = window.Module?._PPSSPP_ToggleFullscreen;
  if (typeof toggleFullscreen !== "function") {
    log("Fullscreen toggle requested before PPSSPP runtime is ready.", "warn");
    return;
  }
  toggleFullscreen();
  scheduleRuntimeResize(true);
}

on(fullscreenBtn, "click", async () => {
  await togglePPSSPPFullscreen();
  canvas?.focus();
  describeAudio();
});

/* ── Init ───────────────────────────────────────────────────────── */
log("Page loaded. crossOriginIsolated=" + window.crossOriginIsolated, window.crossOriginIsolated ? "ok" : "warn");
log("Build: " + BUILD_STAMP, "dim");
probeWebGLFeatures();
updateInfoPanel();
refreshLibrary();
updateStorageInfo();    // populate OPFS tab with stats on load
refreshSavesTab();      // populate Saves tab from OPFS on load (no FS needed)

/* ── PWA: Service Worker registration ──────────────────────────── */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => reloadForCrossOriginIsolation("controllerchange"));
  navigator.serviceWorker.register("sw.js", { scope: "./" })
    .then(reg => {
      log("SW registered (scope: " + reg.scope + ")", "ok");
      if (navigator.serviceWorker.controller && !window.crossOriginIsolated) {
        reloadForCrossOriginIsolation("existing controller");
      }
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            showToast("🔄 Update available – reload to apply", 6000);
          }
        });
      });
    })
    .catch(err => log("SW registration failed: " + err.message, "warn"));
}
