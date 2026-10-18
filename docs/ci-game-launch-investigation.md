# CI game-launch freeze investigation

Investigation date: 2026-10-18. Site: https://root-hunter.github.io/ppsspp-web/.

## Report and current policy

The previous online build started the emulator UI but froze the page when a game
was selected. The user confirmed that the subsequent build with LTO disabled
restored game launching. Keep `WASM_ENABLE_LTO=OFF`; the underlying cause has not
been isolated.

## Verified build transition

The site served two revisions during the investigation:

| Snapshot | Packaged revision | WASM SHA-256 |
| --- | --- | --- |
| Initial | `77b6a03ff5f281568e056bb26b5fab0187f2fed284270d8787ebd6fc7dde235e` | `8190e72d10eb31e38d4d94bb327e58b68769e705397ad7bb9e097e997a8c549d` |
| Later | `aad944f1e470201c5032e296248ff5364b03c223212a602a8acefb83ed26c4ec` | `77debef0285ba73ad2ea984deb26f57e12d7cebfd6a78c26541e59e36dceb836` |

For each snapshot, recomputing the combined JS/WASM/data revision matched its
published `build-info.json`. Neither downloaded set was internally mixed.

The [preceding pipeline](https://github.com/root-hunter/ppsspp-web/actions/runs/39135043346)
used commit `1b725c7636255b90153dead0b4f5687284be00a0`, whose web Makefile defaulted
to LTO ON. The [latest pipeline](https://github.com/root-hunter/ppsspp-web/actions/runs/39136785061)
used commit `fd02cf11a5fae83fe028d66cb6e978f48e326667`, whose default was OFF.
Build metadata does not record compiler flags or source commits, so policy and
artifact identity should remain separate evidence.

An old HTML response referenced a JavaScript bundle that subsequently returned
404. The test browser had already cached that bundle, allowing recovery of the
original shell for local testing. This establishes an update transition, not the
cause of the reported game-launch freeze.

## Reproduction results

Environment: Chrome 155 on Linux, separate browser profile, AMD Radeon Graphics
through ANGLE OpenGL ES 3.2. Game: Ghost of Sparta USA, UCUS98737.

- The later revision launched the game directly on Pages with cross-origin
  isolation enabled.
- The initial snapshot was served locally without recompiling its core, with
  COOP/COEP headers. Direct startup with the ISO reached the menu and opening movie.
- The initial snapshot was also tested by starting the emulator without a game,
  loading the ISO afterward, then clicking its tile inside PPSSPP. The game booted
  and the browser remained responsive during the recorded capture.

The immediate freeze was not reproduced in this environment. These limited
checks do not invalidate the user's failure or establish LTO stability across
browsers, GPUs, games or persisted settings. They do show that the initial
artifact does not freeze unconditionally on every game launch.

## Remaining diagnostic step

Capture the main-thread stack in the affected browser using the previous
artifact and the same settings that trigger the freeze. A paused stack can
separate an emulation loop, a wait/deadlock, memory allocation and a graphics-driver
stall. Compare the same artifact in a clean profile and record browser version,
renderer, internal resolution and actual resource hashes before changing flags.

Evidence is stored in `artifacts/ci-freeze/`: `provenance.json` records hashes and
pipeline commits; `pages-new-revision` and `old-ci-after-library-click` contain
CPU profiles, screenshots and environment/audio snapshots. The latter capture
covers startup after selecting the game, not a combat benchmark.
