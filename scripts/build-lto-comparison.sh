#!/usr/bin/env bash
# Run inside the CI's Emscripten image; /workspace is read-only, /bench writable.
set -euo pipefail
trap 'chown -R "${BENCH_UID:-1000}:${BENCH_GID:-1000}" /bench' EXIT
if ! command -v ninja >/dev/null || ! test -x /usr/bin/time; then
  apt-get update > /bench/build-tools.log 2>&1
  apt-get install -y --no-install-recommends ninja-build time >> /bench/build-tools.log 2>&1
fi
git config --global --add safe.directory '*'
emcc --version > /bench/toolchain.txt
git -C /workspace/deps/ppsspp-wasm rev-parse HEAD > /bench/source-revision.txt
source_root=/workspace/deps/ppsspp-wasm
for variant in baseline lto; do
  lto_enabled=OFF
  if test "$variant" = lto; then lto_enabled=ON; fi
  echo "Configuring $variant (WASM_ENABLE_LTO=$lto_enabled)"
  emcmake cmake -S "$source_root" -B "/bench/$variant" -G Ninja \
    -DCMAKE_BUILD_TYPE=Release -DCMAKE_EXPORT_COMPILE_COMMANDS=ON \
    -DUSING_GLES2=ON -DUSING_EGL=OFF -DVULKAN=OFF -DUSE_NO_MMAP=ON \
    -DUSE_DISCORD=OFF -DUSE_MINIUPNPC=OFF -DUSE_CCACHE=OFF \
    -DUSE_SYSTEM_LIBSDL2=OFF -DUSE_SYSTEM_LIBPNG=OFF \
    -DUSE_SYSTEM_FREETYPE=OFF -DUSE_SYSTEM_LIBZIP=OFF \
    -DUSE_FFMPEG=ON -DFFMPEG_DIR="$source_root/build-ffmpeg-wasm/install" \
    -DWASM_MAX_PERF=ON -DWASM_MALLOC=mimalloc -DWASM_MAIN_LOOP_FPS=60 \
    -DWASM_INITIAL_MEMORY=536870912 -DWASM_MAXIMUM_MEMORY=4294967296 \
    -DWASM_ENABLE_LTO="$lto_enabled" > "/bench/$variant-configure.log" 2>&1
  echo "Building $variant"
  /usr/bin/time -v -o "/bench/$variant-time.txt" \
    cmake --build "/bench/$variant" -j8 > "/bench/$variant-build.log" 2>&1
  echo "Completed $variant"
done
