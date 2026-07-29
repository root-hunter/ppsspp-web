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
git clone --recurse-submodules https://github.com/SlabyLol/ppsspp-web.git
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

## GitHub Pages

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
