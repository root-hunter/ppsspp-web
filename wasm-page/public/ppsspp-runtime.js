/*
 * Copyright (c) 2026 Antonio Ricciardi
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

// Some privacy modes throw even when reading localStorage. Preferences are
// optional; keep the emulator usable for the current tab when storage is denied.
const preferences = (() => {
  const fallback = new Map();
  return {
    getItem(key) { if (fallback.has(key)) return fallback.get(key); try { return localStorage.getItem(key); } catch (_) { return null; } },
    setItem(key, value) { fallback.set(key, String(value)); try { localStorage.setItem(key, String(value)); } catch (_) {} },
    removeItem(key) { fallback.set(key, null); try { localStorage.removeItem(key); } catch (_) {} },
  };
})();

/* ── Constants ──────────────────────────────────────────────────── */
let BUILD_DIR          = "build-wasm/";
let BUILD_STAMP        = String(Date.now());
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
let OPFS_PERSIST_DIR      = "persist";
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

function configureEmulatorKeyboard(env) {
  // SDL otherwise listens on window and prevents the form's default key actions.
  env.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT = "#canvas";
}

function syncViewportAfterFocus() {
  syncViewportSize({ reset: false });
  setTimeout(() => {
    syncViewportSize({ reset: false });
  }, 260);
}

function revealPanelInput() {
  const input = document.activeElement;
  const scroller = input?.closest?.("#sidePanel .tab-panel.active");
  if (!scroller || !isTextEntryActive()) return;
  const field = input.getBoundingClientRect();
  const bounds = scroller.getBoundingClientRect();
  // Scroll only the section: scrolling the page can pan the viewport on iOS.
  if (field.bottom > bounds.bottom - 16) {
    scroller.scrollTop += field.bottom - bounds.bottom + 16;
  } else if (field.top < bounds.top + 16) {
    scroller.scrollTop += field.top - bounds.top - 16;
  }
}

function syncViewportSize(options = {}) {
  const reset = options?.reset === true;
  const vv = window.visualViewport;
  const activeFullscreen = !!fullscreenElement() || document.body.classList.contains("immersive-fullscreen");
  const visualWidth = Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 0);
  const visualHeight = Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 0);
  const layoutWidth = Math.round(window.innerWidth || document.documentElement.clientWidth || visualWidth);
  const layoutHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || visualHeight);
  const width = activeFullscreen ? Math.max(1, layoutWidth || visualWidth) : Math.max(1, visualWidth || layoutWidth);
  // The keyboard can make a portrait visual viewport wider than it is tall.
  const orientation = window.screen?.orientation?.type?.split("-")[0]
    || viewportOrientation(layoutWidth, stableViewportHeight || layoutHeight);
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
  document.documentElement.style.setProperty("--visual-top", Math.max(0, vv?.offsetTop || 0) + "px");
  document.documentElement.style.setProperty("--visual-left", Math.max(0, vv?.offsetLeft || 0) + "px");
  revealPanelInput();
}

function syncFullscreenOverlays() {
  const activeFullscreen = !!fullscreenElement() || document.body.classList.contains("immersive-fullscreen");
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
window.visualViewport?.addEventListener("resize", () => syncViewportSize({ reset: false }), { passive: true });
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
    try { return !!(await caches.match(new URL(dir + name, location.href).href, { ignoreSearch: true })); }
    catch (_) { return false; }
  }
}

async function selectBuildDir() {
  let packagedRevision = "";
  try {
    const response = await fetch("build-info.json", { cache: "no-store" });
    if (response.ok) {
      const info = await response.json();
      if (/^[a-f0-9]{64}$/.test(info.revision)) packagedRevision = info.revision;
    }
  } catch (_) { /* Development servers may not publish build metadata. */ }
  // A packaged revision describes build-wasm only. Never mix it with a local
  // release directory that may contain an older, incompatible core.
  const dirs = packagedRevision ? ["build-wasm/"] : ["build-wasm-release/", "build-wasm/"];
  if (packagedRevision) BUILD_STAMP = packagedRevision;
  for (const dir of dirs) {
    const available = await Promise.all(["PPSSPPSDL.js", "PPSSPPSDL.wasm", "PPSSPPSDL.data"].map(name => hasBuildFile(dir, name)));
    if (!available.every(Boolean)) continue;
    setBuildDir(dir);
    log("Using emulator build: " + BUILD_DIR, "ok");
    return;
  }
  throw new Error("Emulator files are missing. Build/publish PPSSPPSDL.js, .wasm and .data together.");
}

/* ── DOM refs ───────────────────────────────────────────────────── */
/* ── Lucide SVG helper (for dynamically injected HTML) ──────────── */
const LUCIDE_PATHS = {
  refresh: '<path d="M3 11a9 9 0 0 1 15.7-5.7L21 8M21 3v5h-5M21 13a9 9 0 0 1-15.7 5.7L3 16M8 16H3v5"/>',
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
  .forEach(input => { input.accept = GAME_FILE_ACCEPT + (input.id === "libraryImportFile" ? ",.zip" : ""); });
const progressBar     = byId("progressBar");
const fpsBadge        = byId("fpsBadge");
const gpuBadge        = byId("gpuBadge");
const gamepadBadge    = byId("gamepadBadge");
const gamepadSelect   = byId("gamepadSelect");
const gpuSelectEl     = byId("gpuSelect");
const panelToggleBtn  = byId("panelToggleBtn");
const googleClientIdInput = byId("googleClientIdInput");
const driveAuthEl     = byId("iDriveAuth");
const driveFolderEl   = byId("iDriveFolder");
const driveRemoteEl   = byId("iDriveRemote");
const driveActivityEl = byId("driveActivity");
const driveRemoteList = byId("driveRemoteList");
const driveBadgeEl    = byId("driveBadge");
const driveBadgeText  = byId("driveBadgeText");
let networkSessionKey = "";
const networkEnableToggle = byId("networkEnableToggle");
const networkServerInput  = byId("networkServerInput");
const networkNickInput    = byId("networkNickInput");
const networkMacInput     = byId("networkMacInput");
let networkDraftDirty = false;
let networkLiveStatus = null;
let networkActiveConfig = null;
let networkProbe = { state: "unverified" };
const networkTestBtn      = byId("networkTestBtn");
const networkSaveBtn      = byId("networkSaveBtn");
const networkActivityEl   = byId("networkActivity");

let menuSuspended = false, menuResumeTimer = null, menuKeepaliveRelease = null;
let nativeMenuTimer = null;
const gameplayKeys = new Map();

function releaseGameplayKeyboard() {
  window.__ppssppReleasingKeys = true;
  try {
    for (const key of gameplayKeys.values()) canvas?.dispatchEvent(new KeyboardEvent("keyup", { ...key, bubbles: true }));
  } finally { gameplayKeys.clear(); window.__ppssppReleasingKeys = false; }
}
window.addEventListener("keydown", event => {
  if (!window.__ppssppRemoteKey && !document.body.classList.contains("panel-open") && document.activeElement === canvas && !["F1", "F11"].includes(event.key))
    gameplayKeys.set(event.code || event.key, { key: event.key, code: event.code, keyCode: event.keyCode, which: event.which, location: event.location });
}, true);
window.addEventListener("keyup", event => { if (!window.__ppssppRemoteKey) gameplayKeys.delete(event.code || event.key); }, true);

let sessionGameName = "", sessionArtworkURL = "", sessionArtworkVersion = 0;
function setSessionPresentation(name) {
  sessionGameName = name;
  const version = ++sessionArtworkVersion;
  const tile = [...(byId("libraryGrid")?.querySelectorAll(".collection-tile") || [])].find(tile => tile.dataset.game === name);
  const title = tile?.querySelector(".tile-title")?.textContent || (name ? prettyGameName(name) : "PPSSPP");
  const source = tile?.querySelector(".tile-art > img")?.getAttribute("src") || "";
  for (const id of ["sessionTitle", "launchTitle"]) { const el = byId(id); if (el) el.textContent = title; }
  for (const id of ["sessionArtwork", "launchArtworkImage"]) {
    const img = byId(id);
    if (img) { if (source) img.src = source; else img.removeAttribute("src"); img.hidden = !source; }
  }
  if (byId("launchArtwork")) byId("launchArtwork").hidden = !source;
  if (byId("sessionPreview")) { byId("sessionPreview").hidden = true; byId("sessionPreview").dataset.frameValid = ""; }
  if (byId("sessionPreviewFallback")) byId("sessionPreviewFallback").hidden = !!source;
  updateSessionDock();
  if (name) void refreshSessionArtwork(name, version);
}
async function refreshSessionArtwork(name, version) {
  try {
    const meta = await ensureGameMetadata(name);
    const source = await readGameCoverURL(name, meta.coverType);
    if (version !== sessionArtworkVersion) { if (source) URL.revokeObjectURL(source); return; }
    if (sessionArtworkURL) URL.revokeObjectURL(sessionArtworkURL);
    sessionArtworkURL = source;
    if (meta.title) for (const id of ["sessionTitle", "launchTitle"]) { const el = byId(id); if (el) el.textContent = meta.title; }
    if (source) {
      const hasFrame = !byId("sessionPreview").hidden;
      for (const id of ["sessionArtwork", "launchArtworkImage"]) { const img = byId(id); if (img) { img.src = source; img.hidden = id === "sessionArtwork" && hasFrame; } }
      byId("sessionPreviewFallback").hidden = true;
      byId("launchArtwork").hidden = false;
    }
  } catch (_) { /* Keep the title and fallback while metadata is unavailable. */ }
}
function sessionGameFromBootLog(text) {
  const match = text.match(/\bBooted (\/games\/.+?)\.\.\./);
  if (!match) return "";
  const packagePath = match[1].match(/^\/games\/(.+)\.package\/EBOOT\.PBP$/i);
  return packagePath ? packagePath[1] + ".pbp" : match[1].split("/").pop();
}
function captureSessionPreview() {
  const preview = byId("sessionPreview"), fallback = byId("sessionPreviewFallback"), artwork = byId("sessionArtwork");
  if (!preview) return;
  let captured = preview.dataset.frameValid === "true";
  try {
    const scratch = preview._captureCanvas ||= document.createElement("canvas");
    scratch.width = preview.width; scratch.height = preview.height;
    const ctx = scratch.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, scratch.width, scratch.height);
    const pixels = ctx.getImageData(0, 0, scratch.width, scratch.height).data;
    let lit = 0;
    for (let i = 0; i < pixels.length; i += 16) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 36 && pixels[i + 3]) lit++;
    if (lit > scratch.width * scratch.height / 80) {
      preview.getContext("2d").drawImage(scratch, 0, 0);
      preview.dataset.frameValid = "true";
      captured = true;
    }
  } catch (_) { /* Keep the last rendered thumbnail when WebGL has discarded its buffer. */ }
  preview.hidden = !captured;
  if (artwork) artwork.hidden = captured || !artwork.getAttribute("src");
  if (fallback) fallback.hidden = captured || !!artwork?.getAttribute("src");
}
let sessionPreviewCapturedAt = 0;
function cacheSessionPreview(now = performance.now()) {
  if (!runtimeReady || runtimeFailed || menuSuspended || document.hidden || document.body.classList.contains("panel-open") || now - sessionPreviewCapturedAt < 250) return;
  sessionPreviewCapturedAt = now;
  captureSessionPreview();
}
function sessionIsMultiplayer() { return !!window.__ppssppSharing || !!(networkActiveConfig || loadNetworkConfig()).enabled; }
function updateSessionDock() {
  const dock = byId("sessionDock");
  if (!dock) return;
  dock.hidden = !document.body.classList.contains("emulator-started");
  if (dock.hidden) return;
  const live = runtimeReady && !runtimeFailed && sessionIsMultiplayer();
  byId("sessionState").textContent = runtimeFailed ? "Session stopped" : !runtimeReady ? "Starting" : menuSuspended ? "Paused" : live ? "Multiplayer · live" : "Running";
  byId("sessionDetail").textContent = runtimeFailed ? "Open System for recovery options." : !runtimeReady ? "Preparing the emulator…" : menuSuspended ? "Kept in this tab. Resume to continue." : live ? "The session stays connected while you browse." : "The emulator is running in this tab.";
  byId("resumeSessionBtn").disabled = !runtimeReady || runtimeFailed;
  byId("sessionActionLabel").textContent = "Return to session";
  dock.dataset.state = runtimeFailed ? "stopped" : menuSuspended ? "paused" : live ? "live" : "running";
}
function suspendMenuAudio() {
  const sdl = window.Module?.SDL2?.audioContext || window.SDL2?.audioContext;
  const contexts = new Set([...trackedAudioContexts, ...(sdl ? [sdl] : [])]);
  for (const ctx of contexts) {
    if (ctx?.state !== "running" || typeof ctx.suspend !== "function") continue;
    Promise.resolve(ctx.suspend()).then(() => { if (!menuSuspended && !runtimeFailed) void unlockAudio(); }).catch(() => {});
  }
}
function syncMenuSuspension(open) {
  clearTimeout(menuResumeTimer); menuResumeTimer = null;
  if (!document.body.classList.contains("emulator-started")) return;
  if (open) {
    document.body.classList.remove("session-resuming");
    if (runtimeReady && !runtimeFailed) {
      if (!menuSuspended) captureSessionPreview();
      const keepalivePush = window.Module?.runtimeKeepalivePush || window.runtimeKeepalivePush;
      const keepalivePop = window.Module?.runtimeKeepalivePop || window.runtimeKeepalivePop;
      const canPause = typeof keepalivePush === "function" && typeof keepalivePop === "function" && !sessionIsMultiplayer() && typeof window.Module?.pauseMainLoop === "function" && typeof window.Module?.resumeMainLoop === "function";
      if (canPause && !menuSuspended) {
        try {
          // A paused loop releases its own keepalive on its next scheduled tick.
          // Hold a separate reference until resume installs the new scheduler.
          keepalivePush.call(window.Module);
          menuKeepaliveRelease = () => keepalivePop.call(window.Module);
          window.Module.pauseMainLoop(); menuSuspended = true;
          document.body.classList.add("session-suspended");
          suspendMenuAudio();
        } catch (error) { menuKeepaliveRelease?.(); menuKeepaliveRelease = null; log("Session pause unavailable: " + error.message, "warn"); }
      }
    }
    updateSessionDock();
    return;
  }
  if (!menuSuspended || runtimeFailed) { updateSessionDock(); return; }
  document.body.classList.add("session-resuming");
  const resume = () => {
    menuResumeTimer = null;
    if (document.body.classList.contains("panel-open") || runtimeFailed) return;
    try {
      window.Module.resumeMainLoop(); menuSuspended = false;
      menuKeepaliveRelease?.(); menuKeepaliveRelease = null;
      document.body.classList.remove("session-suspended", "session-resuming");
      void unlockAudio(); updateSessionDock();
    } catch (error) { failRuntime("Could not resume the emulator: " + error.message); setPanelOpen(true); }
  };
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("menu-motion-off")) resume();
  else menuResumeTimer = setTimeout(resume, 240);
}

// Escape is PPSSPP's native pause-menu shortcut. Delay delivery until a
// suspended loop resumes, and keep the web shell out of this key's path.
function openNativeMenu() {
  if (!runtimeReady || runtimeFailed) { showToast("Start the emulator to open its menu."); return; }
  releaseGameplayKeyboard();
  setFullscreenMenuOpen(false, false);
  setPanelOpen(false);
  clearTimeout(nativeMenuTimer);
  const deadline = performance.now() + 1500;
  const deliver = () => {
    nativeMenuTimer = null;
    if (runtimeFailed || document.body.classList.contains("panel-open")) return;
    if (menuSuspended) {
      if (performance.now() < deadline) nativeMenuTimer = setTimeout(deliver, 16);
      return;
    }
    canvas.focus({ preventScroll: true });
    const sendKey = type => {
      window.__ppssppNativeMenuKey = true;
      try { canvas.dispatchEvent(new KeyboardEvent(type, { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true })); }
      finally { window.__ppssppNativeMenuKey = false; }
    };
    sendKey("keydown");
    // Release even if the web menu opens in the meantime.
    setTimeout(() => {
      window.__ppssppReleasingKeys = true;
      try { sendKey("keyup"); } finally { window.__ppssppReleasingKeys = false; }
    }, 32);
  };
  deliver();
}

// Full-screen console dashboard; retain legacy IDs for runtime integrations.
function setPanelOpen(open, focus = true) {
  if (!open && !document.body.classList.contains("emulator-started")) open = true;
  if (open) { clearTimeout(nativeMenuTimer); nativeMenuTimer = null; releaseGameplayKeyboard(); }
  document.body.classList.toggle("panel-open", open);
  const dashboard = byId("sidePanel");
  if (dashboard) { dashboard.inert = !open; dashboard.setAttribute("aria-hidden", String(!open)); }
  syncMenuSuspension(open);
  if (open) setFullscreenMenuOpen(false, false);
  const stage = document.querySelector(".stage");
  if (stage) stage.inert = open;
  if (open) checkNetworkWhenVisible();
  document.dispatchEvent(new CustomEvent("consolevisibilitychange", { detail: { open } }));
  for (const id of ["panelToggleBtn", "fsPanelBtn"]) byId(id)?.setAttribute("aria-expanded", String(open));
  if (focus) {
    const target = open ? !byId("sessionDock")?.hidden && !byId("resumeSessionBtn")?.disabled ? byId("resumeSessionBtn") : document.querySelector(".tab.active") : document.body.classList.contains("emulator-started") ? canvas : panelToggleBtn;
    target?.focus({ preventScroll: true });
  }
  if (panelToggleBtn) {
    const label = open ? "Return to game" : "Game menu";
    panelToggleBtn.setAttribute("aria-label", label);
    panelToggleBtn.title = label;
    const text = panelToggleBtn.querySelector(".btn-lbl");
    if (text) text.textContent = label;
  }
}
// Each visit starts at the dashboard on every device.
setPanelOpen(true, false);
on("resumeSessionBtn", "click", () => setPanelOpen(false));
on(panelToggleBtn, "click", () => {
  setPanelOpen(!document.body.classList.contains("panel-open"));
});


importNetworkInvite();
updateNetworkConfigUI();
window.PPSSPPNetworkInvites = {
  create(includeKey = false) {
    const cfg = saveNetworkConfigFromUI();
    const url = new URL(location.href);
    url.search = "";
    url.hash = new URLSearchParams({ relay: cfg.server, room: cfg.room,
      ...(includeKey && cfg.sessionKey ? { session_key: cfg.sessionKey } : {}) }).toString();
    return url.href;
  },
  import(value) {
    const url = new URL(value.trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || value.length > 8192) throw new Error("Invalid invitation URL");
    importNetworkInvite(url.hash, true);
    networkProbe = { state: "unverified" };
    updateNetworkConfigUI();
  },
};
byId("networkSettingsForm")?.addEventListener("submit", event => { event.preventDefault(); try { saveNetworkConfigFromUI(); } catch (e) { networkActivityEl.textContent = e.message; } });
byId("networkDisconnectBtn")?.addEventListener("click", () => {
  window.ppssppAdhocTransport?.disconnect();
  networkProbe = { state: "unverified" };
  renderNetworkStatus();
});
byId("networkReconnectBtn")?.addEventListener("click", () => {
  const reconnect = window.Module?._ppssppAdhocReconnect;
  const result = reconnect ? reconnect() : -1;
  if (result === 0) { networkLiveStatus = { state: "connecting", peers: [] }; renderNetworkStatus(); }
  if (networkActivityEl) networkActivityEl.textContent = result === 0
    ? "Core reconnect requested. Rejoin a session using the game's multiplayer menu."
    : "Enter the game's multiplayer menu first. Reconnect requires the updated WASM core.";
});
networkEnableToggle?.addEventListener("change", () => { networkDraftDirty = true; networkActivityEl.textContent = "Unsaved changes."; });
networkTestBtn?.addEventListener("click", testNetworkRelay);
for (const id of ["networkServerInput", "networkRoomInput", "networkSessionKeyInput", "networkNickInput", "networkMacInput", "networkTransportInput"]) {
  byId(id)?.addEventListener("input", () => {
    networkDraftDirty = true;
    networkProbe = { state: "unverified" };
    renderNetworkStatus();
    if (networkActivityEl) networkActivityEl.textContent = "Unsaved changes. Save settings to apply them; restart PPSSPP if already running.";
  });
}
window.addEventListener("offline", renderNetworkStatus);
window.addEventListener("online", () => { networkProbe = { state: "unverified" }; renderNetworkStatus(); checkNetworkWhenVisible(); });
setInterval(checkNetworkWhenVisible, 30000);

