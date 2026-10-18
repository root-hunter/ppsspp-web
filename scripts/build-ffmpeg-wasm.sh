#!/usr/bin/env bash
# Build bundled FFmpeg with PPSSPP's SIMD/pthread ABI.
# Decode PSP movies on the emulation thread: automatic decoder worker creation
# can exhaust the browser pthread pool while its main thread is blocked.
set -euo pipefail
source_root=$(cd "${1:-$(dirname "$0")/../deps/ppsspp-wasm}" && pwd)
build_dir="$source_root/build-ffmpeg-wasm"
prefix="$build_dir/install"
mkdir -p "$build_dir"
# Reconfigure when this recipe or the compiler changes; make still tracks source edits.
recipe=$(cat "$0"; emcc --version)
fingerprint=$(printf '%s' "$recipe" | sha256sum | cut -d ' ' -f 1)
nm_tool=emnm
if ! emnm --version >/dev/null 2>&1; then nm_tool=$(command -v llvm-nm); fi
cd "$build_dir"
if [ ! -f config.h ] || [ "$(cat .recipe-hash 2>/dev/null || true)" != "$fingerprint" ]; then
emconfigure "$source_root/ffmpeg/configure" \
  --prefix="$prefix" --target-os=none --arch=wasm32 --enable-cross-compile \
  --cc=emcc --cxx=em++ --ar=emar --ranlib=emranlib --nm="$nm_tool" \
  --disable-asm --disable-inline-asm --disable-runtime-cpudetect \
  --disable-shared --enable-static --disable-programs --disable-doc \
  --disable-network --disable-everything \
  --disable-avdevice --disable-avfilter --disable-postproc \
  --enable-avcodec --enable-avformat --enable-avutil --enable-swresample --enable-swscale \
  --enable-decoder=h264,mpeg4,h263,h263p,mpeg2video,mjpeg,mjpegb,aac,aac_latm,atrac3,atrac3p,mp3,pcm_s16le,pcm_s8 \
  --enable-parser=h264,mpeg4video,h263,mpegvideo,aac,aac_latm,mpegaudio \
  --enable-demuxer=h264,h263,m4v,mpegps,mpegvideo,avi,mp3,aac,pmp,oma,pcm_s16le,pcm_s8,wav \
  --enable-protocol=file --disable-pthreads --disable-w32threads --disable-os2threads \
  --extra-cflags='-O3 -msimd128 -pthread -Wno-error=implicit-function-declaration -Wno-incompatible-function-pointer-types' \
  --extra-ldflags='-msimd128 -pthread'
printf '%s' "$fingerprint" > .recipe-hash
fi
make -j"${WASM_FFMPEG_JOBS:-4}"
make install
