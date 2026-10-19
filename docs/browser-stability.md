# Browser stability and compatibility

Feedback source: https://www.reddit.com/r/PSP/comments/1ts2j5h/i_turned_ppsspp_into_a_browser_app_and_it/

These reports are observations from users, not verified compatibility results.

| Report | Finding / change | Remaining validation |
| --- | --- | --- |
| God of War black screens after New Game; Dissidia idle movie freezes; Peace Walker cutscenes fail | The previous build explicitly disabled FFmpeg. Web builds now compile the bundled FFmpeg and link video/audio decoding. Decoder-internal threading is disabled to avoid exhausting the browser worker pool; libraries still use the core's pthread/SIMD ABI. | Test each movie in the actual games. FFmpeg availability does not establish game compatibility. |
| Stuck at Starting PPSSPP; ISO/CSO storage failures | Failed startup preparation no longer releases the dependency and starts a partially prepared core. A startup timeout, recovery UI and diagnostic export explain failures. Missing core files are checked together. | Real devices and large game files, with denied/full storage and interrupted downloads. |
| Brave does not start | Preferences tolerate blocked localStorage. Cache denial/quota no longer prevents the service worker from applying isolation headers or serving a successful network response. | Brave Shields and different privacy policies can still block threads, graphics or storage. Test on Brave itself. |
| Filter changes crash and require clearing site data | Reset settings in System, or after a reported crash; config backups are retained. Games, save data and controls.ini are preserved. GPU context loss displays recovery actions. | Shader compilation/rendering defects remain core issues. No claim that every shader now works. |
| Mortal Kombat Unchained at 6 FPS on Galaxy A56 | Removed full-disc metadata reads, duplicate MEMFS game copies, automatic preload-all migration and offscreen log rendering. URL/Drive game downloads stream to OPFS with backpressure and abort the transaction on failure. Startup mounts only games explicitly marked for preload, including when another game is launched directly. Selected preloads have no shell-imposed size cutoff; their contents use browser memory. | Measure real emulated FPS, audio underruns and memory on the A56. The browser's rAF cadence is labelled Hz, not game FPS. |
| Import native PSP saves / mounted Drive saves | Saves accepts a native SAVEDATA folder or an individual game save folder, retaining slot names. Existing bundle import/export and Drive sync remain available. | Test with actual SFAlpha3 and Dissidia saves. This is folder import, not live OS-folder synchronisation. |
| Assassin's Creed loading loop; Size Matters/FIFA/GTA black screens | Improved diagnostics and codec support address possible causes. | Still unverified. Do not label fixed without reproducing the same game/build/browser combination. |

## Checks

- `npm --prefix wasm-page test`: allocation boundaries, malformed ISO metadata, explicit startup mounts, settings preservation, serial persistence, failed deletion retry, settings recovery, blocked storage/cache, failed startup dependency handling and native save paths.
- `npm --prefix wasm-page run build`: production UI compilation.
- `make wasm-release`: builds FFmpeg and the release emulator. The first codec build is slower; subsequent builds reuse its configuration and incremental objects.
- `make app-build-pages`: refuses a CMake build configured with FFmpeg disabled and writes one content-derived cache revision for JS/WASM/data. Publish all artifacts together.

For a decoder smoke test, generate a three-frame blue 480x272 H.264 video with a local native FFmpeg, compile `wasm-page/tests/ffmpeg-smoke.c` with Emscripten and the five built static libraries, and embed the sample as `/test.h264`. This checks decoded frames and decoder registration, independent of copyrighted games. `scripts/test-ffmpeg-wasm.sh` performs those steps (requires native `ffmpeg`, Emscripten and Node).

## Device test procedure

1. Export a diagnostic report from System; review it before sharing. Reports contain browser/GPU details, graphics/audio settings, file names and recent logs. They exclude save contents and authentication storage; nothing is uploaded automatically.
2. Record the game ID/version, browser version, device/GPU, internal resolution, elapsed time to failure and exact trigger. Do not infer gameplay FPS from browser refresh cadence.
3. Exercise a fresh launch, game boot, title-menu idle movie, New Game, cutscenes, save/load and reloading the page. Test ISO and compressed formats separately.
4. Check storage denial/quota and GPU context loss. Recovery should preserve already persisted progress. Background sync is best effort: an abrupt tab/process kill can still lose progress since the last successful sync.
5. Compare the same game scene and settings before/after on the same device. No numerical speedup is claimed without those measurements.

## Validation performed on 2026-10-18

- 21 runtime/service-worker regression tests passed; production Angular build and static packaging passed.
- Bundled FFmpeg and the complete Release emulator compiled with Emscripten 6.0.5, SIMD and pthread ABI. FFmpeg decoder-internal threading is disabled.
- The codec smoke test decoded three synthetic 480x272 H.264 frames and confirmed ATRAC3, ATRAC3+, AAC, MP3 and MPEG-PS registration.
- Headless Chrome with SwiftShader booted and rendered the bundled `pspautotests/demos/cube.pbp` for over one minute; AudioContext reached running state and configuration was persisted. A simulated context-loss event displayed recovery. This demo does not validate audible game audio.
- Browser integration with localStorage denied imported a native save folder, reset a bad settings file with a backup, retained the save marker and exported a report without save contents.
- Full commercial-game compatibility and combat performance remain unverified. Limited Ghost of Sparta startup, menu and movie measurements are documented in [the performance report](god-of-war-performance.md). Galaxy A56, Brave and Edge remain device/browser test targets.

