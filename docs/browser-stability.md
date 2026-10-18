# Browser stability and compatibility

Feedback source: https://www.reddit.com/r/PSP/comments/1ts2j5h/i_turned_ppsspp_into_a_browser_app_and_it/

These reports are observations from users, not verified compatibility results.

| Report | Finding / change | Remaining validation |
| --- | --- | --- |
| God of War black screens after New Game; Dissidia idle movie freezes; Peace Walker cutscenes fail | The previous build explicitly disabled FFmpeg. Web builds now compile the bundled FFmpeg and link video/audio decoding. Decoder-internal threading is disabled to avoid exhausting the browser worker pool; libraries still use the core's pthread/SIMD ABI. | Test each movie in the actual games. FFmpeg availability does not establish game compatibility. |
| Stuck at Starting PPSSPP; ISO/CSO storage failures | Failed startup preparation no longer releases the dependency and starts a partially prepared core. A startup timeout, recovery UI and diagnostic export explain failures. Missing core files are checked together. | Real devices and large game files, with denied/full storage and interrupted downloads. |
| Brave does not start | Preferences tolerate blocked localStorage. Cache denial/quota no longer prevents the service worker from applying isolation headers or serving a successful network response. | Brave Shields and different privacy policies can still block threads, graphics or storage. Test on Brave itself. |
| Filter changes crash and require clearing site data | Reset settings in System, or after a reported crash; config backups are retained. Games, save data and controls.ini are preserved. GPU context loss displays recovery actions. | Shader compilation/rendering defects remain core issues. No claim that every shader now works. |
| Mortal Kombat Unchained at 6 FPS on Galaxy A56 | Removed full-disc metadata reads, duplicate MEMFS game copies, automatic preload-all migration and offscreen log rendering. URL/Drive game downloads stream to OPFS with backpressure and abort the transaction on failure. Preloads have 128 MiB mobile / 256 MiB desktop budgets; launching a selected game skips library preloads. New mobile configs start at 1x PSP resolution. | Measure real emulated FPS, audio underruns and memory on the A56. The browser's rAF cadence is labelled Hz, not game FPS. |
| Import native PSP saves / mounted Drive saves | Saves accepts a native SAVEDATA folder or an individual game save folder, retaining slot names. Existing bundle import/export and Drive sync remain available. | Test with actual SFAlpha3 and Dissidia saves. This is folder import, not live OS-folder synchronisation. |
| Assassin's Creed loading loop; Size Matters/FIFA/GTA black screens | Improved diagnostics and codec support address possible causes. | Still unverified. Do not label fixed without reproducing the same game/build/browser combination. |

## Checks

- `npm --prefix wasm-page test`: allocation boundaries, malformed ISO metadata, preload budgets, serial persistence, failed deletion retry, settings recovery, blocked storage/cache, failed startup dependency handling and native save paths.
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
- No commercial game compatibility or numerical gameplay speedup has been verified in this workspace. Galaxy A56, Brave and Edge remain device/browser test targets.
