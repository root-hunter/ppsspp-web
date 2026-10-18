# Multiplayer validation — 2026-10-18

Core base: `0dbfaca62a8a924abc2c5dd5dd0733b668e5e68a`. Changes remain in the working tree, including the core submodule; `patches/ppsspp-wasm-adhoc.patch` preserves the core diff. No commercial game image is included.

## Automated checks

- Python relay: `python3 -m unittest discover -s server/tests -v` — 15 wire-level tests, including receive-only busy-socket heartbeat regression.
- Runtime and transport: `cd wasm-page && npm test` — 24 runtime tests and 7 transport tests after the pacing change.
- Emscripten 6.0.12: `cmake --build deps/ppsspp-wasm/build-wasm-multiplayer -j6` — successful instrumented build with WASM_ADHOC_TESTS=ON. Existing linker warnings concern SDL2 incoming API, pthread/memory growth and deprecated WASM_BIGINT.
- Docker Compose rebuilt the Angular application and relay successfully. The validation override mounts `build-wasm-multiplayer` as the served release directory; a normal deployment must rebuild its own release core.
- Real-WASM browser protocol integration passed again after the pacing changes, using visible hardware-accelerated Chrome (headless=false): C++ socket probes over actual WSS, PDP boundaries/order/broadcast, PTP accept/bidirectional traffic/close and native WLAN/nickname/relay-mode configuration. The homebrew cube booted with PSP_IsInited true. See `artifacts/multiplayer/browser-protocol.json`.
- Native networking translation units passed syntax checks earlier. A full native build was not completed: the existing debug build directory lacked build.ninja.

## Real Tekken test

The user-supplied European Tekken 6 dump identifies as ULES01376, and uses Ad Hoc product ID NPJH50184 / group BTLLOBBY. Both clients used the same local Docker relay and separate browser contexts. Chrome windows remained visible, initially using AMD Radeon hardware through ANGLE/radeonsi; the latest SystemInfo capture reports an NVIDIA GTX 1650 Ti. Both report hardware WebGL, not SwiftShader. GPU selection changed during the session, so these measurements are not a controlled benchmark across identical GPU conditions. GPU details and combat screenshots are in `artifacts/multiplayer/`.

Native game lobby discovery, peer matching, character selection and actual combat were reached on both clients. The user confirmed multiplayer connectivity. Initial syncing failures exposed the relay receive-only heartbeat bug, now covered by a regression test. Stopping/rebuilding the relay caused the game's expected network error rather than a core hang.

Measured combat performance before the pacing correction was about 27 VPS (PSP emulation updates per real second). Relay RTT was normally below 2 ms with near-empty queues, so relay transit was not the dominant delay. Faster browser callbacks alone produced about 40–45 VPS. With adaptive skipping enabled and a 4 ms callback interval, a ten-second combat sample measured 57.9–61.9 VPS and 41–47 drawn FPS. A preceding eight-second sample measured 59.5–60.2 VPS and 42–49 drawn FPS. With the subsequent clock gate enabled, paired ten-second samples recorded 58.6–60.7 VPS / 30–31 drawn FPS on player 1 and 57.7–61.5 VPS / 29–39 drawn FPS on player 2, with zero transport errors. Raw samples are `artifacts/multiplayer/tekken-performance-player1.json` and `tekken-performance-player2.json`. These are local observations, not a 60 rendered FPS guarantee. Menu FPS were not used as combat evidence.

The final controlled combat sample (15 seconds on both players, without concurrent screenshots or manual input) recorded player 1 at 59.07–60.79 VPS, mean 59.92, and 35–41 drawn FPS; player 2 at 58.16–62.24 VPS, mean 60.04, and 35–45 drawn FPS. Both had zero transport errors. See `artifacts/multiplayer/tekken-controlled-player1.json` and `tekken-controlled-player2.json`. A separate sample taken while capturing screenshots had larger transient drops and is retained as `tekken-final-player*.json`; do not confuse it with the controlled sample.

A static menu check after adding the emulated-clock gate measured 59.8–60.2 VPS, preventing the approximately 170 VPS seen with only a faster timer and adaptive skipping. The final gate also allows a display period of work before the completion deadline.

The built test core has FFmpeg disabled; some FMV/audio paths are consequently unavailable and emitted decoder errors. Validate a normal FFmpeg-enabled release separately.

## Remaining acceptance checks

Do not treat this as full compatibility certification. A deliberately observed complete rematch, independent internet connections, sustained WAN latency/jitter, production trusted TLS, and other game versions remain to be validated. The Python delay/jitter test exercises transport behavior, not Tekken gameplay under WAN conditions. Two local browser contexts are not a substitute for two physical clients. Native desktop/Android clients do not speak this WebSocket relay protocol without an adapter.

## Follow-up: receive waits and real simulation progress

The user reported severe remaining lag after the earlier adaptive-skipping changes. Therefore the earlier ~60 VPS results must not be read as proof that Tekken simulation or input response ran at full speed. Receive waits could keep the browser occupied while WebSocket delivery needed that same thread.

The follow-up experiment ended a host slice when a gameplay PDP receive found no data, while retaining EAGAIN and the existing HLE wait scheduling. With skipping disabled it measured approximately 48–52 VPS/drawn FPS over ten seconds; prompt scheduling after a yield measured approximately 47–59 VPS/drawn FPS. A live hardware-skinning trial made performance worse (about 20–24 FPS) and was reverted. These experiments motivated the compiled `YieldAdhocReceiveToBrowser` path. It runs only on the Emscripten main runtime thread while the CPU is running; it does not synthesize a vblank or modify game memory. Native lag-sync sleeps and frame skipping are disabled in the default web multiplayer profile.

An actual post-match result/rematch menu was captured (`artifacts/multiplayer/tekken-completed-match.png`, 1 win / 0 losses on player 1). This records a completed local match, not a completed rematch or WAN validation.