/* ── State ──────────────────────────────────────────────────────── */
let selectedGame = null;
let selectedStoredGame = null;
let started      = false;
let runtimeReady = false;
let runtimeFailed = false;
const trackedAudioContexts = [];
const audioDebug = {
  callbacks: 0, nonsilent: 0, peak: 0, rate: 0, deviceStarted: false,
  pushes: 0, pushNonsilent: 0, pushPeak: 0,
  workletPeak: 0, workletTotal: 0, ringDropped: 0, underruns: 0, fallbackPeak: 0, fallbackDropped: 0,
};

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
    startBtn.innerHTML = `${svgIcon("play")}<span class="btn-lbl"> ${mode === "loading" ? "Starting…" : "Start emulator"}</span>`;
  } else {
    startBtn.disabled = false;
    startBtn.style.display = "";
    startBtn.title = "Launch PPSSPP";
    startBtn.innerHTML = `${svgIcon("play")}<span class="btn-lbl"> ${mode === "loading" ? "Starting…" : "Start emulator"}</span>`;
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

async function writeOpfsHandle(handle, data) {
  const writable = await handle.createWritable();
  try {
    await writable.write(data);
    await writable.close();
  } catch (error) {
    try { await writable.abort(); } catch (_) {}
    throw error;
  }
}

async function opfsPut(path, data) {
  const { dir, name } = await opfsParent(path, true);
  const handle = await dir.getFileHandle(name, { create: true });
  await writeOpfsHandle(handle, data);
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
  await textureOperation(async root => { for await (const [name] of root.entries()) await root.removeEntry(name, { recursive: true }); });
  try { await root.removeEntry(OPFS_PERSIST_DIR, { recursive: true }); } catch(e) {}
  try { await root.removeEntry(OPFS_GAMES_DIR, { recursive: true }); } catch(e) {}
  try { await root.removeEntry(OPFS_GAME_META_DIR, { recursive: true }); } catch(e) {}
  preferences.removeItem(PRELOAD_FAVORITES_KEY);
  preferences.removeItem(PRELOAD_FAVORITES_MIGRATED_KEY);
  await root.getDirectoryHandle(OPFS_PERSIST_DIR, { create: true });
  await root.getDirectoryHandle(OPFS_GAMES_DIR, { create: true });
  await root.getDirectoryHandle(OPFS_GAME_META_DIR, { create: true });
}

async function opfsWalk(base = OPFS_PERSIST_DIR, prefix = "", includeData = true) {
  const files = [];
  let dir;
  try { dir = await opfsDir([base, ...opfsPathParts(prefix)], false); }
  catch(e) { if (e.name === "NotFoundError") return files; throw e; }

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
  await writeOpfsHandle(handle, data);
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
  const root = await opfsRoot();
  const meta = await root.getDirectoryHandle(OPFS_GAME_META_DIR, { create: true });
  for (const entry of [name + ".files", name + ".package.json"]) {
    try { await meta.removeEntry(entry, { recursive: true }); } catch (_) {}
  }
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
function fsStatDir(FS, root, excludeTextures = false) {
  const stats = new Map(); // path → {size, mtime}
  function walk(dir) {
    let entries; try { entries = FS.readdir(dir); } catch(e) { return; }
    for (const name of entries) {
      if (name === "." || name === "..") continue;
      const full = dir + "/" + name;
      if (excludeTextures && full === root + "/PSP/TEXTURES") continue;
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

function parsePsfString(data, field) {
  if (!data || data.byteLength < 20) return "";
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== 0x46535000) return "";
  const keyTable = view.getUint32(8, true), dataTable = view.getUint32(12, true);
  const count = view.getUint32(16, true), decoder = new TextDecoder();
  if (count > 4096 || 20 + count * 16 > data.byteLength || keyTable >= data.byteLength || dataTable >= data.byteLength) return "";
  for (let i = 0; i < count; i++) {
    const off = 20 + i * 16;
    const start = keyTable + view.getUint16(off, true);
    if (start >= data.byteLength) continue;
    let end = start;
    while (end < data.byteLength && data[end] !== 0) end++;
    if (decoder.decode(data.subarray(start, end)) !== field) continue;
    const pos = dataTable + view.getUint32(off + 12, true), length = view.getUint32(off + 4, true);
    if (length > 65536 || pos + length > data.byteLength) return "";
    return decoder.decode(data.subarray(pos, pos + length)).replace(/\0+$/g, "").trim();
  }
  return "";
}

function parsePsfTitle(data) { return parsePsfString(data, "TITLE"); }

function extractIsoMetadata(name, data) {
  const meta = {
    fileName: name,
    title: prettyGameName(name),
    format: (name.split(".").pop() || "").toUpperCase(),
    coverBytes: null,
    coverType: "",
    discId: "",
  };
  if (!/\.iso$/i.test(name)) return meta;

  try {
    const sfo = isoFindEntry(data, "PSP_GAME/PARAM.SFO");
    const title = parsePsfTitle(sfo);
    meta.discId = parsePsfString(sfo, "DISC_ID");
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
  await writeOpfsHandle(handle, data);
}

async function opfsMetaRead(path) {
  const { dir, name } = await opfsParent(path, false, OPFS_GAME_META_DIR);
  const handle = await dir.getFileHandle(name);
  return new Uint8Array(await (await handle.getFile()).arrayBuffer());
}

async function isoFindBlobEntry(blob, wantedPath) {
  const read = async (offset, size) => {
    if (size > 8 * 1024 * 1024 || offset < 0 || offset + size > blob.size) throw new Error("Invalid ISO extent");
    return new Uint8Array(await blob.slice(offset, offset + size).arrayBuffer());
  };
  const pvd = await read(16 * 2048, 2048);
  if (pvd[0] !== 1 || new TextDecoder().decode(pvd.subarray(1, 6)) !== "CD001") return null;
  let entry = readIsoDirRecord(new DataView(pvd.buffer), 156);
  const parts = wantedPath.toUpperCase().split("/").filter(Boolean);
  for (let depth = 0; depth < parts.length; depth++) {
    if (!entry || !(entry.flags & 2)) return null;
    const bytes = await read(entry.extent * 2048, entry.size);
    const view = new DataView(bytes.buffer);
    let found = null;
    for (let off = 0; off < bytes.length;) {
      const len = bytes[off];
      if (!len) { off = (Math.floor(off / 2048) + 1) * 2048; continue; }
      if (len < 34 || off + len > bytes.length || bytes[off + 32] > len - 33) return null;
      const rec = readIsoDirRecord(view, off);
      if (rec.name.toUpperCase() === parts[depth]) { found = rec; break; }
      off += len;
    }
    if (!found) return null;
    entry = found;
  }
  return entry ? read(entry.extent * 2048, entry.size) : null;
}

async function extractPbpMetadata(name, data) {
  const meta = extractIsoMetadata(name, null);
  const length = data instanceof Blob ? data.size : data?.byteLength || 0;
  if (length < 40) return meta;
  const read = async (start, end) => data instanceof Blob ? new Uint8Array(await data.slice(start, end).arrayBuffer()) : data.slice(start, end);
  const header = await read(0, 40), view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  if (view.getUint32(0, true) !== 0x50425000) return meta;
  const offsets = Array.from({ length: 8 }, (_, index) => view.getUint32(8 + index * 4, true));
  if (offsets.some((offset, index) => offset < 40 || offset > length || (index > 0 && offset < offsets[index - 1]))) return meta;
  if (offsets[1] - offsets[0] <= 1024 * 1024) {
    const sfo = await read(offsets[0], offsets[1]);
    meta.title = parsePsfTitle(sfo) || meta.title;
    meta.discId = parsePsfString(sfo, "DISC_ID");
  }
  const iconSize = offsets[2] - offsets[1];
  if (iconSize > 0 && iconSize <= 8 * 1024 * 1024) {
    meta.coverBytes = await read(offsets[1], offsets[2]);
    meta.coverType = "image/png";
  }
  return meta;
}

async function extractGameMetadata(name, data) {
  if (/\.pbp$/i.test(name)) { try { return await extractPbpMetadata(name, data); } catch (_) { return extractIsoMetadata(name, null); } }
  if (!(data instanceof Blob)) return extractIsoMetadata(name, data);
  const meta = extractIsoMetadata(name, null);
  if (!/\.iso$/i.test(name)) return meta;
  try {
    const sfo = await isoFindBlobEntry(data, "PSP_GAME/PARAM.SFO");
    const title = parsePsfTitle(sfo);
    meta.discId = parsePsfString(sfo, "DISC_ID");
    if (title) meta.title = title;
    const cover = await isoFindBlobEntry(data, "PSP_GAME/ICON0.PNG");
    if (cover?.length) { meta.coverBytes = cover; meta.coverType = "image/png"; }
  } catch (_) { /* Invalid/unsupported metadata must not prevent playing. */ }
  return meta;
}

async function writeGameMetadata(name, data) {
  const meta = await extractGameMetadata(name, data);
  const json = {
    schemaVersion: 2,
    fileName: meta.fileName,
    discId: meta.discId,
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

async function confirmUI(message) {
  return window.PPSSPPConsole?.confirm ? window.PPSSPPConsole.confirm(message) : confirm(message);
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
  if (!await confirmUI("Delete from OPFS:\n" + path.split("/").pop() + "?")) return;
  try { await opfsDelete(path); } catch(e) {}
  if (window.FS) { try { window.FS.unlink(path); } catch(e) {} }
  showToast("🗑 Deleted " + path.split("/").pop());
  updateStorageInfo(); refreshSavesTab();
}

async function updateStorageInfo() {
  try {
    void refreshTexturePacks();
    const entries = await opfsWalk(OPFS_PERSIST_DIR, "", false);
    const games   = await opfsWalk(OPFS_GAMES_DIR, "", false);
    const allFiles = [...entries, ...games.map(g => ({ ...g, path: VIRTUAL_GAME_DIR + "/" + g.path }))];
    const texturePacks = await textureOperation(root => window.PPSSPPTextures.list(root));
    const textureBytes = texturePacks.reduce((n, pack) => n + pack.bytes, 0);
    const textureFiles = texturePacks.reduce((n, pack) => n + pack.files.length, 0);
    const bytes   = textureBytes + allFiles.reduce((s, e) => s + (e.data?.byteLength || e.size || 0), 0);
    const el = id => document.getElementById(id);
    el("iStorageFiles").textContent = String(allFiles.length + textureFiles);
    el("iStorageFiles").className   = allFiles.length + textureFiles ? "info-val good" : "info-val";
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
            html += `<button title="Download" data-storage-action="download" data-path="${esc(path)}">${svgIcon("download")}</button>`;
            html += `<button class="del" title="Delete" data-storage-action="delete" data-path="${esc(path)}">${svgIcon("trash")}</button>`;
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
    if (!await confirmUI("Delete game file from OPFS:\n" + name + "?")) return;
    try {
      await opfsDeleteGame(name);
      if (window.FS) {
        try { window.FS.unlink(path); } catch(e) {}
        const packageDir = VIRTUAL_GAME_DIR + "/" + name.replace(/\.[^.]+$/, "") + ".package";
        for (const file of fsStatDir(window.FS, packageDir).keys()) { try { window.FS.unlink(file); } catch (_) {} }
      }
      setPreloadFavorite(name, false);
      refreshEmulatorGameBrowser("deleted " + name);
      showToast("🗑 Deleted " + name);
      await refreshLibrary();
      updateStorageInfo();
      return true;
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
    if (!await mountStoredGamePackage(FS, name)) FS.writeFile(path, await opfsReadGame(name), { canOwn: true });
    log("Mounted stored game file from OPFS: " + path, "ok");
    refreshEmulatorGameBrowser("mounted " + name);
    showToast("✓ " + name + " mounted");
    refreshLibrary();
    setPanelOpen(false);
  } catch(e) {
    log("Stored game mount failed: " + e.message, "err");
    showToast("❌ " + e.message);
  }
}

let gameInfoReturnFocus = null, gameInfoCoverURL = "";
async function showGameInfo(name) {
  gameInfoReturnFocus = document.activeElement;
  try {
    const meta = await ensureGameMetadata(name);
    const stat = (await opfsWalk(OPFS_GAMES_DIR, "", false)).find(g => g.path === name);
    const packagePath = VIRTUAL_GAME_DIR + "/" + name.replace(/\.[^.]+$/, "") + ".package/EBOOT.PBP";
    const mounted = !!(window.FS?.analyzePath?.(VIRTUAL_GAME_DIR + "/" + name).exists || window.FS?.analyzePath?.(packagePath).exists);
    const preloads = isPreloadFavorite(name);
    const title = meta.title || prettyGameName(name);
    const cover = await readGameCoverURL(name, meta.coverType);
    if (gameInfoCoverURL) URL.revokeObjectURL(gameInfoCoverURL);
    gameInfoCoverURL = cover;

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
      : gamePlaceholder();
    rowsEl.innerHTML = [
      ["File", name], ["Format", meta.format || "PSP"], ["Size", formatBytes(stat?.size || 0)],
      ...(meta.discId ? [["Game ID", meta.discId]] : []),
    ].map(([k, v]) => `<div class="game-info-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("");
    const options = modalEl.querySelector(".game-options");
    if (options) options.open = false;
    byId("gameInfoDeleteBtn").onclick = async () => { if (await deleteStoredFile(VIRTUAL_GAME_DIR + "/" + name)) closeGameInfo(); };
    byId("gameInfoUploadBtn").onclick = () => runDriveAction("upload-game", () => uploadSingleGameToDrive(name));

    const favoriteBtn = byId("gameInfoFavoriteBtn");
    if (favoriteBtn) {
      favoriteBtn.innerHTML = `${svgIcon("preload")} ${preloads ? "Disable startup preload" : "Preload at startup"}`;
      favoriteBtn.classList.toggle("active", preloads);
      favoriteBtn.setAttribute("aria-pressed", preloads ? "true" : "false");
      favoriteBtn.onclick = async () => {
        closeGameInfo();
        await togglePreloadFavorite(name);
      };
    }

    const playBtn = byId("gameInfoPlayBtn");
    if (playBtn) {
      playBtn.textContent = started ? (mounted ? "Return to emulator" : "Load in emulator") : "Play";
      playBtn.disabled = false;
      playBtn.onclick = () => {
        closeGameInfo();
        if (started && mounted) setPanelOpen(false);
        else playOrMountStoredGame(name);
      };
    }
    modalEl.dataset.gameName = name;
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
  const replacement = [...byId("libraryGrid").querySelectorAll(".collection-tile")].find(tile => tile.dataset.game === modal.dataset.gameName) || byId("libraryGrid").querySelector(".collection-tile:not([hidden])");
  (gameInfoReturnFocus?.isConnected ? gameInfoReturnFocus : replacement || document.querySelector('.tab[data-tab="library"]'))?.focus({ preventScroll: true });
  delete modal.dataset.gameName;
  gameInfoReturnFocus = null;
  if (gameInfoCoverURL) URL.revokeObjectURL(gameInfoCoverURL);
  gameInfoCoverURL = "";
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
    const parsed = JSON.parse(preferences.getItem(PRELOAD_FAVORITES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(name => typeof name === "string" && name) : [];
  } catch(e) {
    return [];
  }
}

function savePreloadFavorites(names) {
  const unique = [...new Set(names.filter(name => typeof name === "string" && name))].sort((a, b) => a.localeCompare(b));
  preferences.setItem(PRELOAD_FAVORITES_KEY, JSON.stringify(unique));
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

function ensurePreloadFavoritesMigrated() {
  preferences.setItem(PRELOAD_FAVORITES_MIGRATED_KEY, "1");
  preferences.setItem(PRELOAD_DEFAULTS_APPLIED_KEY, "1");
  return loadPreloadFavorites();
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
  if (meta.updated && meta.schemaVersion === 2) return meta;
  try {
    const file = await opfsGetGameFile(name);
    await writeGameMetadata(name, file);
    return await readGameMetadata(name);
  } catch(e) {
    return meta;
  }
}

let libraryRenderVersion = 0, libraryPageRenderVersion = 0, libraryPage = 1;
let libraryRecords = [], libraryPages = 1;
function gamePlaceholder() { return '<span class="game-placeholder"><img src="images/ppsspp-icon.png" alt=""><span>PSP</span></span>'; }
function replaceCollectionContent(container, html) {
  const key = container.contains(document.activeElement) ? document.activeElement.closest("[data-focus-key]")?.dataset.focusKey : null;
  container.innerHTML = html;
  if (key) [...container.querySelectorAll("[data-focus-key]")].find(el => el.dataset.focusKey === key)?.focus({ preventScroll: true });
}
function filterCollection(kind) {
  if (kind === "library") { libraryPage = 1; void renderLibraryPage(); return; }
  const container = byId("savesList");
  const query = (byId("savesSearch")?.value || "").toLocaleLowerCase().trim();
  let visible = 0;
  for (const tile of container?.querySelectorAll(".collection-tile") || []) {
    tile.hidden = !tile.dataset.search.includes(query);
    if (!tile.hidden) visible++;
  }
  const empty = byId("savesEmpty");
  const total = container?.querySelectorAll(".collection-tile").length || 0;
  if (total) { empty.style.display = visible ? "none" : "block"; empty.textContent = "No results for “" + query + "”."; }
  const selection = byId("savesSelection");
  if (selection) selection.textContent = "";
}
async function renderLibraryPage() {
  const grid = byId("libraryGrid"), empty = byId("libraryEmpty");
  if (!grid || !empty) return;
  const version = ++libraryPageRenderVersion, urls = [];
  const query = (byId("librarySearch")?.value || "").toLocaleLowerCase().trim();
  const sort = byId("librarySort")?.value;
  const matches = libraryRecords.filter(g => (g.title + " " + g.path).toLocaleLowerCase().includes(query));
  matches.sort((a, b) => sort === "size" ? b.size - a.size || a.title.localeCompare(b.title) : (sort === "title-desc" ? -1 : 1) * a.title.localeCompare(b.title));
  const page = window.PPSSPPDemos.paginate(matches, libraryPage);
  libraryPage = page.page; libraryPages = page.pages;
  grid.setAttribute("aria-busy", "true");
  try {
    const records = await Promise.all(page.records.map(async game => {
      const cover = await readGameCoverURL(game.path, game.coverType);
      if (cover) urls.push(cover);
      return { ...game, cover };
    }));
    if (version !== libraryPageRenderVersion) { urls.forEach(url => URL.revokeObjectURL(url)); return; }
    replaceCollectionContent(grid, records.map(game => {
      const title = esc(game.title), name = esc(game.path);
      return `<button type="button" class="collection-tile" data-action="info" data-game="${name}" data-focus-key="${name}" data-search="${esc((game.title + " " + game.path).toLocaleLowerCase())}" data-description="${esc(game.title + " · " + game.format + " · " + formatBytes(game.size || 0))}" aria-label="Open ${title}">
        <span class="tile-art">${game.cover ? `<img src="${game.cover}" alt="" loading="lazy">` : gamePlaceholder()}${game.preload ? '<span class="tile-tag">Preload</span>' : ''}</span>
        <span class="tile-body"><span class="tile-title">${title}</span><span class="tile-meta">${esc(game.format)} · ${formatBytes(game.size || 0)}</span></span>
      </button>`;
    }).join(""));
    clearLibraryCoverURLs(); _libraryCoverURLs = urls;
    grid.style.display = records.length ? "grid" : "none";
    empty.style.display = records.length ? "none" : "block";
    empty.textContent = libraryRecords.length ? "No results for “" + query + "”." : "No games. Add a PSP game or ZIP, or browse the demos below.";
    byId("libraryPagination").hidden = page.pages < 2;
    byId("libraryPrevBtn").disabled = page.page <= 1;
    byId("libraryNextBtn").disabled = page.page >= page.pages;
    byId("libraryPageLabel").textContent = "Page " + page.page + " of " + page.pages + " · " + page.first + "–" + page.last + " of " + page.total;
    byId("librarySelection").textContent = "";
    updateCollectionPageStatus();
  } catch (e) {
    urls.forEach(url => URL.revokeObjectURL(url));
    if (version === libraryPageRenderVersion) { empty.style.display = "block"; empty.textContent = "Could not display games: " + e.message; }
  } finally { if (version === libraryPageRenderVersion) grid.removeAttribute("aria-busy"); }
}
async function refreshLibrary() {
  const grid = byId("libraryGrid"), empty = byId("libraryEmpty"), count = byId("libraryCount");
  if (!grid || !empty) return;
  const version = ++libraryRenderVersion;
  ++libraryPageRenderVersion;
  grid.setAttribute("aria-busy", "true");
  if (!grid.children.length) { empty.style.display = "block"; empty.textContent = "Loading games…"; }
  try {
    const games = await opfsWalk(OPFS_GAMES_DIR, "", false);
    demoInstalled = new Set(games.map(g => g.path));
    if (demoCatalog.length) renderDemos();
    const favorites = new Set(prunePreloadFavorites(games.map(game => game.path)));
    const records = [];
    for (const game of games) {
      if (version !== libraryRenderVersion) return;
      const meta = await ensureGameMetadata(game.path);
      records.push({ ...game, title: meta.title || prettyGameName(game.path), format: meta.format || "PSP", coverType: meta.coverType, preload: favorites.has(game.path) });
    }
    if (version !== libraryRenderVersion) return;
    libraryRecords = records;
    if (count) count.textContent = records.length + (records.length === 1 ? " game" : " games");
    await renderLibraryPage();
  } catch (e) { if (version === libraryRenderVersion) { empty.style.display = "block"; empty.textContent = "Could not read games: " + e.message; grid.removeAttribute("aria-busy"); } }
}
function collectionFocusIndex(grid) {
  const card = document.activeElement?.closest(".collection-tile, .demo-card");
  return Math.max(0, [...grid.querySelectorAll(".collection-tile, .demo-card")].indexOf(card));
}
function focusCollectionPage(grid, index) {
  const cards = [...grid.querySelectorAll(".collection-tile, .demo-card")];
  const card = cards[Math.min(index, cards.length - 1)];
  const target = card?.matches(".collection-tile") ? card : card?.querySelector("button:not(:disabled), a[href]");
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: "nearest", behavior: "instant" });
}
async function changeLibraryPage(delta) {
  const next = Math.min(libraryPages, Math.max(1, libraryPage + delta));
  if (next === libraryPage) return false;
  const grid = byId("libraryGrid"), index = collectionFocusIndex(grid);
  libraryPage = next;
  await renderLibraryPage();
  if (libraryPage === next) focusCollectionPage(grid, index);
  return true;
}
function activeCollectionKind() {
  const origin = document.activeElement;
  const viewport = byId("tabLibrary").getBoundingClientRect();
  const focused = origin?.getBoundingClientRect();
  const onScreen = focused && focused.bottom > viewport.top && focused.top < viewport.bottom;
  if (onScreen && origin.closest("#demoSection")) return "demo";
  if (onScreen && origin.closest("#libraryPanel")) return "library";
  const overlap = id => { const r = byId(id).getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, viewport.bottom) - Math.max(r.top, viewport.top)); };
  return overlap("demoSection") > overlap("libraryGrid") ? "demo" : "library";
}
function updateCollectionPageStatus() {
  const label = byId("controllerPageStatus");
  if (!label) return;
  const hint = label.parentElement;
  if (!byId("tabLibrary")?.classList.contains("active") || byId("gameInfoModal")?.classList.contains("visible") || byId("saveInfoModal")?.classList.contains("visible")) { hint.hidden = true; return; }
  const kind = activeCollectionKind(), demo = kind === "demo";
  const pages = demo ? demoPages : libraryPages, page = demo ? demoPage : libraryPage;
  hint.hidden = pages < 2;
  label.textContent = (demo ? "Demos " : "Games ") + page + " / " + pages;
}
function changeActiveCollectionPage(delta) {
  if (!byId("tabLibrary")?.classList.contains("active")) return false;
  return activeCollectionKind() === "demo" ? changeDemoPage(delta) : changeLibraryPage(delta);
}

/* Demo installs keep EBOOT companions together, outside the flat game index. */
async function installGameArchive(file, preferredName, onProgress = () => {}) {
  if (file.size > 512 * 1024 * 1024) throw new Error("ZIP exceeds 512 MB");
  const files = await window.PPSSPPDemos.unzip(new Uint8Array(await file.arrayBuffer()), event => onProgress({ phase: "extract", ...event }));
  const packages = window.PPSSPPDemos.packages(files, file.name);
  const names = [];
  const total = packages.reduce((sum, pkg) => sum + pkg.data.length + pkg.files.reduce((bytes, entry) => bytes + entry.data.length, 0), 0);
  let completed = 0;
  await onProgress({ phase: "install", completed, total });
  for (const pkg of packages) {
    const name = (packages.length === 1 && preferredName ? preferredName : pkg.name).replace(/[^a-zA-Z0-9._-]/g, "_");
    // Write companions and manifest before publishing the executable to the library.
    if (pkg.boot) {
      for (const entry of pkg.files) {
        await opfsMetaPut(name + ".files/" + entry.name, entry.data);
        completed += entry.data.length;
        await onProgress({ phase: "install", completed, total });
      }
      await opfsMetaPut(name + ".package.json", new TextEncoder().encode(JSON.stringify(pkg.files.map(f => f.name))));
    }
    await opfsPutGame(name, pkg.data);
    completed += pkg.data.length;
    await onProgress({ phase: "install", completed, total });
    names.push(name);
  }
  return names;
}

async function mountStoredGamePackage(FS, name) {
  let files;
  try { files = JSON.parse(new TextDecoder().decode(await opfsMetaRead(name + ".package.json"))); }
  catch (_) { return null; }
  const dir = VIRTUAL_GAME_DIR + "/" + name.replace(/\.[^.]+$/, "") + ".package";
  FS.mkdirTree(dir);
  for (const file of files) {
    window.PPSSPPDemos.safePath(file);
    const path = dir + "/" + file;
    FS.mkdirTree(path.slice(0, path.lastIndexOf("/")));
    FS.writeFile(path, await opfsMetaRead(name + ".files/" + file), { canOwn: true });
  }
  const path = dir + "/EBOOT.PBP";
  FS.writeFile(path, await opfsReadGame(name), { canOwn: true });
  return path;
}

let demoGateway = false;
let demoCatalog = [], demoInstalled = new Set(), demoAbort = null, demoBusy = false;
let demoPage = 1, demoPages = 1, demoInstalledOnly = false, demoCatalogState = "idle", demoTransfer = null;
function renderDemos() {
  const grid = byId("demoGrid");
  if (!grid) return;
  const query = byId("demoSearch")?.value || "", region = byId("demoRegion")?.value || "";
  const sort = byId("demoSort")?.value || "title";
  const result = window.PPSSPPDemos.browse(demoCatalog, demoInstalled, { query, region, sort, installedOnly: demoInstalledOnly, page: demoPage });
  demoPage = result.page; demoPages = result.pages;
  const installedCount = demoCatalog.filter(d => demoInstalled.has(d.name)).length;
  byId("demoTotalCount").textContent = demoCatalog.length || "—";
  byId("demoInstalledCount").textContent = installedCount;
  byId("demoAllBtn").setAttribute("aria-pressed", String(!demoInstalledOnly));
  byId("demoInstalledBtn").setAttribute("aria-pressed", String(demoInstalledOnly));
  byId("demoResetBtn").hidden = !query && !region && sort === "title" && !demoInstalledOnly;
  grid.setAttribute("aria-busy", String(demoCatalogState === "loading"));
  const empty = byId("demoEmpty");
  empty.hidden = result.total > 0 || demoCatalogState === "loading";
  const states = {
    idle: ["PSP demo archive", "Select Browse demos to load the catalog."],
    error: ["Catalog unavailable", "Select Retry catalog to reconnect."],
    ready: demoInstalledOnly && !query && !region
      ? ["No installed demos", "Install a demo from All demos."]
      : ["No demos found", "Try another title or region, or clear your filters to explore the full catalog."],
  };
  const emptyCopy = states[demoCatalogState] || states.idle;
  byId("demoEmptyTitle").textContent = emptyCopy[0];
  byId("demoEmptyDetail").textContent = emptyCopy[1];
  if (demoCatalogState === "loading" && !demoCatalog.length) {
    replaceCollectionContent(grid, Array.from({ length: 6 }, () => '<div class="demo-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>').join(""));
  } else {
    replaceCollectionContent(grid, result.records.map(d => {
      const installed = demoInstalled.has(d.name), active = demoBusy && demoTransfer?.url === d.url;
      const initials = d.title.split(/\s+/).slice(0, 2).map(word => [...word][0]).join("").toUpperCase();
      const tone = [...d.productCode].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 5;
      const action = installed ? "Open demo" : active ? "Installing…" : "Install demo";
      const controls = !installed && !demoGateway
        ? `<a class="btn primary" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer" data-focus-key="demo-${esc(d.productCode)}" aria-label="Download ${esc(d.title)} ZIP">${svgIcon("download")} Download ZIP</a><button type="button" data-demo-import aria-label="Import downloaded demo ZIP">Import ZIP</button>`
        : `<button type="button" class="${installed ? '' : 'primary'}" data-demo="${esc(d.url)}" data-focus-key="demo-${esc(d.productCode)}" aria-label="${installed ? 'Open' : 'Install'} ${esc(d.title)}" ${demoBusy && !installed ? 'disabled' : ''}>${svgIcon(installed ? "play" : "download")} ${action}</button><a class="demo-zip-link" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer" aria-label="Download ${esc(d.title)} ZIP">ZIP ${svgIcon("download")}</a>`;
      return `<article class="demo-card demo-tone-${tone} ${installed ? 'is-installed' : ''} ${active ? 'is-installing' : ''}" aria-labelledby="demo-title-${esc(d.productCode)}">
        <div class="demo-card-art" aria-hidden="true"><span class="demo-card-platform">PSP / DEMO</span><span class="demo-monogram">${esc(initials)}</span><span class="demo-card-orbit"></span></div>
        <div class="demo-card-content"><div class="demo-card-labels"><span class="demo-region">${esc(d.region)}</span><span class="demo-card-size">${formatBytes(d.fileSizeBytes || 0)}</span>${installed ? '<span class="demo-installed-label">✓ Installed</span>' : ''}${active ? '<span class="demo-installed-label">In progress</span>' : ''}</div>
        <h3 id="demo-title-${esc(d.productCode)}">${esc(d.title)}</h3><p class="demo-code">${esc(d.productCode)}</p>
        <div class="demo-card-actions">${controls}</div></div>
      </article>`;
    }).join(""));
  }
  updateCollectionPageStatus();
  byId("demoPagination").hidden = result.pages < 2;
  byId("demoPageLabel").textContent = "Page " + result.page + " of " + result.pages;
  byId("demoPrevBtn").disabled = result.page <= 1;
  byId("demoNextBtn").disabled = result.page >= result.pages;
  if (demoCatalogState === "ready") byId("demoStatus").textContent = result.total ? result.first + "–" + result.last + " of " + result.total + " demos" : "0 demos";
}
function filterDemos() { demoPage = 1; renderDemos(); }
function resetDemoFilters() {
  byId("demoSearch").value = ""; byId("demoRegion").value = ""; byId("demoSort").value = "title";
  demoInstalledOnly = false; filterDemos();
}
function changeDemoPage(delta) {
  const pages = window.PPSSPPDemos.browse(demoCatalog, demoInstalled, {
    query: byId("demoSearch")?.value, region: byId("demoRegion")?.value,
    sort: byId("demoSort")?.value, installedOnly: demoInstalledOnly,
  }).pages;
  const next = Math.min(pages, Math.max(1, demoPage + delta));
  if (next === demoPage) return false;
  const grid = byId("demoGrid"), index = collectionFocusIndex(grid);
  demoPage = next; renderDemos(); focusCollectionPage(grid, index);
  return true;
}
async function loadDemoCatalog() {
  const button = byId("demoLoadBtn");
  if (!button || button.disabled) return;
  button.disabled = true; demoCatalogState = "loading";
  byId("demoStatus").textContent = "Connecting to PlayDreamCreate…";
  renderDemos();
  try {
    const result = await window.PPSSPPDemos.loadCatalog({ staticHosting: /(^|\.)github\.io$/i.test(location.hostname) });
    demoCatalog = result.records;
    demoGateway = result.gateway;
    byId("demoFallback").hidden = demoGateway;
    demoInstalled = new Set((await opfsWalk(OPFS_GAMES_DIR, "", false)).map(g => g.path));
    demoCatalogState = "ready";
    button.innerHTML = svgIcon("refresh") + "<span>Refresh catalog</span>";
    button.setAttribute("aria-label", "Refresh demo catalog");
    button.title = "Refresh demo catalog";
    renderDemos();
  } catch (e) {
    demoCatalogState = demoCatalog.length ? "ready" : "error";
    renderDemos();
    byId("demoStatus").textContent = "Catalog unavailable. " + (demoCatalog.length ? "Showing the previous catalog. " : "") + "Please retry.";
    button.innerHTML = svgIcon("refresh") + "<span>Retry catalog</span>";
    button.setAttribute("aria-label", "Retry demo catalog");
    button.title = "Retry demo catalog";
  } finally { button.disabled = false; }
}
function demoTimeLabel(seconds) {
  if (seconds < 60) return seconds + "s";
  return Math.floor(seconds / 60) + "m " + (seconds % 60) + "s";
}
function updateDemoTransfer(patch = {}, announce = false) {
  if (!demoTransfer) return;
  if (patch.phase && ["download", "extract", "install"].includes(patch.phase)) demoTransfer.activePhase = patch.phase;
  Object.assign(demoTransfer, patch);
  const previousFocus = document.activeElement;
  const t = demoTransfer, terminal = ["ready", "error", "cancelled"].includes(t.phase);
  const labels = { download: "Downloading", extract: "Extracting & checking", install: "Installing", ready: "Ready to play", error: "Installation interrupted", cancelled: "Download cancelled" };
  const label = labels[t.phase];
  const panel = byId("demoTransfer"), progress = byId("demoProgress");
  panel.hidden = false; panel.dataset.state = t.phase;
  byId("demoTransferTitle").textContent = t.title;
  byId("demoTransferPhase").textContent = label;
  byId("demoTransferIcon").innerHTML = terminal ? (t.phase === "ready" ? "✓" : t.phase === "error" ? "!" : "−") : svgIcon(t.phase === "download" ? "download" : "preload");
  byId("demoTransferPercent").textContent = t.percent == null ? "" : t.percent + "%";
  progress.hidden = t.phase === "error" || t.phase === "cancelled";
  if (t.percent == null) progress.removeAttribute("value"); else progress.value = t.percent;
  progress.setAttribute("aria-label", label + ": " + t.title);
  progress.setAttribute("aria-valuetext", t.percent == null ? label : label + " " + t.percent + "%");
  byId("demoTransferDetail").textContent = t.detail || "";
  byId("demoBrowseBtn").hidden = false;
  byId("demoCancelBtn").hidden = t.phase !== "download";
  byId("demoCancelBtn").disabled = !!t.cancelling;
  byId("demoCancelBtn").textContent = t.cancelling ? "Cancelling…" : "Cancel";
  byId("demoRetryBtn").hidden = t.phase !== "error" && t.phase !== "cancelled";
  byId("demoOpenBtn").hidden = t.phase !== "ready";
  byId("demoDismissBtn").hidden = !terminal;
  byId("demoTransferZip").hidden = t.phase !== "error" || !t.url;
  if (t.url) byId("demoTransferZip").href = t.url;
  const badge = byId("demoActivityBtn");
  badge.hidden = false; badge.dataset.state = t.phase;
  byId("demoActivityText").textContent = t.phase === "ready" ? "Demo ready" : t.phase === "error" ? "Retry install" : t.phase === "cancelled" ? "Cancelled" : label + (t.percent == null ? "…" : " · " + t.percent + "%");
  badge.setAttribute("aria-label", label + ": " + t.title + ". Show installation details.");
  if ((panel.contains(previousFocus) && previousFocus.hidden) || (terminal && t.focusAfterCancel && previousFocus === document.body)) {
    (terminal ? (t.phase === "ready" ? byId("demoOpenBtn") : byId("demoRetryBtn")) : byId("demoBrowseBtn")).focus({ preventScroll: true });
  }
  if (announce) byId("demoAnnouncement").textContent = t.title + ": " + label + ". " + (t.detail || "");
}
function revealDemoTransfer() {
  activatePanelTab("library"); setPanelOpen(true);
  const target = demoTransfer ? byId("demoTransfer") : byId("demoSection");
  if (demoTransfer) target.open = true;
  target.scrollIntoView({ block: "nearest", behavior: "instant" });
  const action = !demoTransfer ? byId("demoLoadBtn") : demoTransfer.phase === "ready" ? byId("demoOpenBtn") : ["error", "cancelled"].includes(demoTransfer.phase) ? byId("demoRetryBtn") : byId("demoBrowseBtn");
  action?.focus({ preventScroll: true });
}
function dismissDemoTransfer() {
  if (demoBusy) return;
  const restore = byId("demoTransfer").contains(document.activeElement) || document.activeElement === byId("demoActivityBtn");
  byId("demoTransfer").hidden = true; byId("demoActivityBtn").hidden = true;
  demoTransfer = null;
  if (restore) byId("demoLoadBtn").focus({ preventScroll: true });
}
async function downloadDemo(url) {
  const demo = demoCatalog.find(d => d.url === url);
  if (!demo) return;
  if (demoInstalled.has(demo.name)) { await showGameInfo(demo.name); return; }
  if (demoBusy) return;
  demoBusy = true; demoAbort = new AbortController();
  demoTransfer = { title: demo.title, url, name: demo.name, phase: "download", activePhase: "download", percent: null };
  byId("demoFallback").hidden = true;
  updateDemoTransfer({ detail: "Connecting to the demo archive…" }, true);
  byId("demoTransfer").open = false;
  renderDemos();
  try {
    const archive = new URL(url).pathname.split("/").pop();
    const response = await window.PPSSPPDemos.download(url, { signal: demoAbort.signal, gateway: demoGateway });
    const total = Number(response.headers.get("content-length")) || 0;
    const reader = response.body.getReader(), chunks = []; let received = 0, lastUpdate = 0, announced = -1;
    const started = performance.now();
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      received += part.value.length;
      if (received > 512 * 1024 * 1024) { await reader.cancel(); throw new Error("Archive exceeds 512 MB"); }
      chunks.push(part.value);
      const now = performance.now();
      if (now - lastUpdate >= 150 || received === total) {
        const metrics = window.PPSSPPDemos.transferMetrics(received, total, started, now);
        const bucket = metrics.percent == null ? 0 : Math.floor(metrics.percent / 25);
        const detail = formatBytes(received) + (total ? " / " + formatBytes(total) : " downloaded") + (metrics.speed ? " · " + formatBytes(metrics.speed) + "/s" : "") + (metrics.remaining ? " · About " + demoTimeLabel(metrics.remaining) + " left" : "");
        updateDemoTransfer({ percent: metrics.percent, detail }, bucket !== announced);
        announced = bucket; lastUpdate = now;
      }
    }
    demoAbort.signal.throwIfAborted();
    if (total && received !== total) throw new Error("The download ended early. Please try again.");
    updateDemoTransfer({ phase: "extract", percent: null, detail: "Opening archive and checking its files…", hint: "The download is complete. Keep this tab open while the demo is installed." }, true);
    await new Promise(resolve => setTimeout(resolve, 0));
    let lastPaint = 0, phase = "extract";
    const names = await installGameArchive(new File(chunks, archive), demo.name, async event => {
      const changed = event.phase !== phase;
      const now = performance.now();
      if (!changed && now - lastPaint < 80 && event.completed !== event.total) return;
      const percent = event.total ? Math.min(100, Math.floor(event.completed / event.total * 100)) : null;
      updateDemoTransfer({ phase: event.phase, percent, detail: event.phase === "extract"
        ? "Unpacking & verifying · " + formatBytes(event.completed) + " / " + formatBytes(event.total)
        : "Saving to your library · " + formatBytes(event.completed) + " / " + formatBytes(event.total),
        hint: "Keep this tab open. Your game files are being prepared for PPSSPP." }, changed);
      phase = event.phase; lastPaint = now;
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    updateDemoTransfer({ phase: "install", percent: 100, detail: "Finishing library update…" });
    demoInstalled = new Set((await opfsWalk(OPFS_GAMES_DIR, "", false)).map(g => g.path));
    await refreshLibrary(); await updateStorageInfo();
    if (names.length === 1) demo.name = names[0];
    updateDemoTransfer({ phase: "ready", percent: 100, name: names[0], detail: "Installed and added to your library.", hint: "Open the demo to view its artwork and launch it in PPSSPP." }, true);

  } catch (e) {
    const cancelled = e.name === "AbortError";
    updateDemoTransfer({ phase: cancelled ? "cancelled" : "error", percent: null, detail: cancelled ? "No game was installed. You can start the download again anytime." : e.message,
      hint: cancelled ? "Your library is unchanged." : "Choose Try again, or import the ZIP using Add game." }, true);
    byId("demoFallback").hidden = cancelled;
  } finally {
    demoBusy = false; demoAbort = null;
    const focused = byId("demoTransfer").contains(document.activeElement);
    renderDemos();
    if (focused && document.activeElement.hidden) (demoTransfer.phase === "ready" ? byId("demoOpenBtn") : byId("demoRetryBtn")).focus({ preventScroll: true });
  }
}


async function addGameToLibrary(file) {
  showToast("Adding " + file.name + "…");
  try {
    const storedName = /\.zip$/i.test(file.name)
      ? (await installGameArchive(file)).join(", ")
      : await opfsPutGame(file.name, file);
    log("Library: added " + storedName + " to OPFS.", "ok");
    showToast("✓ Added " + storedName);
    await refreshLibrary();
    updateStorageInfo();
  } catch(e) {
    log("Library add failed: " + e.message, "err");
    showToast("❌ " + e.message);
  }
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

async function readResponseBytes(response, label, maxBytes = Infinity) {
  const total = Number(response.headers.get("content-length") || 0);
  if (!response.body?.getReader) return new Uint8Array(await response.arrayBuffer());

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) { await reader.cancel(); throw new Error("Download exceeds size limit"); }
    chunks.push(value);
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

async function storeGameResponse(name, response) {
  if (!response.ok) throw new Error("Game download failed: HTTP " + response.status);
  if (/\.zip$/i.test(name)) {
    const bytes = await readResponseBytes(response, name, 512 * 1024 * 1024);
    const names = await installGameArchive(new File([bytes], name));
    return { name: names.join(", "), size: bytes.length };
  }
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const { dir, name: fileName } = await opfsParent(safe, true, OPFS_GAMES_DIR);
  const handle = await dir.getFileHandle(fileName, { create: true });
  if (response.body) {
    const writable = await handle.createWritable();
    let received = 0, lastProgress = 0;
    const total = Number(response.headers.get("content-length")) || 0;
    const progress = new TransformStream({ transform(chunk, controller) {
      received += chunk.byteLength;
      if (performance.now() - lastProgress >= 200) {
        showLoading("Downloading " + safe + "… " + formatBytes(received), total ? received / total : undefined);
        lastProgress = performance.now();
      }
      controller.enqueue(chunk);
    } });
    // pipeTo applies backpressure and aborts the file transaction on failure.
    await response.body.pipeThrough(progress).pipeTo(writable);
  } else {
    await writeOpfsHandle(handle, await response.blob());
  }
  const file = await handle.getFile();
  try { await writeGameMetadata(safe, file); }
  catch (e) { log("Library metadata failed for " + safe + ": " + e.message, "warn"); }
  return { name: safe, size: file.size };
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
    const stored = await storeGameResponse(name, response);
    const storedName = stored.name;
    hideLoading();
    log("Library: downloaded " + storedName + " from " + parsed.href + " (" + formatBytes(stored.size) + ").", "ok");
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
function isLocalSecret(path) {
  return /\/PSP\/SYSTEM\/ppsspp_retroachievements\.dat$/i.test(path);
}

async function buildSaveFileMap() {
  const opfsEntries = await opfsWalk();
  const map = new Map(); // path → {path, data, size, fromOPFS}
  for (const { path, data, size } of opfsEntries) {
    if (!isLocalSecret(path)) map.set(path, { path, data, size: data?.byteLength || size || 0, fromOPFS: true });
  }
  // Overlay with live FS if running (newer / authoritative)
  const FS = window.FS;
  if (FS) {
    const memstick = _detectedMemstick || detectMemstickDir(FS);
    const fsFiles  = fsWalkDir(FS, memstick);
    for (const { path, data } of fsFiles) {
      if (!isLocalSecret(path)) map.set(path, { path, data, size: data?.byteLength || 0, fromOPFS: false });
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

function saveGameId(value) { return (String(value).match(/[A-Z]{4}\d{5}/i)?.[0] || value).toUpperCase(); }
function buildSaveCollection(slots, library = []) {
  const groups = new Map();
  for (const slot of slots) {
    const id = saveGameId(slot.game);
    const meta = library.find(game => game.discId && saveGameId(game.discId) === id);
    if (!groups.has(id)) groups.set(id, { id, title: meta?.title || id, icon: "", coverType: meta?.coverType || "", fileName: meta?.fileName || "", slots: [], size: 0 });
    const group = groups.get(id);
    if (!slot.flat) {
      const sfo = slot.files.find(file => file.name.toUpperCase() === "PARAM.SFO")?.data;
      const title = parsePsfString(sfo, "TITLE");
      if (title) group.title = title;
      const thumb = slot.files.find(file => file.name.toUpperCase() === "ICON0.PNG");
      const icon = thumb?.data ? toDataURL(thumb.data, "png") : "";
      if (icon && !group.icon) group.icon = icon;
      group.slots.push({
        id: slot.slotDir, kind: "data", title: parsePsfString(sfo, "SAVEDATA_TITLE") || "Save data",
        description: parsePsfString(sfo, "SAVEDATA_DETAIL"), icon,
        game: slot.game, slotDir: slot.slotDir, files: slot.files,
        size: slot.files.reduce((sum, file) => sum + file.size, 0),
      });
    } else {
      // Pair each state with its own preview, including its full storage path.
      for (const data of slot.files.filter(file => /\.(ppst|sst)$/i.test(file.name))) {
        const base = data.name.replace(/\.[^.]+$/, "");
        const preview = slot.files.find(file => file.path.replace(/\.[^.]+$/, "") === data.path.replace(/\.[^.]+$/, "") && /\.(jpg|jpeg|png)$/i.test(file.name));
        const number = base.match(/_(\d+)$/)?.[1];
        const paths = [data.path, ...(preview ? [preview.path] : [])];
        group.slots.push({
          id: data.path, kind: "state", title: number !== undefined ? "State " + (Number(number) + 1) : /auto/i.test(base) ? "Auto state" : base,
          description: "", game: slot.game, path: data.path, paths,
          icon: preview?.data ? toDataURL(preview.data, preview.name.split(".").pop()) : "",
          size: data.size + (preview?.size || 0),
        });
      }
    }
  }
  for (const group of groups.values()) {
    group.size = group.slots.reduce((sum, slot) => sum + slot.size, 0);
    group.slots.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
    group.dataCount = group.slots.filter(slot => slot.kind === "data").length;
    group.stateCount = group.slots.length - group.dataCount;
  }
  return [...groups.values()].filter(group => group.slots.length).sort((a, b) => a.title.localeCompare(b.title));
}
function saveCollectionSummary(group) {
  return [group.dataCount ? group.dataCount + (group.dataCount === 1 ? " save" : " saves") : "", group.stateCount ? group.stateCount + (group.stateCount === 1 ? " state" : " states") : ""].filter(Boolean).join(" · ");
}
let saveCollection = [], savesRenderVersion = 0, saveInfoReturnFocus = null;
function renderSaveInfo(group) {
  byId("saveInfoTitle").textContent = group.title;
  byId("saveInfoSummary").textContent = saveCollectionSummary(group) + " · " + formatBytes(group.size);
  byId("saveInfoIcon").innerHTML = group.icon ? `<img src="${group.icon}" alt="">` : gamePlaceholder();
  const html = group.slots.map(slot => {
    const dataAttrs = slot.kind === "data"
      ? `data-slot-dir="${esc(slot.slotDir)}" data-game="${esc(slot.game)}"`
      : `data-path="${esc(slot.path)}" data-paths="${esc(JSON.stringify(slot.paths))}" data-game="${esc(slot.game)}"`;
    const thumb = slot.icon || group.icon;
    return `<details class="save-slot" data-slot-id="${esc(slot.id)}"><summary data-focus-key="${esc(slot.id)}">${thumb ? `<img src="${thumb}" alt="">` : ""}<span><span class="slot-name">${esc(slot.title)}</span><span class="slot-meta">${slot.kind === "data" ? "Save data" : "Save state"} · ${formatBytes(slot.size)}</span></span></summary>
      <div class="slot-body">${slot.description ? `<p>${esc(slot.description)}</p>` : ""}<div class="action-row">
        <button type="button" data-save-action="${slot.kind === "data" ? "download-slot" : "download-file"}" ${dataAttrs}>${svgIcon("download")} Export</button>
        <button type="button" class="drive-sync-btn" data-save-action="${slot.kind === "data" ? "drive-upload-slot" : "drive-upload-state"}" ${dataAttrs}>${svgIcon("cloud-upload")} Upload to Drive</button>
        <button type="button" class="danger" data-save-action="${slot.kind === "data" ? "delete-slot" : "delete-pair"}" ${dataAttrs}>${svgIcon("trash")} Delete</button>
      </div><p class="field-help">${esc(slot.kind === "data" ? slot.game : slot.path.split("/").pop())}</p></div>
    </details>`;
  }).join("");
  const container = byId("saveInfoSlots");
  const focusedSlot = container.contains(document.activeElement) ? document.activeElement.closest(".save-slot")?.dataset.slotId : null;
  const opened = new Set([...container.querySelectorAll("details[open]")].map(el => el.dataset.slotId));
  replaceCollectionContent(container, html);
  for (const detail of container.querySelectorAll("details")) detail.open = opened.has(detail.dataset.slotId);
  if (focusedSlot) ([...container.querySelectorAll("details")].find(detail => detail.dataset.slotId === focusedSlot) || container.querySelector("details"))?.querySelector("summary")?.focus({ preventScroll: true });
}
function showSaveInfo(id) {
  const group = saveCollection.find(group => group.id === id);
  if (!group) return;
  const modal = byId("saveInfoModal");
  saveInfoReturnFocus = document.activeElement;
  modal.dataset.gameId = id;
  renderSaveInfo(group);
  modal.classList.add("visible"); modal.setAttribute("aria-hidden", "false");
  modal.querySelector("summary")?.focus({ preventScroll: true });
}
function closeSaveInfo() {
  const modal = byId("saveInfoModal");
  modal.classList.remove("visible"); modal.setAttribute("aria-hidden", "true");
  const id = modal.dataset.gameId;
  delete modal.dataset.gameId;
  const replacement = [...byId("savesList").querySelectorAll(".collection-tile")].find(tile => tile.dataset.saveGame === id) || byId("savesList").querySelector(".collection-tile:not([hidden])");
  const target = saveInfoReturnFocus?.isConnected ? saveInfoReturnFocus : replacement || document.querySelector('.tab[data-tab="saves"]');
  target?.focus({ preventScroll: true });
  saveInfoReturnFocus = null;
}
async function refreshSavesTab() {
  const empty = byId("savesEmpty"), list = byId("savesList"), stats = byId("savesStats");
  if (!empty || !list) return;
  const version = ++savesRenderVersion;
  list.setAttribute("aria-busy", "true");
  if (!list.children.length) { empty.style.display = "block"; empty.textContent = "Loading saves…"; }
  try {
    const fileMap = await buildSaveFileMap();
    const games = await opfsWalk(OPFS_GAMES_DIR, "", false);
    const library = await Promise.all(games.map(game => readGameMetadata(game.path)));
    const groups = buildSaveCollection(groupSavesBySlot(fileMap), library);
    for (const group of groups) {
      if (!group.icon && group.fileName && group.coverType) {
        try { group.icon = toDataURL(await opfsMetaRead(group.fileName + ".cover"), group.coverType); } catch (_) {}
      }
    }
    for (const group of groups) if (!group.icon) group.icon = group.slots.find(slot => slot.icon)?.icon || "";
    if (version !== savesRenderVersion) return;
    saveCollection = groups;
    replaceCollectionContent(list, groups.map(group => `<button type="button" class="collection-tile save-game-tile" data-save-game="${esc(group.id)}" data-focus-key="${esc(group.id)}" data-search="${esc((group.title + " " + group.id + " " + group.slots.map(slot => slot.title + " " + slot.game).join(" ")).toLocaleLowerCase())}" data-description="${esc(group.title + " · " + saveCollectionSummary(group) + " · " + formatBytes(group.size))}" aria-label="Open saves for ${esc(group.title)}">
      <span class="tile-art">${group.icon ? `<img src="${group.icon}" alt="" loading="lazy">` : gamePlaceholder()}</span><span class="tile-body"><span class="tile-title">${esc(group.title)}</span><span class="tile-meta">${saveCollectionSummary(group)}</span></span>
    </button>`).join(""));
    list.style.display = groups.length ? "grid" : "none";
    empty.style.display = groups.length ? "none" : "block";
    empty.textContent = "No saves. Import a backup or save your progress in a game.";
    const slots = groups.reduce((sum, group) => sum + group.slots.length, 0);
    if (stats) stats.textContent = groups.length ? groups.length + (groups.length === 1 ? " game" : " games") + " · " + slots + (slots === 1 ? " slot" : " slots") : "";
    filterCollection("saves");
    const modal = byId("saveInfoModal");
    if (modal.classList.contains("visible")) {
      const group = groups.find(group => group.id === modal.dataset.gameId);
      if (group) renderSaveInfo(group); else closeSaveInfo();
    }
  } catch (e) { if (version === savesRenderVersion) { empty.style.display = "block"; empty.textContent = "Could not read saves: " + e.message; } }
  finally { if (version === savesRenderVersion) list.removeAttribute("aria-busy"); }
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
  const files = [...(await buildSaveFileMap()).values()].filter(file => file.path.startsWith(slotDir + "/"));
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
  if (!await confirmUI("Delete file:\n" + path.split("/").pop() + "?")) return;
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
  if (!await confirmUI("Delete:\n" + names + "?\n\nThis cannot be undone.")) return;
  const FS = window.FS;
  for (const path of paths) {
    try { await opfsDelete(path); } catch(e) {}
    if (FS) { try { FS.unlink(path); } catch(e) {} }
  }
  showToast("🗑 Deleted " + paths.map(p => p.split("/").pop()).join(", "));
  refreshSavesTab(); updateStorageInfo();
}

async function deleteSaveSlot(slotDir, gameName) {
  if (!await confirmUI("Delete ALL saves for:\n" + gameName + "?\n\nThis cannot be undone.")) return;
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

function nativeSaveRelativePath(file) {
  const parts = (file.webkitRelativePath || "").split("/").filter(Boolean);
  if (parts.some(part => part === "." || part === ".." || part.includes("\\"))) throw new Error("Invalid save folder path");
  const savedata = parts.findIndex(part => part.toUpperCase() === "SAVEDATA");
  const relative = savedata >= 0 ? parts.slice(savedata + 1) : parts;
  if (relative.length < 2) throw new Error("Select SAVEDATA or a game's save folder, including its files.");
  return relative.join("/");
}

function importNativeSaveFolder(files) {
  const selected = Array.from(files);
  const task = persistQueue.then(() => importNativeSaveFolderNow(selected));
  persistQueue = task.catch(() => {});
  return task;
}

async function importNativeSaveFolderNow(files) {
  if (!files.length) return;
  try {
    const paths = Array.from(files, file => ({ file, relative: nativeSaveRelativePath(file) }));
    const root = window.FS ? detectMemstickDir(window.FS) : PERSIST_ROOTS[0];
    for (const { file, relative } of paths) {
      const path = root + "/PSP/SAVEDATA/" + relative;
      const data = new Uint8Array(await file.arrayBuffer());
      await opfsPut(path, data);
      if (window.FS) {
        fsMkdirP(window.FS, dirname(path));
        window.FS.writeFile(path, data);
      }
    }
    log("Imported native PSP save folder: " + paths.length + " files.", "ok");
    showToast("Imported " + paths.length + " PSP save files.");
    await refreshSavesTab();
    await updateStorageInfo();
  } catch (e) { showToast("Save folder import failed: " + e.message, 6000); }
}
on("nativeSaveFolderInput", "change", async event => {
  await importNativeSaveFolder(event.target.files);
  event.target.value = "";
});

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
    const entries = await opfsWalk(OPFS_PERSIST_DIR, "", false);
    if (!entries.length) { log("Persistence: no saved data in OPFS.", "dim"); return; }
    let ok = 0;
    for (const { path } of entries) {
      try {
        const data = await opfsRead(path);
        fsMkdirP(FS, path.substring(0, path.lastIndexOf("/")));
        FS.writeFile(path, data);
        ok++;
      } catch(e) { log("Persist restore failed " + path + ": " + e.message, "warn"); }
    }
    log("Persistence: restored " + ok + "/" + entries.length + " files from OPFS.", "ok");
    showToast("✓ Restored " + ok + " saved files");
    // Seed dirty-tracking so the first auto-sync cycle is fully incremental
    _detectedMemstick = detectMemstickDir(FS);
    const initStats = fsStatDir(FS, _detectedMemstick, true);
    for (const [path, { size, mtime }] of initStats)
      _persistedFileState.set(path, size + ":" + mtime);
  } catch(e) {
    log("Persistence: OPFS load error: " + e.message, "warn");
    showToast("Browser storage unavailable: this session's progress cannot be saved locally. Check site storage permissions.", 10000);
  }
}

function patchIniValue(text, section, key, value, overwrite = true) {
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
        if (!overwrite) return text;
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
  return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(clean) && !(parseInt(clean.slice(0, 2), 16) & 1) && clean !== "00:00:00:00:00:00" ? clean : randomPspMac();
}

function readNetworkSessionKey() {
  try { return sessionStorage.getItem("ppsspp-relay-session-key") || networkSessionKey; }
  catch (_) { return networkSessionKey; }
}

function storeNetworkSessionKey(value) {
  networkSessionKey = value;
  try { sessionStorage.setItem("ppsspp-relay-session-key", value); } catch (_) {}
}

function loadNetworkConfig() {
  let mac = preferences.getItem(NETWORK_MAC_KEY);
  if (!mac || !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac) || parseInt(mac.slice(0, 2), 16) & 1) {
    mac = randomPspMac(); preferences.setItem(NETWORK_MAC_KEY, mac);
  }
  // Separate tabs need separate PSP identities; keep this tab's identity on reload.
  try {
    let tabMac = sessionStorage.getItem("ppsspp-tab-mac");
    if (!tabMac) { tabMac = randomPspMac(); sessionStorage.setItem("ppsspp-tab-mac", tabMac); }
    mac = tabMac;
  } catch (_) {}
  let server = preferences.getItem(NETWORK_SERVER_KEY);
  if (!server || !server.includes("://")) server = new URL("/adhoc", location.href).href.replace(/^http/, "ws");
  return { enabled: preferences.getItem(NETWORK_ENABLE_KEY) === "1", server,
    transport: preferences.getItem("ppsspp-network-transport") === "websocket" ? "websocket" : "hybrid",
    room: preferences.getItem("ppsspp-network-room") || "public",
    sessionKey: readNetworkSessionKey(),
    nick: sanitizeNetworkNick(preferences.getItem(NETWORK_NICK_KEY)), mac: sanitizeNetworkMac(mac) };
}

function importNetworkInvite(hash = location.hash, strict = false) {
  const invite = new URLSearchParams(hash.slice(1));
  if (!invite.get("relay")) { if (strict) throw new Error("Invalid multiplayer invitation"); return; }
  try {
    const server = window.PPSSPPAdhoc.endpoint(invite.get("relay")).href;
    const room = invite.get("room") || "public";
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(room)) throw new Error("Invalid invitation room");
    const sameRelay = preferences.getItem(NETWORK_SERVER_KEY) === server;
    const sessionKey = invite.has("session_key") ? invite.get("session_key") : sameRelay ? readNetworkSessionKey() : "";
    if (sessionKey.length > 256) throw new Error("Invalid session key");
    storeNetworkSessionKey(sessionKey);
    preferences.setItem(NETWORK_SERVER_KEY, server);
    preferences.setItem("ppsspp-network-room", room);
    preferences.setItem(NETWORK_ENABLE_KEY, "1");
    history.replaceState(null, "", location.pathname + location.search);
  } catch (e) { if (strict) throw e; log("Network invitation: " + e.message, "warn"); }
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
      ws.onclose = ws.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error("connection failed; check relay URL, session key and TLS certificate"));
      };
    } catch(e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

function networkConfigSignature(cfg) {
  return JSON.stringify([cfg.enabled, cfg.server, cfg.room, cfg.sessionKey, cfg.nick, cfg.mac, cfg.transport || "hybrid"]);
}

function networkStatusView(cfg, live, probe, now = Date.now(), online = true) {
  if (!online) return { tone: "error", title: "You are offline", detail: "Restore your internet or LAN connection, then check the relay again." };
  if (live?.lastError) return { tone: "error", title: "Connection problem", detail: live.lastError + ". Check your relay address, session key and certificate; then reconnect from the game's multiplayer menu." };
  if (live?.state === "registered") {
    const count = live.peers?.length || 0;
    return { tone: "good", title: count ? "Connected with friends" : "Connected to relay", detail: count ? `${count} player${count === 1 ? "" : "s"} connected. Use the game's multiplayer menu to play.` : "Game connection active. Host or join a session in the game's multiplayer menu." };
  }
  if (live?.state === "connecting") return { tone: "busy", title: "Connecting game…", detail: "Waiting for the relay to accept the game connection." };
  if (probe.state === "checking") return { tone: "busy", title: "Checking relay…", detail: "Verifying the WebSocket connection and your access key." };
  if (probe.state === "error") return { tone: "error", title: "Relay unreachable", detail: probe.error };
  if (probe.state === "reachable" && now - probe.checkedAt < 30000) return { tone: "ready", title: "Relay reachable · game not connected", detail: "Relay accepted the connection. Start PPSSPP and enter the game's multiplayer menu to connect." };
  if (live?.state === "disconnected") return { tone: "neutral", title: "Disconnected", detail: "The game has no active relay connection. Leave and re-enter the game's multiplayer menu to reconnect." };
  if (!cfg.enabled) return { tone: "neutral", title: "Multiplayer disabled", detail: "Enable multiplayer and save your settings before starting PPSSPP." };
  return { tone: "neutral", title: "Connection not checked", detail: "Check the relay before playing. The game connects when you enter its multiplayer menu." };
}

function renderNetworkStatus(cfg = loadNetworkConfig()) {
  // Event listeners pass an Event; only configuration objects belong here.
  if (!cfg || typeof cfg.enabled !== "boolean") cfg = loadNetworkConfig();
  const view = networkStatusView(cfg, networkLiveStatus, networkProbe, Date.now(), navigator.onLine !== false);
  const card = byId("networkStatus");
  if (card) card.dataset.tone = view.tone;
  if (byId("networkStatusTitle")) byId("networkStatusTitle").textContent = view.title;
  if (byId("networkStatusDetail")) byId("networkStatusDetail").textContent = view.detail;
  const live = networkLiveStatus;
  const session = byId("networkSessionState");
  if (session) session.textContent = live?.state === "registered"
    ? `Room: ${networkActiveConfig?.room || cfg.room} · ${live.peers?.length || 0} peers` + (live.rttMs == null ? "" : ` · ${live.rttMs} ms`)
    : "No active game session";
  if (session && live?.state === "registered") {
    const connected = live.rtc?.peers?.filter(p => p.state === "connected" && p.channel === "open") || [];
    const turn = connected.filter(p => p.route === "turn").length;
    session.textContent += connected.length ? ` · WebRTC: ${connected.length} peers${turn ? ` (${turn} via TURN)` : ""}` : " · Data via relay";
  }
  if (networkActiveConfig && networkConfigSignature(cfg) !== networkConfigSignature(networkActiveConfig)) {
    if (session) session.textContent += " · Saved settings changed: restart PPSSPP to apply";
  }
  if (networkTestBtn) { networkTestBtn.disabled = networkProbe.state === "checking"; networkTestBtn.setAttribute("aria-busy", String(networkProbe.state === "checking")); }
  if (byId("networkDisconnectBtn")) byId("networkDisconnectBtn").disabled = !["registered", "connecting"].includes(live?.state);
  if (byId("networkReconnectBtn")) byId("networkReconnectBtn").disabled = !window.ppssppAdhocTransport || live?.state === "connecting";
}

function checkNetworkWhenVisible() {
  if (document.hidden || !document.body.classList.contains("panel-open") || !byId("tabNetwork")?.classList.contains("active")) return;
  renderNetworkStatus();
  if (networkDraftDirty || !loadNetworkConfig().enabled || networkLiveStatus?.state === "registered" || networkLiveStatus?.state === "connecting") return;
  if (networkProbe.state === "checking" || Date.now() - (networkProbe.checkedAt || 0) < 30000) return;
  testNetworkRelay(false);
}

async function testNetworkRelay(save = true) {
  let probe;
  try {
    if (networkProbe.state === "checking") return;
    const cfg = save === false ? loadNetworkConfig() : saveNetworkConfigFromUI();
    probe = { state: "checking" };
    networkProbe = probe;
    renderNetworkStatus(cfg);
    const base = window.PPSSPPAdhoc.endpoint(cfg.server);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
    base.search = new URLSearchParams({ v: "1", token, room: cfg.room, ...(cfg.sessionKey ? { session_key: cfg.sessionKey } : {}) });
    await testWebSocket(base.href);
    if (networkProbe !== probe) return;
    networkProbe = { state: "reachable", checkedAt: Date.now() };
  } catch (e) {
    if (probe && networkProbe !== probe) return;
    networkProbe = { state: "error", error: "Relay check failed: " + e.message, checkedAt: Date.now() };
  }
  renderNetworkStatus();
}

function saveNetworkConfigFromUI() {
  const cfg = { enabled: !!networkEnableToggle?.checked,
    transport: byId("networkTransportInput")?.value === "websocket" ? "websocket" : "hybrid",
    server: window.PPSSPPAdhoc.endpoint(networkServerInput?.value).href.replace(/\/$/, ""),
    room: byId("networkRoomInput")?.value.trim() || "public",
    sessionKey: byId("networkSessionKeyInput")?.value || "",
    nick: sanitizeNetworkNick(networkNickInput?.value), mac: sanitizeNetworkMac(networkMacInput?.value) };
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(cfg.room)) throw new Error("Room: use 1–32 letters, numbers, _ or -");
  if (cfg.sessionKey.length > 256) throw new Error("Session key too long");
  if (networkConfigSignature(cfg) !== networkConfigSignature(loadNetworkConfig())) networkProbe = { state: "unverified" };
  storeNetworkSessionKey(cfg.sessionKey);
  preferences.setItem(NETWORK_ENABLE_KEY, cfg.enabled ? "1" : "0");
  preferences.setItem(NETWORK_SERVER_KEY, cfg.server);
  preferences.setItem(NETWORK_NICK_KEY, cfg.nick);
  preferences.setItem(NETWORK_MAC_KEY, cfg.mac);
  preferences.setItem("ppsspp-network-room", cfg.room);
  preferences.setItem("ppsspp-network-transport", cfg.transport);
  try { sessionStorage.setItem("ppsspp-tab-mac", cfg.mac); } catch (_) {}
  updateNetworkConfigUI(cfg, "Saved. Restart PPSSPP to apply network settings before entering multiplayer.");
  return cfg;
}

function updateNetworkConfigUI(cfg = loadNetworkConfig(), message = "") {
  networkDraftDirty = false;
  if (networkEnableToggle) networkEnableToggle.checked = cfg.enabled;
  if (networkServerInput) networkServerInput.value = cfg.server;
  if (networkNickInput) networkNickInput.value = cfg.nick;
  if (networkMacInput) networkMacInput.value = cfg.mac;
  if (byId("networkTransportInput")) byId("networkTransportInput").value = cfg.transport || "hybrid";
  if (byId("networkRoomInput")) byId("networkRoomInput").value = cfg.room;
  if (byId("networkSessionKeyInput")) byId("networkSessionKeyInput").value = cfg.sessionKey || "";
  renderNetworkStatus(cfg);
  if (networkActivityEl && message) networkActivityEl.textContent = message;
}

function installSockFSAdhocRelay() {
  if (!loadNetworkConfig().enabled) return true;
  try {
    networkActiveConfig = loadNetworkConfig();
    window.ppssppAdhocTransport = window.PPSSPPAdhoc.install({
      SOCKFS: window.SOCKFS || window.Module?.SOCKFS,
      FS: window.FS || window.Module?.FS,
      config: { ...loadNetworkConfig(), endpoint: loadNetworkConfig().server },
      onstatus(status) {
        const node = byId("networkDiagnostics");
        if (node) node.textContent = JSON.stringify(status, null, 2);
        networkLiveStatus = status;
        renderNetworkStatus();
      },
    });
    return true;
  } catch (error) {
    networkLiveStatus = { state: "disconnected", lastError: error.message };
    renderNetworkStatus();
    log("Network: " + error.message, "err");
    return false;
  }
}

async function applyNetworkConfig(FS, text) {
  const cfg = loadNetworkConfig();
  let patched = text;
  patched = patchIniValue(patched, "Network", "EnableWlan", cfg.enabled ? "True" : "False");
  patched = patchIniValue(patched, "Network", "proAdhocServer", "relay.ppsspp.invalid");
  patched = patchIniValue(patched, "Network", "AdhocServerRelayMode", "2");
  patched = patchIniValue(patched, "Network", "EnableAdhocServer", "False");
  patched = patchIniValue(patched, "Network", "ForcedFirstConnect", "True");
  patched = patchIniValue(patched, "Network", "PortOffset", "10000");
  patched = patchIniValue(patched, "Network", "MinTimeout", "1");
  patched = patchIniValue(patched, "Network", "EnableUPnP", "False");
  patched = patchIniValue(patched, "SystemParam", "NickName", cfg.nick);
  patched = patchIniValue(patched, "SystemParam", "MacAddress", cfg.mac);
  patched = patchIniValue(patched, "SystemParam", "WlanAdhocChannel", "0");

  return patched;
}

function applyMultiplayerTimingConfig(text) {
  if (!loadNetworkConfig().enabled) return text;
  // Native lag-sync sleeps block delivery of browser relay messages.
  return patchIniValue(text, "General", "ForceLagSync2", "False");
}

async function syncGameNetworkNicknames(FS, root) {
  const cfg = loadNetworkConfig();
  if (!cfg.enabled) return;
  const directory = root + "/PSP/SYSTEM";
  let names;
  try { names = FS.readdir(directory); } catch (_) { return; }
  for (const name of names) {
    if (!/_ppsspp(?:vr)?\.ini$/i.test(name)) continue;
    const path = directory + "/" + name;
    try {
      const text = new TextDecoder().decode(FS.readFile(path));
      const patched = patchIniValue(text, "SystemParam", "NickName", cfg.nick);
      if (patched === text) continue;
      const bytes = new TextEncoder().encode(patched);
      FS.writeFile(path, bytes);
      await opfsPut(path, bytes);
    } catch (error) {
      log("Network: failed to apply nickname at " + path + ": " + error.message, "warn");
    }
  }
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
      const ra = achievementsConfig();
      patched = patchIniValue(patched, "Achievements", "AchievementsEnable", ra.enabled ? "True" : "False");
      patched = patchIniValue(patched, "Achievements", "AchievementsChallengeMode", ra.hardcore ? "True" : "False");
      for (const [section, key, value] of WEB_NATIVE_TIMING_CONFIG) {
        patched = patchIniValue(patched, section, key, value, false);
      }
      for (const [section, key, value] of WEB_STABILITY_CONFIG) {
        patched = patchIniValue(patched, section, key, value, false);
      }
      patched = applyMultiplayerTimingConfig(patched);
      if (applyMobileTouchDefaults) {
        for (const [section, key, value] of MOBILE_TOUCH_CONFIG) {
          patched = patchIniValue(patched, section, key, value, false);
        }
      }
      const bytes = encoder.encode(patched);
      FS.writeFile(iniPath, bytes);
      await opfsPut(iniPath, bytes);
      log("Config: missing web defaults initialized at " + iniPath + (applyMobileTouchDefaults ? " (mobile touch/UI enabled)" : ""), "ok");
    } catch(e) {
      log("Config: failed to apply web defaults at " + iniPath + ": " + e.message, "warn");
    }
    // The core loads game overrides after ppsspp.ini, including NickName.
    await syncGameNetworkNicknames(FS, root);
  }
}

// Save config+saves from Emscripten FS to OPFS — incremental (only changed/deleted files)
let persistQueue = Promise.resolve();
function persistFiles(FS, label) {
  const task = persistQueue.then(() => persistFilesNow(FS, label));
  persistQueue = task.catch(e => log("Persistence failed: " + e.message, "warn"));
  return task;
}

async function persistFilesNow(FS, label) {
  if (!FS || !hasOPFS()) return;
  _detectedMemstick = detectMemstickDir(FS);
  const currentStats = fsStatDir(FS, _detectedMemstick, true);

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
      try { await opfsDelete(path); }
      catch(e) {
        if (e.name !== "NotFoundError") {
          log("Persist delete failed " + path + ": " + e.message, "warn");
          continue;
        }
      }
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
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && runtimeReady && window.FS) void persistFiles(window.FS, "background");
  });
  setInterval(() => {
    const FS = window.FS;
    if (!runtimeReady || !FS) return;
    persistFiles(FS, "auto");
  }, PERSIST_SYNC_MS);
}

/* ── Drive auto-sync ─────────────────────────────────────────────── */
let _driveAutoSyncTimer = null;
let _driveAutoSyncLastAt = 0;

function driveAutoSyncEnabled() {
  return preferences.getItem(GOOGLE_AUTO_SYNC_KEY) === "1";
}

function driveAutoSyncRate() {
  return Math.max(60, Number(preferences.getItem(GOOGLE_AUTO_SYNC_RATE_KEY) || 300));
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
  const files = [...(await buildSaveFileMap()).values()];
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
  return (window.PPSSPP_GOOGLE_CLIENT_ID || preferences.getItem(GOOGLE_CLIENT_ID_KEY) || "").trim();
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
    preferences.setItem(GOOGLE_TOKEN_KEY, JSON.stringify({
      accessToken: googleAccessToken,
      expiresAt: googleTokenExpiresAt,
    }));
  } else {
    preferences.removeItem(GOOGLE_TOKEN_KEY);
  }
}

function restoreGoogleToken() {
  if (googleAccessToken && Date.now() < googleTokenExpiresAt - 60000) return true;
  let saved = null;
  try { saved = JSON.parse(preferences.getItem(GOOGLE_TOKEN_KEY) || "null"); } catch(e) {}
  if (!saved?.accessToken || !saved?.expiresAt || Date.now() >= Number(saved.expiresAt) - 60000) {
    preferences.removeItem(GOOGLE_TOKEN_KEY);
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
  const expectedState = preferences.getItem(GOOGLE_OAUTH_STATE_KEY) || "";
  preferences.removeItem(GOOGLE_OAUTH_STATE_KEY);
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
  preferences.setItem(GOOGLE_OAUTH_STATE_KEY, state);
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
  if (activeDriveAction) preferences.setItem(GOOGLE_PENDING_ACTION_KEY, activeDriveAction);
}

function takePendingDriveAction() {
  const action = preferences.getItem(GOOGLE_PENDING_ACTION_KEY) || "";
  preferences.removeItem(GOOGLE_PENDING_ACTION_KEY);
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
    const response = await driveFetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(file.id) + "?alt=media");
    const stored = await storeGameResponse(file.name, response);
    const storedName = stored.name;
    log("Google Drive: downloaded game " + storedName + " (" + formatBytes(stored.size) + ").", "ok");
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
    FS.writeFile(path, bytes, { canOwn: true });
    await opfsPutGame(file.name, file);
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
  if (document.body.classList.contains("panel-open") && byId("tabLog")?.classList.contains("active")) renderLog();
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
  if (pendingLines.length > MAX_LOG_LINES) pendingLines.splice(0, pendingLines.length - MAX_LOG_LINES);
  // DevTools console retention is expensive during sustained core logging.
  if (level === "err" || preferences.getItem("ppsspp_verbose_console") === "1") console.log(raw);
  updateAudioDebugFromLog(text);
  const sessionGame = sessionGameFromBootLog(text);
  if (sessionGame) setSessionPresentation(sessionGame);
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
  if (!started || menuSuspended) return;
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
  // Mirror actual speaker output, including SDL's worklet shim, into a capture bus.
  if (window.AudioNode && !AudioNode.prototype.__ppssppCapturePatched) {
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(destination, ...args) {
      const result = connect.call(this, destination, ...args);
      if (destination === this.context.destination && this.context.__ppssppCaptureDestination)
        connect.call(this, this.context.__ppssppCaptureDestination, ...args);
      return result;
    };
    AudioNode.prototype.__ppssppCapturePatched = true;
  }
  for (const name of ["AudioContext", "webkitAudioContext"]) {
    const Orig = window[name];
    if (!Orig || Orig.__ppssppTracked) continue;
    function Tracked(...args) {
      const ctx = new Orig(...args);
      trackedAudioContexts.push(ctx);
      ctx.__ppssppCaptureDestination = ctx.createMediaStreamDestination();
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
  if (menuSuspended) return;
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
let activeGamepadIndex = Number(preferences.getItem(GAMEPAD_SELECT_KEY) ?? -1);
if (!Number.isInteger(activeGamepadIndex)) activeGamepadIndex = -1;
window.__ppssppActiveGamepadIndex = activeGamepadIndex;
const nativeGetGamepads = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : null;

function maskGuideButton(pad) {
  if (!pad || pad.mapping !== "standard" || !(pad.buttons[16]?.pressed || pad.buttons[16]?.value > 0.5)) return pad;
  return {
    id: pad.id, index: pad.index, connected: pad.connected, mapping: pad.mapping,
    timestamp: performance.now(), axes: Array.from(pad.axes),
    buttons: Array.from(pad.buttons, (button, index) => index === 16 ? { pressed: false, touched: false, value: 0 } : button),
  };
}

function installGamepadSelectionFilter() {
  if (!nativeGetGamepads || navigator.__ppssppGamepadFiltered) return;
  try {
    Object.defineProperty(navigator, "__ppssppGamepadFiltered", { value: true });
    navigator.getGamepads = function() {
      const pads = nativeGetGamepads();
      // Keep device identity stable while releasing every gameplay input in menus.
      if (window.__ppssppConsoleInputBlocked) return Array.from(pads || [], gp => gp ? {
        id: gp.id, index: gp.index, connected: gp.connected, mapping: gp.mapping,
        timestamp: performance.now(), axes: Array.from(gp.axes, () => 0),
        buttons: Array.from(gp.buttons, () => ({ pressed: false, touched: false, value: 0 })),
      } : null);
      // SDL maps Guide directly to native pause. Reserve it here so a hold
      // opens only the web dashboard; navigation reads the unfiltered stream.
      const filtered = Array.from(pads || [], maskGuideButton);
      if (!isActiveGamepadPresent()) return filtered;
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
  preferences.setItem(GAMEPAD_SELECT_KEY, String(activeGamepadIndex));

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
  let added = false;
  for (const gp of pads) {
    if (!gp || gp.connected === false) continue;
    present.add(gp.index);
    added = rememberGamepad(gp, source, options) || added;
  }

  let removed = false;
  for (const [index, state] of connectedGamepads) {
    if (!present.has(index)) {
      connectedGamepads.delete(index);
      removed = true;
      log('GAMEPAD missing: [' + index + '] "' + state.id + '"');
    }
  }

  if (removed || added) updateGamepadSelector();
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
    flashGamepadBadge();
  }
  return n;
}

function startSmartGamepadPolling() {
  if (gamepadPollTimer || !navigator.getGamepads) return;
  reconcileGamepads("startup scan");
  gamepadPollTimer = setInterval(() => {
    if (!document.hidden) reconcileGamepads("runtime scan", { refreshSDL: true });
  }, GAMEPAD_POLL_MS);
}

function onGamepadConnected(e) {
  const gp = e.gamepad;
  rememberGamepad(gp, e.__ppssppSynthetic ? "refreshed" : "connected", { refreshSDL: false });
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
  // The probe is disposable; release its GPU resources before starting SDL.
  gl.getExtension("WEBGL_lose_context")?.loseContext();
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
let coiReloadPending = false;

function showIsolationFailure(message) {
  log(message, "err");
  setStatus(message, "err");
  hideLoading();
  setStartButtonMode("idle");
  const notice = byId("isolationRecovery");
  if (notice) {
    notice.hidden = false;
    byId("isolationRecoveryMessage").textContent = message;
    const link = byId("isolationOpenTab");
    link.href = location.href;
  }
}

function waitForServiceWorkerControl(timeoutMs = 10000) {
  const workers = navigator.serviceWorker;
  if (workers.controller) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); workers.removeEventListener("controllerchange", changed); };
    const changed = () => { if (workers.controller) { cleanup(); resolve(); } };
    const timer = setTimeout(() => { cleanup(); reject(new Error("The service worker did not take control. Check whether this browser allows service workers for this site.")); }, timeoutMs);
    workers.addEventListener("controllerchange", changed);
    changed(); // Also covers a claim that completed while the listener was being attached.
  });
}

async function reloadForCrossOriginIsolation(reason) {
  if (window.crossOriginIsolated) {
    try { sessionStorage.removeItem(COI_RELOAD_KEY); } catch (_) {}
    const notice = byId("isolationRecovery");
    if (notice) notice.hidden = true;
    return true;
  }
  if (coiReloadPending) return false;
  if (window.isSecureContext === false) {
    showIsolationFailure("The emulator needs HTTPS or localhost. Open this site over a secure connection.");
    return false;
  }
  if (window.top !== window.self) {
    showIsolationFailure("This embedded view cannot enable the emulator's isolation. Open PPSSPP Web in its own browser tab.");
    return false;
  }
  const policy = document.permissionsPolicy || document.featurePolicy;
  if (policy?.allowsFeature && !policy.allowsFeature("cross-origin-isolated")) {
    showIsolationFailure("This page's Permissions-Policy blocks cross-origin isolation. Open the site directly or correct the hosting policy.");
    return false;
  }
  let attempts;
  try { attempts = Number(sessionStorage.getItem(COI_RELOAD_KEY) || "0"); }
  catch (_) {
    showIsolationFailure("Browser session storage is blocked. Allow site data or use a server with COOP/COEP headers.");
    return false;
  }
  if (attempts >= 3) {
    showIsolationFailure("The browser could not enable SharedArrayBuffer after three reloads. Select Repair web runtime, or try a separate browser profile with extensions disabled for this site.");
    return false;
  }
  if (!("serviceWorker" in navigator)) {
    showIsolationFailure("Service workers are unavailable. Allow them for this site or use a server with COOP/COEP headers.");
    return false;
  }
  coiReloadPending = true;
  setStatus("Preparing browser isolation…", "run");
  showLoading("Preparing secure runtime…");
  try {
    await navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" });
    // ready describes activation, not whether this document is controlled.
    await waitForServiceWorkerControl();
    sessionStorage.setItem(COI_RELOAD_KEY, String(Number.isFinite(attempts) ? attempts + 1 : 1));
    log("Reloading through the controlling service worker" + (reason ? " (" + reason + ")" : "") + ".", "warn");
    const url = new URL(location.href);
    url.searchParams.set("runtime-isolation", String(Date.now()));
    location.replace(url.href);
    // Keep the guard until navigation: controllerchange and Launch can race.
  } catch (e) {
    coiReloadPending = false;
    showIsolationFailure("Unable to prepare browser isolation: " + (e?.message || e));
  }
  return false;
}

async function repairWebRuntime() {
  const button = byId("isolationRepairBtn");
  if (button.disabled) return;
  button.disabled = true;
  try {
    if (window.isSecureContext === false || !("serviceWorker" in navigator)) throw new Error("Open the HTTPS site in a browser with service workers enabled.");
    const registration = await navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" });
    await registration.update();
    await waitForServiceWorkerControl();
    sessionStorage.removeItem(COI_RELOAD_KEY);
    coiReloadPending = true;
    const url = new URL(location.href);
    url.searchParams.set("runtime-repair", String(Date.now()));
    location.replace(url.href);
  } catch (e) {
    showIsolationFailure("Web runtime repair failed: " + (e?.message || e));
    button.disabled = false;
  }
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
    if (selectedGame && name === selectedGame.name.replace(/[^a-zA-Z0-9._-]/g, "_")) continue;
    const target = VIRTUAL_GAME_DIR + "/" + name;
    if (FS.analyzePath?.(target)?.exists) continue;
    try {
      setStatus("Preloading game " + (ok + 1) + "/" + favorites.length + ": " + name, "run");
      showLoading("Preloading game: " + name);
      const packagePath = await mountStoredGamePackage(FS, name);
      const data = packagePath ? null : await opfsReadGame(name);
      if (data) FS.writeFile(target, data, { canOwn: true });
      ok++;
      bytesMounted += data?.byteLength || 0;
      log("Startup preload mounted: " + (packagePath || target), "ok");
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
  if (!workerFS || !FS?.mount || typeof FileReaderSync === "undefined") return null;

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
    await opfsPutGame(file.name, file);
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
    const packagePath = await mountStoredGamePackage(FS, selectedStoredGame);
    if (packagePath) return packagePath;
    const storedFile = await opfsGetGameFile(selectedStoredGame);
    const fastPath = mountGameFileFast(FS, storedFile, safe, "OPFS");
    if (fastPath) return fastPath;
  }

  setStatus("Loading game into memory: " + sourceName, "run");
  showLoading("Loading game: " + sourceName);
  const bytes = selectedGame
    ? new Uint8Array(await selectedGame.arrayBuffer())
    : await opfsReadGame(selectedStoredGame);
  FS.writeFile(path, bytes, { canOwn: true });
  try { if (selectedGame) await opfsPutGame(selectedGame.name, bytes); }
  catch(e) { log("Could not persist game in OPFS: " + e.message, "warn"); }
  log("Game mounted in MEMFS" + (selectedGame ? " and saved to OPFS" : " from OPFS") + ": " + path, "ok");
  return path;
}

/* ── Panel navigation ───────────────────────────────────────────── */
function activatePanelTab(tabName) {
  const name = tabName === "home" ? "library" : tabName || "library";
  if (!document.body.classList.contains("panel-open")) setPanelOpen(true, false);
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === name);
    tab.setAttribute("aria-current", tab.dataset.tab === name ? "page" : "false");
  });
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
  const id = "tab" + name.charAt(0).toUpperCase() + name.slice(1);
  const panel = document.getElementById(id);
  if (panel) panel.classList.add("active");
  if (name === "log") { flushLog(); renderLog(); }
  if (name === "library") refreshLibrary();
  if (name === "saves") refreshSavesTab();
  if (name === "drive") initDriveConfigUI();
  if (name === "achievements") renderAchievements();
  if (name === "network") { updateNetworkConfigUI(); checkNetworkWhenVisible(); }
  updateCollectionPageStatus();
}

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
      fpsBadge.textContent = fps + " Hz · browser";
    } else if (fpsBadge) {
      fpsBadge.style.display = "none";
    }
  }
  requestAnimationFrame(tickFps);
})();

