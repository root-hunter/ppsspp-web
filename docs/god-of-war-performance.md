# God of War: Ghost of Sparta performance

Measured on 2026-10-18 with the USA release, **UCUS98737**. Coverage includes
startup, the animated menu, difficulty selection and the opening movie.
Combat performance and full game compatibility remain unverified.

**Current build policy:** LTO is disabled by default after a report that enabling
it allows the emulator UI to start but freezes the page when launching games.
The captures below used an earlier LTO build and are historical observations,
not validation of the current non-LTO build or a guarantee of LTO stability.
Repeat the measurements with LTO disabled before using them as a baseline.

## Test configuration

- Chrome 155 on Linux with cross-origin isolation enabled.
- PPSSPP 1.20.4-wasm Release; Emscripten 6.0.12, FFmpeg, SIMD, pthreads and LTO.
- Performance profile: PSP 1× resolution, no frame skipping.
- Hardware renderer: AMD Radeon Graphics, radeonsi renoir ACO, ANGLE OpenGL ES 3.2.
- CPU captures: 15–20 seconds, requested sampling interval of 1 ms.

FPS and emulation speed come from PPSSPP's overlay. The shell's “Hz · browser”
badge measures browser callbacks. Profile percentages are weighted by sample
intervals and describe sampled main-thread time, not total CPU or GPU utilization.

## Results

| Capture | Result |
| --- | --- |
| Hardware, original timing, menu | 60/60 FPS, 99.9% speed |
| Hardware, original timing, opening movie | 30/30 FPS, 99.8% speed |
| Hardware, menu, 20.082 seconds | IR interpreter loop: 30.48% self time; lag-sync wait: 25.04% inclusive time |
| Hardware, menu, same capture | Vertex decoding: 6.07% self time; weight/normal/position skinning: 2.99% / 2.75% / 2.00% |
| Hardware, movie, 20.058 seconds | Lag-sync wait: 79.17% inclusive time |
| Software renderer, original timing, menu | About 14 FPS; unsuitable as a hardware GPU benchmark |
| Hardware, experimental lag sync disabled | Menu reached about 60 FPS, but the movie ran at 60/30 FPS and 200.1% speed; change rejected |

The hardware menu capture recorded 12 new audio underruns in 20 seconds.
Audible output was not checked; profiling and main-thread scheduling can affect
this counter. GPU execution time was not measured with timer queries.

## Main findings

**Frame pacing consumes substantial CPU time.** Captured stacks show:

```text
hleLagSync → nanosleep → _do_futex_wait → emscripten_get_now → performance.now
```

The shell enables `ForceLagSync2`. Emscripten implements blocking waits on the
browser main thread through polling because `Atomics.wait` is unavailable there.
Disabling lag sync removed this cost but doubled movie speed, so the original
setting remains enabled. A replacement must yield to the browser while preserving
PSP timing, audio and 30/60 FPS transitions.

**The IR interpreter and geometry processing are the main measured computation
costs in the menu.** `IRJit::RunLoopUntil` runs the IR interpreter in this build;
the name does not imply native JIT compilation. Emulation and rendering run on
the browser main thread. Increasing the pthread pool does not parallelize them.

**Large ISO loading has a separate memory cost.** The 1.75 GB ISO was loaded
entirely into MEMFS, taking roughly 18–27 seconds to prepare. The fast-mount path
requires `FileReaderSync`, which is unavailable on the main thread.

**The captures do not justify disabling framebuffer readbacks.** An instrumented
software-renderer menu capture observed no `readPixels`, `finish`,
`getBufferSubData` or `clientWaitSync` calls. WebGL host-call timings do not measure
asynchronous GPU execution or establish behavior in other scenes.

## Optimization priorities

1. Replace polling waits with cooperative browser scheduling. Validate normal
   speed, movie transitions, audio and fast-forward before changing the default.
   Moving emulation to a worker also requires adapting GL queues, input and storage.
2. Profile a repeatable combat scene before optimizing IR dispatch, fused
   operations or memory access. SIMD and O3 remain enabled; keep LTO disabled
   while investigating the game-launch freeze.
3. Compare software skinning with shader skinning on real hardware, then assess
   explicit SIMD in the measured vertex-decoder loops.
4. Add bounded, block-based ISO access on a worker to reduce startup memory and
   loading time. Measure gameplay effects separately.
5. Investigate redundant uniform and vertex-attribute updates after the larger
   CPU costs; the current captures do not establish a GPU bottleneck on hardware.

## Capture a comparable profile

Start Chrome with a separate profile:

```sh
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/ppsspp-profile
```

Open the local app, start the game and reach the desired scene. From the
`ppsspp-web` directory:

```sh
node scripts/profile-browser.mjs --port 9222 --seconds 20 --out artifacts/gow-profile/new-scene
```

The script records a CPU profile, screenshot, renderer, timing configuration and
audio counters without changing game settings or controls. Compare the same
save, camera, resolution and GPU after warmup. Import `.cpuprofile` files into
Chrome DevTools Performance.

Session captures are in `artifacts/gow-profile/`. The principal captures are
`hardware-original-menu` and `hardware-original-cutscene`; their JSON files
contain the before/after environment and counters. `hardware-video-unsafe-speed.png`
records the rejected timing experiment.

The named profiles apply only to the tested WASM, SHA-256
`3d73f17aed8ade54c59386493ff4f7b210758a1f05b852dad66a55237886379f`.
Names were matched through unique normalized WAT bodies after a symbol-producing
relink reordered function indices. Ambiguous functions remain numeric; these
profiles do not provide DWARF source-line mappings.
