# ppsspp-web

Web shell and local server for the PPSSPP WebAssembly build.

This repository contains:

- `wasm-page/`: Angular app, browser UI, service worker, manifest, and icons.
- `server/`: HTTPS server with COOP/COEP headers and the browser ad hoc WebSocket relay.

The emulator source and WebAssembly build outputs live in `deps/ppsspp-wasm`,
the pinned Git submodule used for reproducible checkouts and local development.
If you temporarily want to use a separate checkout, override
`WASM_ROOT=/path/to/ppsspp-wasm`.

## Checkout

Clone with submodules:

```sh
git clone --recurse-submodules https://github.com/root-hunter/ppsspp-web.git
```

For an existing checkout:

```sh
git submodule update --init --recursive
```

Or use the Makefile wrapper:

```sh
make wasm-submodules
```

## Local Run

Install and build the Angular app:

```sh
make app-install
make app-build
```

Build PPSSPP from the active `WASM_ROOT` first:

```sh
make wasm-dev
```

Then serve it from this repository:

```sh
make serve
```

By default the server reads `deps/ppsspp-wasm/build-wasm/` and
`deps/ppsspp-wasm/build-wasm-release/`. Use
`WASM_ROOT=/path/to/ppsspp-wasm` if the checkout lives somewhere else.

Useful local-development shortcuts:

```sh
make wasm-status
make wasm-submodule-branch
make wasm-dev
make serve
```

To update the pinned submodule to the latest `origin/wasm`:

```sh
make wasm-submodule-update
git diff --submodule
```

To pin `ppsspp-web` to the current committed HEAD of a separate sibling
`../ppsspp-wasm` checkout, when you are using one:

```sh
make wasm-pin-local
git diff --submodule
```

Push the `ppsspp-wasm` commit before sharing the `ppsspp-web` submodule pointer,
otherwise other machines will not be able to fetch it.

## Docker

```sh
make server-docker-up
```

The Docker image builds the Angular web shell in a Node stage, then serves the
compiled static bundle from the Python server. The compose file mounts
`WASM_ROOT` read-only at `/wasm`. For the sibling local checkout:

```sh
make server-docker-up-local
```

For the public relay on Oracle with automatic HTTPS on port 443, see
[Oracle relay deployment](docs/relay-deployment.md). GitHub Actions builds and
pushes the multi-platform relay image to GHCR; the Oracle `self-hosted` runner
only pulls images and starts the relay and Caddy containers.

## GitHub Pages

The workflow builds the exact `deps/ppsspp-wasm` revision pinned by this
repository and verifies the checkout before compiling. Pull requests targeting
`wasm` run the same build and runtime tests and upload the Pages artifact for
review; deployment runs only for pushes and manual workflow runs.

Static packaging includes `PPSSPPSDL.worker.js` when the Emscripten build emits
a separate pthread worker. The worker participates in the build cache revision,
so changing it invalidates the matching emulator bundle.

The settings panel overlays the game without changing its size. Fullscreen
includes the panel and a toolbar for opening settings or leaving fullscreen.
These improvements adapt ideas from the power8koch-alt, noreturningfromthis,
bee-san and BeezBumba forks.

Build the static Angular bundle with a relative base href, ready for GitHub
Pages, from an existing `ppsspp-wasm` release build:

```sh
make wasm-release
make app-build-pages
```

Or run the complete local pipeline in one shot:

```sh
make pages
```

The target writes the publishable app to `wasm-page/dist/ppsspp-web/`, adds
`.nojekyll`, copies `$(WASM_ROOT)/build-wasm-release/` into
`wasm-page/dist/ppsspp-web/build-wasm/`, and publishes
`$(WASM_ROOT)/assets/` under `build-wasm/assets/` when present. That output
directory is the exact static artifact uploaded by the GitHub Pages workflow.

## Stability checks

Browser builds include the bundled FFmpeg video/audio decoders. `make wasm-release`
builds those libraries before configuring the core; publishing a build configured
without FFmpeg is rejected. See [browser stability notes](docs/browser-stability.md)
for the user-report backlog, recovery tools and the device test procedure.

```sh
npm --prefix wasm-page test
bash scripts/test-ffmpeg-wasm.sh
```

## Toolchain versions

The UI uses Angular 22.2.3, Lucide 1.59.0 and TypeScript 6.0.3. TypeScript stays
on the latest Angular-compatible release: Angular 22 requires `>=6.0 <6.1`, so
TypeScript 7 is not enabled. See the [Angular compatibility table](https://angular.dev/reference/versions).

Node 24.22.0 LTS is pinned in `.nvmrc`; npm 12.2.0 is pinned in the app's
`packageManager` field. CI and the Docker UI build use the same versions.
With nvm installed, prepare the UI environment from the repository root:

```sh
nvm install
nvm use
npm install --global npm@12.2.0
npm --prefix wasm-page ci
```

Emscripten 6.0.12 is pinned in `.emscripten-version` and the CI container. To
activate it in an existing [emsdk installation](https://emscripten.org/docs/getting_started/downloads.html):

```sh
emsdk install "$(cat .emscripten-version)"
emsdk activate "$(cat .emscripten-version)"
# Source the emsdk_env.sh from that installation in the current shell.
emcc --version
```

Release builds use `-O3`, SIMD and pthreads with **LTO disabled by default**.
Game launch was reported to freeze the entire page with LTO enabled, even though
the emulator UI started successfully. Keep LTO disabled for normal builds:

```sh
make wasm-release WASM_ENABLE_LTO=OFF
```

After changing the compiler, rebuild FFmpeg and the core with the same active
SDK. Use a fresh CMake build directory if an existing cache refers to a different
checkout path or toolchain installation. Development builds also keep LTO disabled.
A successful compile or emulator UI startup does not establish game-launch
stability. Re-enabling LTO requires reproducing and resolving the reported freeze.

## Browser multiplayer

The WSS Ad Hoc relay, configuration, protocol tests and Tekken 6 validation checklist are described in [docs/multiplayer.md](docs/multiplayer.md). Transport validation and unverified gameplay criteria are recorded separately in [docs/multiplayer-validation.md](docs/multiplayer-validation.md).
