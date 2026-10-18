#!/usr/bin/env bash
set -euo pipefail
repo_root=$(cd "$(dirname "$0")/.." && pwd)
ffmpeg_prefix="${1:-$repo_root/deps/ppsspp-wasm/build-ffmpeg-wasm/install}"
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
ffmpeg -hide_banner -loglevel error -f lavfi -i color=c=blue:s=480x272:r=30 \
  -frames:v 3 -c:v libx264 -pix_fmt yuv420p -f h264 "$test_dir/test.h264"
emcc "$repo_root/wasm-page/tests/ffmpeg-smoke.c" \
  -I "$ffmpeg_prefix/include" -L "$ffmpeg_prefix/lib" \
  -Wl,--start-group -lavformat -lavcodec -lswscale -lswresample -lavutil -Wl,--end-group \
  -O2 -msimd128 -pthread -sEXIT_RUNTIME=1 -sENVIRONMENT=node \
  --embed-file "$test_dir/test.h264@/test.h264" -o "$test_dir/check.js"
node "$test_dir/check.js"