## Toolchain upgrade validation (2026-10-18)

- Angular/CLI/build/compiler 22.2.3, Lucide 1.59.0 and TypeScript 6.0.3; the official Angular migration ran and unused `baseUrl` was removed for TypeScript 6. Strict checks remain enabled.
- Node 24.22.0 LTS and npm 12.2.0 passed the 21 runtime tests and production UI build. Dependency installation/audit reported zero known vulnerabilities after compatible transitive patch updates.
- Emscripten 6.0.12 rebuilt FFmpeg and the complete Release core with LTO, SIMD and pthreads. The H.264 decoder smoke test passed with the new SDK.
- The updated Angular UI passed the browser import/reset/diagnostic checks. The new LTO core booted and rendered `cube.pbp` in Chrome/SwiftShader; AudioContext reached running state.
- The static Pages artifact was packaged with the matched new JS/WASM/data revision. CI and the Docker UI stage now pin the documented toolchain versions. The CI deployment and Docker image build were not run locally.
- This establishes build/startup compatibility, not a measured gameplay FPS improvement. Commercial-game/device compatibility remains subject to the tests above.

## Startup settings and automount

The Startup profile selector has been removed. Startup preserves saved graphics,
timing, audio and touch preferences; web defaults only fill missing INI keys.
No resolution, texture scaling, MSAA or anisotropic filtering profile is applied.
Multiplayer still disables native lag-sync sleeps to allow browser relay delivery,
while preserving the user's frame skipping settings.
Previously overwritten values cannot be recovered automatically: change them in
PPSSPP and let storage sync complete (or use Storage → Save Now) before reloading.

Games explicitly marked for preload mount at startup even when launching another
game directly. There is no 128/256 MiB cutoff. Unmarked games stay in OPFS;
the selected launch game is loaded once. Preloads currently copy into MEMFS,
so the total selected library must fit the device's available browser memory.
A failed mount is logged and the remaining selected games are still attempted.

The shell no longer rebuilds the controller selector when its device list is
unchanged, skips discovery polling in hidden tabs and releases the temporary GPU
probe context. Logs remain in the bounded diagnostic buffer; console mirroring
is limited to errors unless `ppsspp_verbose_console=1` is set in localStorage.
The core builds with SIMD, pthreads and O3 via the web Makefile. LTO is disabled
by default following the game-launch freeze report below.
No core rebuild is required for these shell changes.

Validation: 23 runtime tests and the production Angular build passed. No gameplay
FPS gain is claimed. Compare the same save/scene, browser, GPU, core revision and
power mode after warmup, using PPSSPP's FPS/speed display and audio underruns.
The shell's “Hz · browser” measures browser callbacks, not emulated frames.
For CPU/GPU attribution, capture a browser Performance trace of that same scene;
1× rendering primarily reduces GPU work and cannot remove a CPU emulation bottleneck.

## God of War profiling

See [the measured Ghost of Sparta report](god-of-war-performance.md) for CPU profiles,
real AMD GPU results, the rejected lag-sync experiment and a repeatable capture script.
The original timing remains enabled: disabling it doubled the opening movie speed.

## LTO game-launch freeze

With LTO enabled, the emulator UI was reported to start successfully while
launching games froze the entire browser page. The root cause has not been
isolated. `WASM_ENABLE_LTO=OFF` is the current default in the web Makefile and
core release configuration; the Pages workflow inherits the web default.

Keep LTO disabled for normal builds:

```sh
make wasm-release WASM_ENABLE_LTO=OFF
```

This reconfigures and rebuilds the core; changing the Makefile alone does not
replace existing JS/WASM artifacts. Package the rebuilt matching artifacts
before testing a deployed build. Earlier LTO build, homebrew and profiling
results in this document describe limited historical checks and do not resolve
the reported freeze. Reproduce the same game, browser and toolchain with and
without LTO before attributing the failure to a specific compiler optimization.

The [CI freeze investigation](ci-game-launch-investigation.md) records the two
published artifact revisions and tests of both direct and in-emulator game launch.
The initial artifact launched locally on Chrome/AMD; the reported freeze remains
unreproduced in that environment. The user confirmed that the later non-LTO
online build restored launching.

## Mobile fullscreen controls and panels

Tap the small “···” button in fullscreen to access Settings & library or Exit
fullscreen. Tap outside the menu to dismiss it. Opening the panel hides these
controls; its close button remains available. On mobile, the panel starts closed
regardless of a previously saved desktop panel preference.

Each mobile panel section uses one touch-scroll area beneath its fixed status
and section controls. Form text is at least 16px to avoid iOS focus zoom without
disabling pinch zoom. Portrait uses a bottom sheet; short landscape uses a side
drawer. Opening either leaves the game canvas dimensions unchanged.

Chrome touch emulation checks passed at 390×844, 844×390 and 667×375, alongside
1440×900 desktop checks. Physical iOS/Safari behavior remains unverified.