async function exportDiagnosticReport() {
  const configs = [];
  try {
    const entries = await opfsWalk(OPFS_PERSIST_DIR, "", false);
    for (const entry of entries.filter(e => /\.ini$/i.test(e.path))) {
      let text;
      try { text = window.FS ? new TextDecoder().decode(window.FS.readFile(entry.path)) : new TextDecoder().decode(await opfsRead(entry.path)); }
      catch (_) { text = new TextDecoder().decode(await opfsRead(entry.path)); }
      let include = false;
      const settings = text.split(/\r?\n/).filter(line => {
        const section = line.match(/^\s*\[([^\]]+)\]/);
        if (section) include = /^(CPU|Graphics|Sound|PostShaderList|PostShaderSetting)$/.test(section[1]);
        return include;
      }).join("\n");
      configs.push({ name: entry.name, settings });
    }
  } catch (e) { configs.push({ error: e.message }); }
  const report = {
    version: 1, created: new Date().toISOString(),
    browser: navigator.userAgent, platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency, deviceMemoryGB: navigator.deviceMemory,
    secureContext: window.isSecureContext, embedded: window.top !== window.self, serviceWorkerController: navigator.serviceWorker?.controller?.scriptURL || "",
    crossOriginIsolated: window.crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    opfsAvailable: hasOPFS(), buildDirectory: BUILD_DIR, coreRevision: BUILD_STAMP,
    runtimeReady, status: statusEl?.textContent,
    graphics: ["iRenderer", "iVendor", "iVersion"].map(id => ({ name: id, value: byId(id)?.textContent })),
    audio: { ...audioDebug }, controller: window.__ppssppControllerDiagnostics || null, configs,
    logs: [...logLines, ...pendingLines].slice(-500).map(line => line.raw
      .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
      .replace(/([?&#](?:access_token|id_token|session_key|code|state)=)[^&\s]+/gi, "$1[redacted]")),
  };
  triggerDownload(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), "ppsspp-diagnostics.json");
}

async function resetEmulatorSettings() {
  if (started && !runtimeFailed) { showToast("Reload first, then reset settings before starting PPSSPP."); return; }
  if (!await confirmUI("Reset emulator settings? Games, saves and controller mappings are kept. A backup of each settings file is retained.")) return;
  try {
    await persistQueue;
    const entries = await opfsWalk(OPFS_PERSIST_DIR, "", false);
    const configs = entries.filter(e => /\/PSP\/SYSTEM\/[^/]+\.ini$/i.test(e.path) && !/\/controls\.ini$/i.test(e.path));
    for (const { path } of configs) {
      await opfsPut(path + ".recovery-backup", await opfsRead(path));
      await opfsDelete(path);
      try { window.FS?.unlink(path); } catch (_) {}
      _persistedFileState.delete(path);
    }
    showToast("Settings reset. Reload to start with defaults.", 6000);
    log("Recovery: reset " + configs.length + " emulator settings file(s); saves retained.", "ok");
  } catch (e) { showToast("Settings reset failed: " + e.message, 6000); }
}
on("diagnosticReportBtn", "click", exportDiagnosticReport);
on("recoveryReportBtn", "click", exportDiagnosticReport);
on("resetEmulatorSettingsBtn", "click", resetEmulatorSettings);
on("recoverySettingsBtn", "click", resetEmulatorSettings);
on("recoveryReloadBtn", "click", () => location.reload());

function failRuntime(message) {
  runtimeFailed = true;
  clearTimeout(window.ModuleStartupWatchdog);
  runtimeReady = false;
  clearTimeout(menuResumeTimer);
  document.body.classList.remove("session-resuming");
  updateSessionDock();
  hideLoading();
  setStatus(message, "err");
  const failureMessage = byId("runtimeFailureMessage");
  if (failureMessage) failureMessage.textContent = message;
  const recovery = byId("runtimeRecovery");
  if (recovery) recovery.hidden = false;
}

canvas?.addEventListener("webglcontextlost", event => {
  event.preventDefault();
  if (started) failRuntime("Graphics context lost. Reload to restart; stored saves are retained.");
});

/* ── Launch ─────────────────────────────────────────────────────── */
async function start() {
  if (started || accountBusy) return;
  await accountBoot;
  if (accountBusy) return;
  if (serverAccount && accountBlocked) {
    showToast("Server saves are not ready. Open the Server tab to resolve the connection or conflict.", 8000);
    return;
  }
  if (started) return;
  try { await accountAcquirePlayLock(); }
  catch (error) { showToast(error.message, 8000); return; }
  if (started) return;
  if (!canvas) {
    setStatus("Runtime UI is not ready: canvas element missing", "err");
    return;
  }
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
    await reloadForCrossOriginIsolation("launch");
    return;
  }
  try { sessionStorage.removeItem(COI_RELOAD_KEY); } catch (_) {}
  started = true;
  document.body.classList.add("emulator-started");
  setSessionPresentation(selectedStoredGame || selectedGame?.name || "");
  setPanelOpen(false, false);
  log("Launch button clicked.", "info");
  setStartButtonMode("loading");
  const startupWatchdog = setTimeout(() => {
    if (!runtimeReady) failRuntime("Startup timed out. Export diagnostics or reload to retry.");
  }, 120000);
  window.ModuleStartupWatchdog = startupWatchdog;
  fileLabel?.classList.add("disabled");
  if (fileInput) fileInput.disabled = true;
  if (gpuSelectEl) gpuSelectEl.disabled = true;
  canvas?.focus();
  showLoading("Initializing audio\u2026");
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

  try { await selectBuildDir(); }
  catch (e) { failRuntime(e.message); return; }

  let gameArg = null;
  const chosenPowerPref = gpuSelectEl?.value || "high-performance";
  log('GPU powerPreference: "' + chosenPowerPref + '"', "info");
  if (preferences.getItem("ppsspp_touch_mouse_fallback") === "1") {
    installTouchMouseShim();
  }

  installSharedCanvasContext(canvas);
  window.Module = {
    retroAchievementsProxy: achievementsGateway(),
    canvas,
    webglContextAttributes: {
      powerPreference: chosenPowerPref,
      alpha: false, antialias: false, depth: true, stencil: true,
      preserveDrawingBuffer: true, desynchronized: false,
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
  const sessionGame = sessionGameFromBootLog(text);
  if (sessionGame) setSessionPresentation(sessionGame);
      if (!/WASM audio (push|callback) count=/.test(text)) log("stderr: " + text);
    },
    setStatus(text) { if (text) setStatus(text, "run"); },
    monitorRunDependencies(left) {
      log("Run dependencies remaining: " + left);
      if (left > 0) setStatus("Runtime init: " + left + " dependencies", "run");
    },
    preRun: [function () {
      configureEmulatorKeyboard(ENV);
      if (loadNetworkConfig().enabled && !installSockFSAdhocRelay()) throw new Error("Ad Hoc transport unavailable in WASM build");
      log("preRun started.");
      addRunDependency("ppsspp-assets");
      (async () => {
        let prepared = false;
        try {
          await preloadAssets(FS);
          // Restore persisted config and saves from OPFS
          setStatus("Restoring saves from OPFS\u2026", "run");
          showLoading("Restoring saves\u2026");
          await loadPersistedFiles(FS);
          await forceGamesDirectoryConfig(FS);
          await restoreTexturePacks(FS);
          gameArg = await preloadGame(FS);
          await preloadStoredGames(FS);
          Module.arguments.length = 0;
          Module.arguments.push(...emulatorLaunchArgs());
          if (gameArg) Module.arguments.push(gameArg);
          log("PPSSPP arguments: " + JSON.stringify(Module.arguments), "info");
          setStatus("Starting PPSSPP\u2026", "run");
          showLoading("Starting PPSSPP\u2026");
          prepared = true;
        } catch(err) {
          log("preRun failed: " + (err?.stack || err), "err");
          setStatus(err.message || String(err), "err");
          failRuntime("Startup failed: " + (err.message || String(err)));
          window.Module?.abort?.(err);
          return;
        } finally {
          log("preRun complete, removing asset dependency.");
          if (prepared) removeRunDependency("ppsspp-assets");
        }
      })();
    }],
    onRuntimeInitialized() {
      clearTimeout(window.ModuleStartupWatchdog);
      log("Runtime initialized.", "ok");
      runtimeReady = true;
      const renderedFrames = window.MainLoop?.postMainLoop;
      if (Array.isArray(renderedFrames)) {
        if (!renderedFrames.includes(cacheSessionPreview)) renderedFrames.push(cacheSessionPreview);
      } else {
        window.Module.postMainLoop = cacheSessionPreview;
      }
      setTimeout(() => { syncMenuSuspension(document.body.classList.contains("panel-open")); updateSessionDock(); }, 0);
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
      setTimeout(() => { if (runtimeReady) void persistFiles(window.FS, "init"); }, 8000);
    },
    onAbort(reason) {
      failRuntime("Runtime abort: " + reason);
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
  script.onerror = () => failRuntime("Failed to load PPSSPPSDL.js. Check the connection and reload to retry.");
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
    if (window.__ppssppRemoteTouch || !isCanvasTouch(e)) return;
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
    if (window.__ppssppRemoteTouch || !isCanvasTouch(e)) return;
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
    if (window.__ppssppRemoteTouch || !isCanvasTouch(e)) return;
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
    if (window.__ppssppRemoteTouch || !isCanvasTouch(e)) return;
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
if (fileInput) on(fileInput, "change", () => {
  selectedGame = fileInput?.files?.[0] || null;
  selectedStoredGame = null;
  if (fileLabel) fileLabel.title = selectedGame ? selectedGame.name : "Open game";
  // Update the visible text node inside the label
  const textNode = fileLabel?.firstChild;
  if (textNode && textNode.nodeType === 3)
    textNode.textContent = (selectedGame ? "\uD83D\uDCC2 " + selectedGame.name : "\uD83D\uDCC2 Open Game") + " ";
  setStatus(selectedGame ? "Selected: " + selectedGame.name : "Ready. Open a game file or use Library.");
});

on(startBtn, "click", () => {
  start();
});

on("isolationRepairBtn", "click", repairWebRuntime);
on("demoLoadBtn", "click", loadDemoCatalog);
on("demoSearch", "input", filterDemos);
on("demoRegion", "change", filterDemos);
on("demoSort", "change", filterDemos);
on("demoAllBtn", "click", () => { demoInstalledOnly = false; filterDemos(); });
on("demoInstalledBtn", "click", () => { demoInstalledOnly = true; filterDemos(); });
on("demoResetBtn", "click", resetDemoFilters);
on("demoPrevBtn", "click", () => changeDemoPage(-1));
on("demoNextBtn", "click", () => changeDemoPage(1));
on("demoActivityBtn", "click", revealDemoTransfer);
on("demoBrowseBtn", "click", () => { byId("demoTransfer").open = false; byId("demoTransferSummary").focus({ preventScroll: true }); });
on("demoDismissBtn", "click", event => { event.preventDefault(); event.stopPropagation(); dismissDemoTransfer(); });
on("demoRetryBtn", "click", () => { if (demoTransfer) downloadDemo(demoTransfer.url); });
on("demoOpenBtn", "click", () => { if (demoTransfer?.name) showGameInfo(demoTransfer.name); });
on("demoCancelBtn", "click", () => { if (demoAbort) { const focusAfterCancel = document.activeElement === byId("demoCancelBtn"); updateDemoTransfer({ cancelling: true, focusAfterCancel, detail: "Stopping the download…" }, true); demoAbort.abort(); } });
on("demoGrid", "click", event => {
  if (event.target.closest("button[data-demo-import]")) { byId("libraryImportFile").click(); return; }
  const button = event.target.closest("button[data-demo]");
  if (button) downloadDemo(button.dataset.demo);
});
document.addEventListener("focusin", updateCollectionPageStatus);
on("tabLibrary", "scroll", updateCollectionPageStatus);
on("libraryPrevBtn", "click", () => changeLibraryPage(-1));
on("libraryNextBtn", "click", () => changeLibraryPage(1));
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
on("libraryUrlForm", "submit", event => {
  event.preventDefault();
  addGameURLToLibrary(byId("libraryUrlInput")?.value || "");
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
on("savesList", "click", event => { const tile = event.target.closest("button[data-save-game]"); if (tile) showSaveInfo(tile.dataset.saveGame); });
on("saveInfoCloseBtn", "click", closeSaveInfo);
on("saveInfoModal", "click", event => { if (event.target.id === "saveInfoModal") closeSaveInfo(); });
on("saveInfoSlots", "click", async e => {
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
  if (!await confirmUI("Delete ALL save data and save states?\nThis cannot be undone.")) return;
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
on("driveConfigForm", "submit", event => {
  event.preventDefault();
  const value = (googleClientIdInput?.value || "").trim();
  if (value) preferences.setItem(GOOGLE_CLIENT_ID_KEY, value);
  else preferences.removeItem(GOOGLE_CLIENT_ID_KEY);
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
  preferences.setItem(GOOGLE_AUTO_SYNC_KEY, e.target.checked ? "1" : "0");
  restartDriveAutoSyncTimer();
  showToast(e.target.checked ? "✓ Drive auto-sync enabled" : "Drive auto-sync disabled");
});
on("driveAutoSyncInterval", "change", e => {
  preferences.setItem(GOOGLE_AUTO_SYNC_RATE_KEY, e.target.value);
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
  if (!await confirmUI("Delete ALL saved data and stored games from OPFS? This cannot be undone.")) return;
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
  return !!fullscreenElement() || document.body.classList.contains("immersive-fullscreen");
}

function fullscreenTarget() {
  return document.querySelector(".body-main") || stageEl || canvas || document.documentElement;
}

// SDL may request fullscreen directly on the canvas. Keep the shell controls
// and panels inside the fullscreen element in that path too.
for (const method of ["requestFullscreen", "webkitRequestFullscreen"]) {
  if (!canvas || typeof canvas[method] !== "function") continue;
  const nativeRequest = canvas[method].bind(canvas);
  canvas[method] = (...args) => {
    const target = fullscreenTarget();
    return target !== canvas && typeof target[method] === "function" ? target[method](...args) : nativeRequest(...args);
  };
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
  setFullscreenMenuOpen(false, false);
  syncFullscreenOverlays();
  updateFullscreenControls();
  scheduleRuntimeResize(true);
  if (fullscreenElement()) {
    document.body.classList.remove("immersive-fullscreen");
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

function updateFullscreenControls() {
  const active = isFullscreenActive();
  for (const id of ["fullscreenBtn", "dashboardFullscreenBtn"]) {
    const button = byId(id);
    if (!button) continue;
    const label = active ? "Exit fullscreen" : "Fullscreen";
    button.setAttribute("aria-label", label); button.title = label; button.setAttribute("aria-pressed", String(active));
    const text = button.querySelector("span"); if (text) text.textContent = label;
    button.classList.toggle("is-fullscreen", active);
  }
}
async function togglePPSSPPFullscreen() {
  if (fullscreenElement()) await exitBrowserFullscreen();
  else if (document.body.classList.contains("immersive-fullscreen")) document.body.classList.remove("immersive-fullscreen");
  else if (!await requestBrowserFullscreen()) document.body.classList.add("immersive-fullscreen");
  syncFullscreenOverlays(); updateFullscreenControls(); scheduleRuntimeResize(true);
}
for (const id of ["fullscreenBtn", "dashboardFullscreenBtn"]) on(id, "click", async () => {
  await togglePPSSPPFullscreen();
  if (!document.body.classList.contains("panel-open")) canvas?.focus();
});
function setFullscreenMenuOpen(open, focus = true) {
  const toggle = byId("fsMenuToggle");
  const wasOpen = toggle?.getAttribute("aria-expanded") === "true";
  toggle?.setAttribute("aria-expanded", String(open));
  if (wasOpen !== open) document.dispatchEvent(new CustomEvent("consolevisibilitychange", { detail: { open } }));
  for (const id of ["fsMenuActions", "fsMenuBackdrop"]) {
    const element = byId(id);
    if (element) element.hidden = !open;
  }
  if (focus) (open ? byId("fsPanelBtn") : toggle)?.focus({ preventScroll: true });
}
on("fsMenuToggle", "click", () => setFullscreenMenuOpen(byId("fsMenuToggle")?.getAttribute("aria-expanded") !== "true"));
on("fsMenuBackdrop", "click", () => setFullscreenMenuOpen(false));
document.addEventListener("keydown", event => {
  if (document.body.classList.contains("shared-playing")) return;
  if (document.querySelector(".console-dialog")) return;
  const panelOpen = document.body.classList.contains("panel-open");
  const menuOpen = byId("fsMenuToggle")?.getAttribute("aria-expanded") === "true";
  if (!panelOpen && !menuOpen) return;
  if (event.key === "Escape" && !byId("gameInfoModal")?.classList.contains("visible")) {
    event.preventDefault(); event.stopImmediatePropagation();
    if (panelOpen) setPanelOpen(false); else setFullscreenMenuOpen(false);
  } else if (event.key === "Tab") {
    const container = byId(panelOpen ? "sidePanel" : "fsMenuActions");
    const controls = [...(container?.querySelectorAll('button, label.btn, summary, input, select, textarea, a[href], [tabindex="0"]') || [])]
      .filter(element => !element.disabled && element.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (first && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
    }
  }
}, true);
on("fsPanelBtn", "click", () => setPanelOpen(!document.body.classList.contains("panel-open")));
on("fsExitBtn", "click", async () => {
  setFullscreenMenuOpen(false, false);
  await togglePPSSPPFullscreen();
  fullscreenBtn?.focus();
});

/* ── Init ───────────────────────────────────────────────────────── */
log("Page loaded. crossOriginIsolated=" + window.crossOriginIsolated, window.crossOriginIsolated ? "ok" : "warn");
log("Build: " + BUILD_STAMP, "dim");
probeWebGLFeatures();
updateInfoPanel();
/* ── Private server account ─────────────────────────────────────── */
let serverAccount = null, accountToken = "", accountRevision = 0;
let accountBusy = false, accountBlocked = false, accountLastHash = "";
let accountBoot = Promise.resolve();
let accountPlayLock = false;
async function accountAcquirePlayLock() {
  if (!serverAccount || accountPlayLock || !navigator.locks) return;
  await new Promise((resolve, reject) => {
    navigator.locks.request("ppsspp-account-play-" + serverAccount.id, { ifAvailable: true }, async lock => {
      if (!lock) { reject(new Error("This account is already playing in another tab. Close that tab before launching here.")); return; }
      accountPlayLock = true;
      resolve();
      // The browser releases this lock when this page closes or reloads.
      await new Promise(() => {});
    }).catch(reject);
  });
}

function accountStatus(message) {
  const el = byId("accountStatus");
  if (el) el.textContent = message;
}
function accountUI() {
  byId("accountIdentity").textContent = serverAccount ? "Signed in as " + serverAccount.name : "Guest · local saves";
  byId("accountLoginForm").hidden = !!serverAccount;
  byId("accountControls").hidden = !serverAccount;
}
async function accountRequest(route, options = {}) {
  const response = await fetch("api/account/" + route, {
    ...options, cache: "no-store", credentials: "omit",
    signal: options.signal || (route === "game" ? undefined : AbortSignal.timeout(30000)),
    headers: { "Content-Type": "application/json", ...(accountToken ? { Authorization: "Bearer " + accountToken } : {}), ...options.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Account server unavailable (" + response.status + ")");
  }
  return response;
}
function accountRemember() {
  try {
    if (serverAccount) sessionStorage.setItem("ppsspp_server_account", JSON.stringify({ ...serverAccount, token: accountToken }));
    else sessionStorage.removeItem("ppsspp_server_account");
  } catch (_) {}
}
function accountUseProfile(user) {
  serverAccount = user;
  OPFS_PERSIST_DIR = user ? "persist-user-" + user.id : "persist";
  _persistedFileState.clear(); _detectedMemstick = null;
  accountUI();
  void refreshTexturePacks();
}
async function accountBundle() {
  const files = await opfsWalk();
  return { version: 1, files: files.filter(file => !isLocalSecret(file.path)).map(({ path, data }) => ({ path, data: bytesToBase64(data) })).sort((a, b) => a.path.localeCompare(b.path)) };
}
async function accountHash(bundle) {
  const normalized = bundle.files.map(({ path, data }) => ({ path, data })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const bytes = new TextEncoder().encode(JSON.stringify(normalized));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
}
function accountSaveBase() {
  preferences.setItem("ppsspp_account_base_" + serverAccount.id, JSON.stringify({ revision: accountRevision, hash: accountLastHash }));
}
async function accountApplySnapshot(bundle) {
  // Stage the complete snapshot first. A failed/quota-limited restore never
  // removes the previously usable local copy.
  const profile = "persist-user-" + serverAccount.id;
  const stage = profile + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  const previous = OPFS_PERSIST_DIR;
  const root = await opfsRoot();
  try {
    // Preserve browser-local credentials when replacing the cloud save snapshot.
    const localSecrets = (await opfsWalk()).filter(file => isLocalSecret(file.path));
    for (const { path, data } of localSecrets) {
      const { dir, name } = await opfsParent(path, true, stage);
      await writeOpfsHandle(await dir.getFileHandle(name, { create: true }), data);
    }
    for (const { path, data } of bundle.files) {
      if (isLocalSecret(path)) continue;
      const { dir, name } = await opfsParent(path, true, stage);
      await writeOpfsHandle(await dir.getFileHandle(name, { create: true }), base64ToBytes(data));
    }
    await root.getDirectoryHandle(stage, { create: true });
    preferences.setItem("ppsspp_account_profile_" + serverAccount.id, stage);
    OPFS_PERSIST_DIR = stage;
  } catch (error) {
    OPFS_PERSIST_DIR = previous;
    try { await root.removeEntry(stage, { recursive: true }); } catch (_) {}
    throw error;
  }
  // Keep the previous generation as recovery data until the next successful restore.
  const old = preferences.getItem("ppsspp_account_previous_" + serverAccount.id);
  if (old && old !== previous && old.startsWith(profile + "-")) {
    try { await root.removeEntry(old, { recursive: true }); } catch (_) {}
  }
  preferences.setItem("ppsspp_account_previous_" + serverAccount.id, previous);
}
async function accountRefreshGames() {
  const { games } = await (await accountRequest("games")).json();
  const list = byId("accountGames");
  list.replaceChildren();
  if (!games.length) list.textContent = "No server games. Ask the administrator to add games to the library.";
  for (const game of games) {
    const row = document.createElement("div"); row.className = "action-row";
    const label = document.createElement("span"); label.textContent = game.name + " · " + formatBytes(game.size);
    const button = document.createElement("button"); button.type = "button"; button.textContent = "Install locally";
    button.onclick = () => accountAction(async () => {
      accountStatus("Downloading " + game.name + "…");
      const response = await accountRequest("game", { method: "POST", body: JSON.stringify({ name: game.name }) });
      // Stream game images to OPFS rather than buffering an entire ISO in RAM.
      const { dir, name } = await opfsParent(game.name, true, OPFS_GAMES_DIR);
      const handle = await dir.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await response.body.pipeTo(writable);
      await refreshLibrary();
      accountStatus(game.name + " installed. Open it from Library.");
    });
    row.append(label, button); list.append(row);
  }
}
async function accountPrepare() {
  const remote = await (await accountRequest("saves")).json();
  const local = await accountBundle(), hash = await accountHash(local);
  let base = {};
  try { base = JSON.parse(preferences.getItem("ppsspp_account_base_" + serverAccount.id) || "{}"); } catch (_) {}
  let hasLocalState = local.files.length > 0;
  if (!hasLocalState && typeof base.hash === "string") {
    try { await opfsDir([OPFS_PERSIST_DIR], false); hasLocalState = true; }
    catch (error) { if (error.name !== "NotFoundError") throw error; }
  }
  if (hasLocalState && hash !== base.hash && remote.revision !== (base.revision || 0)) {
    throw new Error("Both local and server saves changed. Export local saves, then use Restore server saves before playing.");
  }
  if (!hasLocalState || hash === base.hash) {
    await accountApplySnapshot(remote.bundle);
    accountLastHash = await accountHash(remote.bundle);
  } else {
    accountLastHash = base.hash || "";
  }
  accountRevision = remote.revision;
  accountSaveBase();
  accountBlocked = false;
  accountStatus("Saves ready. Automatic server backup every 30 seconds while playing.");
  await refreshSavesTab();
}
async function accountSync() {
  if (!serverAccount || accountBlocked) return;
  if (window.FS) await persistFiles(window.FS, "server");
  const bundle = await accountBundle(), hash = await accountHash(bundle);
  if (hash === accountLastHash) { accountStatus("Server backup is up to date."); return; }
  const result = await (await accountRequest("saves", { method: "PUT", body: JSON.stringify({ revision: accountRevision, bundle }) })).json();
  accountRevision = result.revision; accountLastHash = hash;
  accountSaveBase();
  accountStatus("Saves backed up to server at " + new Date().toLocaleTimeString());
}
async function accountAction(action) {
  if (accountBusy) return;
  accountBusy = true;
  try { await action(); }
  catch (error) { accountStatus(error.message); showToast(error.message, 8000); }
  finally { accountBusy = false; }
}
async function accountInitialize() {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem("ppsspp_server_account") || "null"); } catch (_) {}
  if (!saved || !/^[a-f0-9]{32}$/.test(saved.id) || typeof saved.token !== "string") { accountUI(); return; }
  accountToken = saved.token;
  accountUseProfile({ id: saved.id, name: saved.name });
  const profile = preferences.getItem("ppsspp_account_profile_" + saved.id);
  if (profile?.startsWith("persist-user-" + saved.id + "-")) OPFS_PERSIST_DIR = profile;
  accountBlocked = true;
  try {
    const user = await (await accountRequest("me")).json();
    if (user.id !== saved.id) throw new Error("Account identity changed; sign out and sign in again");
    await accountPrepare();
    await accountRefreshGames();
  } catch (error) { accountStatus(error.message); }
}

on("accountLoginForm", "submit", event => {
  event.preventDefault();
  void accountAction(async () => {
    if (started) throw new Error("Reload before changing accounts.");
    accountStatus("Signing in…");
    const password = byId("accountPassword").value;
    byId("accountPassword").value = "";
    const result = await (await accountRequest("login", { method: "POST", body: JSON.stringify({ name: byId("accountName").value, password }) })).json();
    accountToken = result.token;
    accountUseProfile({ id: result.id, name: result.name });
    const profile = preferences.getItem("ppsspp_account_profile_" + result.id);
    if (profile?.startsWith("persist-user-" + result.id + "-")) OPFS_PERSIST_DIR = profile;
    accountRemember(); accountBlocked = true;
    await accountPrepare();
    await accountRefreshGames();
  });
});
on("accountSync", "click", () => accountAction(async () => {
  if (accountBlocked) throw new Error("Resolve the connection or save conflict before syncing. Reload to retry, or export your local saves and restore the server copy.");
  try { await accountSync(); } catch (error) { accountBlocked = true; throw error; }
}));
on("accountRestore", "click", () => accountAction(async () => {
  if (started) throw new Error("Reload before restoring server saves. Export your local saves first.");
  if (!await confirmUI("Replace this account's local saves with the server copy? Export local saves first if you need to keep them.")) return;
  const remote = await (await accountRequest("saves")).json();
  await accountApplySnapshot(remote.bundle);
  accountRevision = remote.revision; accountLastHash = await accountHash(remote.bundle); accountSaveBase();
  accountBlocked = false; await refreshSavesTab(); accountStatus("Server saves restored.");
}));
on("accountRefresh", "click", () => accountAction(accountRefreshGames));
on("accountLogout", "click", () => accountAction(async () => {
  if (!accountBlocked) await accountSync();
  try { await accountRequest("logout", { method: "POST", body: "{}" }); }
  catch (error) { log("Server logout: " + error.message, "warn"); }
  serverAccount = null; accountToken = ""; accountRemember();
  location.reload();
}));
setInterval(() => {
  if (serverAccount && runtimeReady && !accountBlocked) void accountAction(async () => {
    try { await accountSync(); } catch (error) { accountBlocked = true; throw error; }
  });
}, 30000);
accountBoot = accountInitialize();

refreshLibrary();
updateStorageInfo();    // populate OPFS tab with stats on load
refreshSavesTab();      // populate Saves tab from OPFS on load (no FS needed)

/* ── PWA: Service Worker registration ──────────────────────────── */
if (window.crossOriginIsolated) void reloadForCrossOriginIsolation("already isolated");
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => reloadForCrossOriginIsolation("controllerchange"));
  navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" })
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

// Dashboard navigation reads the original device stream, before SDL filtering.
window.PPSSPPConsole = {
  nativeMenu: openNativeMenu, setOpen: setPanelOpen, setMenuOpen: setFullscreenMenuOpen, switchTab: activatePanelTab, fullscreen: togglePPSSPPFullscreen, closeGameInfo, closeSaveInfo,
  getGamepads: () => { try { return Array.from(nativeGetGamepads?.() || []); } catch (_) { return []; } },
  page: changeActiveCollectionPage,
  notify: showToast,
};


for (const [kind, gridId, inputId] of [["library", "libraryGrid", "librarySearch"], ["saves", "savesList", "savesSearch"]]) {
  on(inputId, "input", () => filterCollection(kind));
  const select = event => { const tile = event.target.closest(".collection-tile"); if (tile) byId(kind === "library" ? "librarySelection" : "savesSelection").textContent = tile.dataset.description; };
  on(gridId, "focusin", select); on(gridId, "pointerover", select);
}
on("librarySort", "change", () => { libraryPage = 1; void renderLibraryPage(); });

on("opfsFileList", "click", event => {
  const button = event.target.closest("button[data-storage-action]");
  if (!button) return;
  if (button.dataset.storageAction === "download") downloadStoredFile(button.dataset.path);
  else deleteStoredFile(button.dataset.path);
});

const menuMotionToggle = byId("menuMotionToggle");
if (menuMotionToggle) {
  menuMotionToggle.checked = preferences.getItem("ppsspp_menu_motion") !== "0";
  document.body.classList.toggle("menu-motion-off", !menuMotionToggle.checked);
  on(menuMotionToggle, "change", () => {
    preferences.setItem("ppsspp_menu_motion", menuMotionToggle.checked ? "1" : "0");
    document.body.classList.toggle("menu-motion-off", !menuMotionToggle.checked);
  });
}
document.addEventListener("visibilitychange", () => document.body.classList.toggle("document-hidden", document.hidden));
updateFullscreenControls();


function installSharedCanvasContext(source) {
  if (!source || source.__ppssppStreamContextInstalled) return;
  const getContext = source.getContext.bind(source);
  source.getContext = (type, attributes) => {
    const webgl = ["webgl", "webgl2", "experimental-webgl"].includes(type);
    const context = getContext(type, webgl ? { ...attributes, preserveDrawingBuffer: true, desynchronized: false } : attributes);
    if (webgl && context) source.__ppssppStreamContext = context;
    return context;
  };
  source.__ppssppStreamContextInstalled = true;
}
let sharedCaptureVideoTrack = null, sharedCapturePump = null, sharedCaptureFrames = 0, sharedCaptureError = "";

const sharedRemoteTouches = new Map();
function applySharedTouches(points) {
  if (!runtimeReady || runtimeFailed || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  const previous = [...sharedRemoteTouches.values()];
  const next = points.map(point => ({ ...point }));
  const ended = previous.filter(point => !next.some(p => p.id === point.id));
  const started = next.filter(point => !sharedRemoteTouches.has(point.id));
  const moved = next.filter(point => { const old = sharedRemoteTouches.get(point.id); return old && (old.x !== point.x || old.y !== point.y); });
  const position = point => ({ clientX: rect.left + point.x * rect.width, clientY: rect.top + point.y * rect.height });
  window.__ppssppRemoteTouch = true;
  try {
    if (typeof Touch === "function" && typeof TouchEvent === "function") {
      const touch = point => { const p = position(point); return new Touch({ identifier: point.id, target: canvas, ...p,
        pageX: p.clientX + (window.scrollX || 0), pageY: p.clientY + (window.scrollY || 0), radiusX: 4, radiusY: 4, force: .5 }); };
      const emit = (type, changed, active) => {
        if (!changed.length) return;
        const touches = active.map(touch);
        canvas.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: changed.map(touch) }));
      };
      emit("touchend", ended, previous.filter(point => next.some(p => p.id === point.id)));
      emit("touchstart", started, next);
      emit("touchmove", moved, next);
    } else {
      const point = next[0] || previous[0];
      if (point) {
        const p = position(point);
        canvas.dispatchEvent(new MouseEvent("mousemove", { ...p, bubbles: true, buttons: next.length ? 1 : 0 }));
        if (!previous.length && next.length) canvas.dispatchEvent(new MouseEvent("mousedown", { ...p, bubbles: true, button: 0, buttons: 1 }));
        if (previous.length && !next.length) canvas.dispatchEvent(new MouseEvent("mouseup", { ...p, bubbles: true, button: 0, buttons: 0 }));
      }
    }
  } finally { window.__ppssppRemoteTouch = false; sharedRemoteTouches.clear(); for (const point of next) sharedRemoteTouches.set(point.id, point); }
}

// Narrow bridge for streaming: guests never mount or download the host game.
window.PPSSPPSharedBridge = {
  config: loadNetworkConfig,
  title: () => byId("sessionTitle")?.textContent || "PPSSPP",
  gamepads: () => Array.from(nativeGetGamepads?.() || []),
  sharing(active) {
    const wasSharing = window.__ppssppSharing;
    window.__ppssppSharing = active;
    if (!active) { clearInterval(sharedCapturePump); sharedCapturePump = null; sharedCaptureVideoTrack = null; }
    if (active && menuSuspended && !runtimeFailed) {
      window.Module.resumeMainLoop(); menuSuspended = false;
      menuKeepaliveRelease?.(); menuKeepaliveRelease = null;
      document.body.classList.remove("session-suspended", "session-resuming");
      void unlockAudio();
    }
    if (wasSharing && !active) syncMenuSuspension(document.body.classList.contains("panel-open"));
    updateSessionDock();
  },
  async capture() {
    if (!runtimeReady || runtimeFailed || !canvas?.captureStream)
      throw new Error("Start a game on this device before sharing");
    const ctx = window.Module?.SDL2?.audioContext || trackedAudioContexts[trackedAudioContexts.length - 1];
    if (!ctx?.__ppssppCaptureDestination) throw new Error("Game audio capture is not ready");
    await ctx.resume();
    const output = document.createElement("canvas");
    output.width = canvas.width; output.height = canvas.height;
    const context = output.getContext("2d", { alpha: false });
    if (!context) throw new Error("Video capture canvas is unavailable");
    const media = output.captureStream(30);
    clearInterval(sharedCapturePump);
    const videoTrack = sharedCaptureVideoTrack = media.getVideoTracks()[0];
    sharedCaptureFrames = 0; sharedCaptureError = "";
    let timer;
    const pump = () => {
      if (videoTrack?.readyState !== "live") { clearInterval(timer); return; }
      try {
        if (output.width !== canvas.width) output.width = canvas.width;
        if (output.height !== canvas.height) output.height = canvas.height;
        context.drawImage(canvas, 0, 0);
        videoTrack.requestFrame?.(); sharedCaptureFrames++;
      } catch (error) { sharedCaptureError = error.message; }
    };
    pump();
    timer = sharedCapturePump = setInterval(pump, 33);
    for (const track of ctx.__ppssppCaptureDestination.stream.getAudioTracks()) media.addTrack(track.clone());
    return media;
  },
  captureState: () => ({ width: canvas?.width, height: canvas?.height,
    track: sharedCaptureVideoTrack?.readyState || "none", frames: sharedCaptureFrames, error: sharedCaptureError,
    preserveDrawingBuffer: canvas?.__ppssppStreamContext?.getContextAttributes()?.preserveDrawingBuffer ?? null }),
  touches: applySharedTouches,
  key(code, mapping, down) {
    if (!runtimeReady || runtimeFailed) return;
    const event = new KeyboardEvent(down ? "keydown" : "keyup", {
      code, key: mapping[0], keyCode: mapping[1], which: mapping[1], bubbles: true, cancelable: true,
    });
    // Only the allowlisted bridge caller can inject gameplay past dashboard navigation.
    window.__ppssppRemoteKey = true;
    try { canvas.dispatchEvent(event); } finally { window.__ppssppRemoteKey = false; }
  },
};

/* ── RetroAchievements: native rc_client bridge ─────────────────── */
function achievementsConfig() {
  try {
    const value = JSON.parse(preferences.getItem("ppsspp_achievements") || "{}");
    return { enabled: value.enabled === true, hardcore: value.hardcore === true, gateway: String(value.gateway || "") };
  } catch (_) { return { enabled: false, hardcore: false, gateway: "" }; }
}
function achievementsGateway(value = achievementsConfig().gateway) {
  const url = new URL(value || "/api/retroachievements", location.href);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) || url.username || url.password || url.search || url.hash)
    throw new Error("Use an HTTPS gateway URL without credentials, query or fragment.");
  return url.href.replace(/\/$/, "");
}
function achievementsNative(name, types = [], values = []) {
  const module = window.Module;
  if (!runtimeReady || typeof module?.["_PPSSPP_Achievements" + name] !== "function")
    throw new Error("Start an updated PPSSPP WASM build to use RetroAchievements.");
  module.ccall("PPSSPP_Achievements" + name, null, types, values);
}
let achievementsSignature = "", achievementsPersistSignature = "", achievementsStateSignature = "";
function renderAchievements() {
  if (menuSuspended && runtimeReady) window.Module?._PPSSPP_AchievementsPoll?.();
  const state = window.Module?.retroAchievementsState;
  const status = byId("achievementsStatus");
  if (!status) return;
  const available = runtimeReady && typeof window.Module?._PPSSPP_AchievementsLogin === "function";
  const locked = !!state?.inGame || !!state?.busy || (started && !available);
  const cfg = achievementsConfig();
  byId("achievementsEnabled").disabled = locked;
  byId("achievementsHardcore").disabled = locked;
  byId("achievementsSave").disabled = locked;
  byId("achievementsLogin").disabled = !available || !state?.enabled || locked || !!state?.loggedIn;
  byId("achievementsLogout").disabled = !available || locked || !state?.loggedIn;
  byId("achievementsUsername").disabled = locked || !!state?.loggedIn;
  byId("achievementsPassword").disabled = locked || !!state?.loggedIn;
  byId("achievementsGateway").disabled = started;
  const stateSignature = JSON.stringify([state?.enabled, state?.hardcore, state?.username]);
  if (state && stateSignature !== achievementsStateSignature) {
    achievementsStateSignature = stateSignature;
    byId("achievementsEnabled").checked = state.enabled;
    byId("achievementsHardcore").checked = state.hardcore;
    if (document.activeElement !== byId("achievementsUsername")) byId("achievementsUsername").value = state.username || "";
    const nextCfg = { ...cfg, enabled: state.enabled, hardcore: state.hardcore };
    preferences.setItem("ppsspp_achievements", JSON.stringify(nextCfg));
  }
  if (state) {
    const signature = JSON.stringify([state.enabled, state.hardcore, state.loggedIn, state.username]);
    if (signature !== achievementsPersistSignature) {
      achievementsPersistSignature = signature;
      if (window.FS) void persistFiles(window.FS, "achievements");
    }
  }
  status.textContent = !available ? (started ? "This WASM build needs the RetroAchievements update." : "Save your settings, then start PPSSPP without a game to sign in.")
    : state?.busy ? "Contacting RetroAchievements…"
    : state?.loginError ? "Sign-in failed. Check your credentials, gateway and internet connection."
    : state?.loggedIn ? "Connected as " + state.username + (state.hardcoreActive ? " · Hardcore active" : " · Softcore")
    : state?.enabled ? "Sign in with your RetroAchievements account." : "RetroAchievements is disabled.";
  byId("achievementsSessionHelp").textContent = state?.inGame
    ? "Return to the PPSSPP game browser before changing the account or mode. Restart the game after signing in."
    : "Hardcore disables save-state loading, cheats and slowdown through the emulator. Start the game after signing in.";
  const signature = JSON.stringify([state?.gameId, state?.game, state?.unlocked, state?.points, state?.achievements]);
  if (signature === achievementsSignature) return;
  achievementsSignature = signature;
  byId("achievementsGame").textContent = state?.game ? `${state.game} · ${state.unlocked}/${state.total} unlocked · ${state.points} points`
    : state?.inGame && state?.loggedIn && !state?.busy ? "No achievement set identified for this game." : "Start a supported game to see its achievements.";
  const list = byId("achievementsList");
  list.replaceChildren();
  for (const item of state?.achievements || []) {
    const row = document.createElement("li");
    const title = document.createElement("strong"), description = document.createElement("p");
    title.textContent = `${item.unlocked ? "✓ " : ""}${item.title} · ${item.points} points`;
    description.textContent = item.description + (!item.unlocked && item.progress ? " · " + item.progress : "");
    row.append(title, description);
    row.classList.toggle("achievement-unlocked", item.unlocked);
    list.append(row);
  }
}
on("achievementsSettings", "submit", event => {
  event.preventDefault();
  try {
    const gateway = achievementsGateway(byId("achievementsGateway").value.trim());
    const cfg = { enabled: byId("achievementsEnabled").checked, hardcore: byId("achievementsHardcore").checked, gateway };
    if (runtimeReady) achievementsNative("Settings", ["number", "number"], [Number(cfg.enabled), Number(cfg.hardcore)]);
    preferences.setItem("ppsspp_achievements", JSON.stringify(cfg));
    byId("achievementsStatus").textContent = "Settings saved.";
  } catch (error) { byId("achievementsStatus").textContent = error.message; }
});
on("achievementsLoginForm", "submit", event => {
  event.preventDefault();
  const password = byId("achievementsPassword");
  try {
    achievementsNative("Login", ["string", "string"], [byId("achievementsUsername").value.trim(), password.value]);
    byId("achievementsStatus").textContent = "Signing in…";
  } catch (error) { byId("achievementsStatus").textContent = error.message; }
  finally { password.value = ""; }
});
on("achievementsLogout", "click", () => {
  try { achievementsNative("Logout"); }
  catch (error) { byId("achievementsStatus").textContent = error.message; }
});
const initialAchievements = achievementsConfig();
if (byId("achievementsEnabled")) {
  byId("achievementsEnabled").checked = initialAchievements.enabled;
  byId("achievementsHardcore").checked = initialAchievements.hardcore;
  byId("achievementsGateway").value = initialAchievements.gateway;
  renderAchievements();
  setInterval(() => { if (byId("tabAchievements")?.classList.contains("active")) renderAchievements(); }, 1000);
}


// Texture packs are immutable local assets, separate from save/cloud snapshots.
// A Web Lock covers reads and commits across tabs, while persistQueue coordinates boot.
function textureProfile() {
  return serverAccount ? "textures-user-" + serverAccount.id : "textures";
}
let textureFallbackQueue = Promise.resolve();
async function textureOperation(action, profile = textureProfile()) {
  const run = async () => action(await (await opfsRoot()).getDirectoryHandle(profile, { create: true }));
  if (navigator.locks?.request) return navigator.locks.request("ppsspp-" + profile, run);
  const task = textureFallbackQueue.then(run);
  textureFallbackQueue = task.catch(() => {});
  return task;
}
async function refreshTexturePacks() {
  const list = byId("texturePackList");
  if (!list) return;
  const profile = textureProfile();
  try {
    const packs = await textureOperation(root => window.PPSSPPTextures.list(root), profile);
    if (profile !== textureProfile()) return;
    list.replaceChildren();
    for (const pack of packs) {
      const row = document.createElement("div");
      row.className = "action-row";
      const label = document.createElement("span");
      label.textContent = pack.id + " · " + pack.files.length + " files · " + formatBytes(pack.bytes);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Remove " + pack.id;
      button.addEventListener("click", async () => {
        if (!await confirmUI("Remove replacement textures for " + pack.id + "? Restart the emulator to apply.")) return;
        if (profile !== textureProfile()) return;
        await runTextureTask(() => textureOperation(root => window.PPSSPPTextures.remove(root, pack.id), profile));
      });
      row.append(label, button);
      list.append(row);
    }
    if (!packs.length) list.textContent = "No texture packs installed.";
  } catch (error) {
    list.textContent = "Texture storage unavailable: " + error.message;
  }
}
let textureBusy = false;
async function runTextureTask(action) {
  if (textureBusy) return;
  textureBusy = true;
  const status = byId("textureStatus");
  const controls = [byId("textureZipInput"), byId("textureFolderInput"), byId("textureGameID")];
  controls.forEach(node => { if (node) node.disabled = true; });
  const task = persistQueue.then(action);
  persistQueue = task.catch(() => {});
  try {
    await task;
    status.textContent = "Texture packs saved. Restart the emulator to apply the changes.";
    showToast(status.textContent, 7000);
  } catch (error) {
    status.textContent = "Texture operation failed: " + error.message;
    log(status.textContent, "err");
  } finally {
    textureBusy = false;
    controls.forEach(node => { if (node) node.disabled = false; });
    await refreshTexturePacks();
    void updateStorageInfo();
  }
}
async function importTexturePack(files, zipped) {
  if (!files.length || textureBusy) return;
  const profile = textureProfile();
  const selectedID = byId("textureGameID").value;
  await runTextureTask(async () => {
    const id = window.PPSSPPTextures.gameID(selectedID);
    const status = byId("textureStatus");
    status.textContent = "Checking texture pack…";
    let entries;
    if (zipped) {
      if (files[0].size > window.PPSSPPTextures.MAX_BYTES) throw new Error("ZIP exceeds 512 MiB");
      entries = await window.PPSSPPDemos.unzip(new Uint8Array(await files[0].arrayBuffer()), event => {
        status.textContent = "Extracting textures: " + formatBytes(event.completed) + " / " + formatBytes(event.total);
      }, { maxEntries: 24000 });
    } else {
      entries = files.map(file => ({ name: file.webkitRelativePath, file }));
    }
    const plan = window.PPSSPPTextures.prepare(entries, id);
    if (profile !== textureProfile()) throw new Error("The browser profile changed. Import the pack again.");
    await textureOperation(async root => {
      const existing = await window.PPSSPPTextures.list(root);
      if (existing.some(pack => pack.id === id) && !await confirmUI("Replace all installed textures for " + id + "?")) {
        throw new Error("Replacement cancelled; the installed pack is unchanged.");
      }
      await window.PPSSPPTextures.install(root, plan, (done, total) => {
        status.textContent = "Saving textures: " + done + " / " + total;
      });
    }, profile);
  });
}
on("textureZipInput", "change", async event => {
  const files = Array.from(event.target.files || []);
  try { await importTexturePack(files, true); } finally { event.target.value = ""; }
});
on("textureFolderInput", "change", async event => {
  const files = Array.from(event.target.files || []);
  try { await importTexturePack(files, false); } finally { event.target.value = ""; }
});
async function restoreTexturePacks(FS) {
  await persistQueue;
  if (!hasOPFS()) return;
  await textureOperation(async root => {
    const memstick = detectMemstickDir(FS);
    const packs = await window.PPSSPPTextures.restore(root, FS, memstick);
    if (!packs.length) return;
    // Enable replacement in the base config and existing per-game overrides.
    for (const name of ["ppsspp.ini", ...packs.map(pack => pack.id + "_ppsspp.ini")]) {
      const path = memstick + "/PSP/SYSTEM/" + name;
      let text;
      try { text = new TextDecoder().decode(FS.readFile(path)); }
      catch (error) { if (name !== "ppsspp.ini") continue; text = ""; }
      fsMkdirP(FS, dirname(path));
      FS.writeFile(path, new TextEncoder().encode(patchIniValue(text, "Graphics", "ReplaceTextures", "True")));
    }
    log("Restored " + packs.length + " replacement texture packs.", "ok");
  });
}
void refreshTexturePacks();
