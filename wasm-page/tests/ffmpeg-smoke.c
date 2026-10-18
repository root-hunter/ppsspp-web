#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
int main(void) {
  av_register_all();
  assert(avcodec_find_decoder(AV_CODEC_ID_ATRAC3));
  assert(avcodec_find_decoder(AV_CODEC_ID_ATRAC3P));
  assert(avcodec_find_decoder(AV_CODEC_ID_AAC));
  assert(avcodec_find_decoder(AV_CODEC_ID_MP3));
  assert(av_find_input_format("mpeg"));
  AVFormatContext *format = NULL;
  assert(avformat_open_input(&format, "/test.h264", NULL, NULL) == 0);
  assert(avformat_find_stream_info(format, NULL) >= 0);
  AVCodecContext *ctx = format->streams[0]->codec;
  ctx->thread_count = 1;
  assert(avcodec_open2(ctx, avcodec_find_decoder(ctx->codec_id), NULL) == 0);
  AVFrame *frame = av_frame_alloc();
  AVPacket packet;
  int decoded = 0, got = 0;
  while (av_read_frame(format, &packet) >= 0) {
    assert(avcodec_decode_video2(ctx, frame, &got, &packet) >= 0);
    if (got) { assert(frame->width == 480 && frame->height == 272); decoded++; } av_packet_unref(&packet);
  }
  av_init_packet(&packet); packet.data = NULL; packet.size = 0;
  do { assert(avcodec_decode_video2(ctx, frame, &got, &packet) >= 0); if (got) { assert(frame->width == 480 && frame->height == 272); decoded++; } } while (got);
  assert(decoded == 3);
  av_frame_free(&frame); avcodec_close(ctx); avformat_close_input(&format);
  printf("PASS: H.264 decoded 3 PSP-resolution frames; ATRAC3/ATRAC3+/AAC/MP3 and MPEG-PS registered.\n");
  return 0;
}
