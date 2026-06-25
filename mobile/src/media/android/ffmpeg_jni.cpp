/**
 * media/android/ffmpeg_jni.cpp
 *
 * Android JNI bridge to FFmpeg for hardware-accelerated video trimming.
 * Compiles with full video decoding, filtering (scale to 1080p and convert to 30fps),
 * and re-encoding using avfilter.
 */

#include <jni.h>
#include <string>
#include <thread>
#include <android/log.h>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
#include <libavutil/opt.h>
#include <libswscale/swscale.h>
#include <libswresample/swresample.h>
#include <libavfilter/avfilter.h>
#include <libavfilter/buffersink.h>
#include <libavfilter/buffersrc.h>
}

#define LOG_TAG "StellarFFmpeg"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// ─── Progress callback ────────────────────────────────────────────────────────

static JavaVM*   g_jvm        = nullptr;
static jobject   g_callback   = nullptr;
static jmethodID g_onProgress = nullptr;

static void reportProgress(double progress) {
    if (!g_jvm || !g_callback) return;
    JNIEnv* env = nullptr;
    bool attached = false;
    if (g_jvm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) == JNI_EDETACHED) {
        g_jvm->AttachCurrentThread(&env, nullptr);
        attached = true;
    }
    if (env && g_onProgress) {
        env->CallVoidMethod(g_callback, g_onProgress, static_cast<jdouble>(progress));
    }
    if (attached) g_jvm->DetachCurrentThread();
}

// ─── Core trim ────────────────────────────────────────────────────────────────

static int trimVideo(
    const char* inputPath,
    const char* outputPath,
    int64_t     startMs,
    int64_t     endMs,
    int         videoBitrate,
    int         audioBitrate,
    bool        useHardware
) {
    av_log_set_level(AV_LOG_WARNING);

    AVFormatContext* inFmt  = nullptr;
    AVFormatContext* outFmt = nullptr;
    int ret = 0;

    if ((ret = avformat_open_input(&inFmt, inputPath, nullptr, nullptr)) < 0) {
        LOGE("avformat_open_input failed: %d", ret);
        return ret;
    }
    avformat_find_stream_info(inFmt, nullptr);

    avformat_alloc_output_context2(&outFmt, nullptr, nullptr, outputPath);
    if (!outFmt) { LOGE("alloc output context failed"); return AVERROR_UNKNOWN; }

    int videoStreamIdx = -1;
    int audioStreamIdx = -1;
    AVCodecContext* decVideoCtx = nullptr;
    AVCodecContext* encVideoCtx = nullptr;
    AVFilterGraph* filterGraph = nullptr;
    AVFilterContext* buffersrcCtx = nullptr;
    AVFilterContext* buffersinkCtx = nullptr;

    for (unsigned i = 0; i < inFmt->nb_streams; i++) {
        AVStream* inStream  = inFmt->streams[i];
        AVStream* outStream = avformat_new_stream(outFmt, nullptr);
        if (!outStream) continue;

        if (inStream->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
            videoStreamIdx = i;

            // Setup Decoder
            const AVCodec* decoder = avcodec_find_decoder(inStream->codecpar->codec_id);
            decVideoCtx = avcodec_alloc_context3(decoder);
            avcodec_parameters_to_context(decVideoCtx, inStream->codecpar);
            avcodec_open2(decVideoCtx, decoder, nullptr);

            // Setup Encoder forcing 1080p and 30fps
            const char* encoderName = useHardware ? "h264_mediacodec" : "libx264";
            const AVCodec* encoder  = avcodec_find_encoder_by_name(encoderName);
            if (!encoder) encoder   = avcodec_find_encoder_by_name("libx264");

            encVideoCtx = avcodec_alloc_context3(encoder);
            
            // Auto-detect orientation: vertical vs horizontal 1080p
            int targetWidth = 1920;
            int targetHeight = 1080;
            if (inStream->codecpar->height > inStream->codecpar->width) {
                targetWidth = 1080;
                targetHeight = 1920;
            }
            
            encVideoCtx->width           = targetWidth;
            encVideoCtx->height          = targetHeight;
            encVideoCtx->time_base       = { 1, 30 };
            encVideoCtx->framerate       = { 30, 1 };
            encVideoCtx->bit_rate        = videoBitrate * 1000LL;
            encVideoCtx->pix_fmt         = AV_PIX_FMT_YUV420P;
            encVideoCtx->thread_count    = static_cast<int>(std::thread::hardware_concurrency());

            if (!useHardware) {
                av_opt_set(encVideoCtx->priv_data, "preset", "fast",       0);
                av_opt_set(encVideoCtx->priv_data, "tune",   "fastdecode", 0);
            }

            avcodec_open2(encVideoCtx, encoder, nullptr);
            avcodec_parameters_from_context(outStream->codecpar, encVideoCtx);
            outStream->time_base = encVideoCtx->time_base;

            // Setup AVFilter Graph for scaling and framerate conversion
            filterGraph = avfilter_graph_alloc();
            char filterArgs[512];
            snprintf(filterArgs, sizeof(filterArgs),
                     "video_size=%dx%d:pix_fmt=%d:time_base=%d/%d:pixel_aspect=%d/%d",
                     decVideoCtx->width, decVideoCtx->height, decVideoCtx->pix_fmt,
                     inStream->time_base.num, inStream->time_base.den,
                     decVideoCtx->sample_aspect_ratio.num, decVideoCtx->sample_aspect_ratio.den);

            const AVFilter* srcFilter = avfilter_get_by_name("buffer");
            const AVFilter* sinkFilter = avfilter_get_by_name("buffersink");

            avfilter_graph_create_filter(&buffersrcCtx, srcFilter, "in", filterArgs, nullptr, filterGraph);
            avfilter_graph_create_filter(&buffersinkCtx, sinkFilter, "out", nullptr, nullptr, filterGraph);

            enum AVPixelFormat pixFmts[] = { AV_PIX_FMT_YUV420P, AV_PIX_FMT_NONE };
            av_opt_set_int_list(buffersinkCtx, "pix_fmts", pixFmts, AV_PIX_FMT_NONE, AV_OPT_SEARCH_CHILDREN);

            char filterDesc[256];
            snprintf(filterDesc, sizeof(filterDesc), "scale=%d:%d,fps=30", targetWidth, targetHeight);

            AVFilterInOut* outputs = avfilter_inout_alloc();
            AVFilterInOut* inputs  = avfilter_inout_alloc();

            outputs->name       = av_strdup("in");
            outputs->filter_ctx = buffersrcCtx;
            outputs->pad_idx    = 0;
            outputs->next       = nullptr;

            inputs->name       = av_strdup("out");
            inputs->filter_ctx = buffersinkCtx;
            inputs->pad_idx    = 0;
            inputs->next       = nullptr;

            avfilter_graph_parse_ptr(filterGraph, filterDesc, &inputs, &outputs, nullptr);
            avfilter_graph_config(filterGraph, nullptr);

            avfilter_inout_free(&inputs);
            avfilter_inout_free(&outputs);

        } else if (inStream->codecpar->codec_type == AVMEDIA_TYPE_AUDIO) {
            audioStreamIdx = i;
            avcodec_parameters_copy(outStream->codecpar, inStream->codecpar);
            outStream->codecpar->bit_rate = audioBitrate * 1000LL;
            outStream->time_base = inStream->time_base;
        } else {
            avcodec_parameters_copy(outStream->codecpar, inStream->codecpar);
            outStream->time_base = inStream->time_base;
        }
    }

    int64_t startPts = av_rescale_q(startMs, { 1, 1000 }, inFmt->streams[videoStreamIdx]->time_base);
    av_seek_frame(inFmt, videoStreamIdx, startPts, AVSEEK_FLAG_BACKWARD);

    if (!(outFmt->oformat->flags & AVFMT_NOFILE))
        avio_open(&outFmt->pb, outputPath, AVIO_FLAG_WRITE);

    avformat_write_header(outFmt, nullptr);

    AVPacket* pkt = av_packet_alloc();
    AVFrame* frame = av_frame_alloc();
    AVFrame* filtFrame = av_frame_alloc();
    AVPacket* encPkt = av_packet_alloc();

    int64_t durationMs = endMs - startMs;
    int64_t ptsOffset = av_rescale_q(startMs, { 1, 1000 }, inFmt->streams[videoStreamIdx]->time_base);

    while (av_read_frame(inFmt, pkt) >= 0) {
        if (pkt->stream_index == videoStreamIdx) {
            AVStream* inStream = inFmt->streams[videoStreamIdx];
            int64_t pktMs = av_rescale_q(pkt->pts, inStream->time_base, { 1, 1000 });

            if (pktMs < startMs) { av_packet_unref(pkt); continue; }
            if (pktMs > endMs)   { av_packet_unref(pkt); break;    }

            if (avcodec_send_packet(decVideoCtx, pkt) >= 0) {
                while (avcodec_receive_frame(decVideoCtx, frame) >= 0) {
                    if (av_buffersrc_add_frame_flags(buffersrcCtx, frame, AV_BUFFERSRC_FLAG_KEEP_REF) >= 0) {
                        while (av_buffersink_get_frame(buffersinkCtx, filtFrame) >= 0) {
                            filtFrame->pts = av_rescale_q(filtFrame->pts - ptsOffset, inStream->time_base, encVideoCtx->time_base);
                            
                            if (avcodec_send_frame(encVideoCtx, filtFrame) >= 0) {
                                while (avcodec_receive_packet(encVideoCtx, encPkt) >= 0) {
                                    encPkt->stream_index = videoStreamIdx;
                                    av_packet_rescale_ts(encPkt, encVideoCtx->time_base, outFmt->streams[videoStreamIdx]->time_base);
                                    av_interleaved_write_frame(outFmt, encPkt);
                                    av_packet_unref(encPkt);
                                }
                            }
                            av_frame_unref(filtFrame);
                        }
                    }
                    av_frame_unref(frame);
                }
            }
            reportProgress(std::min(static_cast<double>(pktMs - startMs) / durationMs, 1.0));

        } else if (pkt->stream_index == audioStreamIdx) {
            AVStream* inStream = inFmt->streams[audioStreamIdx];
            int64_t pktMs = av_rescale_q(pkt->pts, inStream->time_base, { 1, 1000 });

            if (pktMs >= startMs && pktMs <= endMs) {
                pkt->pts -= av_rescale_q(startMs, { 1, 1000 }, inStream->time_base);
                pkt->dts = pkt->pts;
                pkt->pos = -1;
                av_packet_rescale_ts(pkt, inStream->time_base, outFmt->streams[audioStreamIdx]->time_base);
                av_interleaved_write_frame(outFmt, pkt);
            }
        }
        av_packet_unref(pkt);
    }

    if (encVideoCtx) {
        avcodec_send_frame(encVideoCtx, nullptr);
        while (avcodec_receive_packet(encVideoCtx, encPkt) >= 0) {
            encPkt->stream_index = videoStreamIdx;
            av_packet_rescale_ts(encPkt, encVideoCtx->time_base, outFmt->streams[videoStreamIdx]->time_base);
            av_interleaved_write_frame(outFmt, encPkt);
            av_packet_unref(encPkt);
        }
    }

    av_write_trailer(outFmt);

    av_packet_free(&pkt);
    av_frame_free(&frame);
    av_frame_free(&filtFrame);
    av_packet_free(&encPkt);

    if (decVideoCtx) avcodec_free_context(&decVideoCtx);
    if (encVideoCtx) avcodec_free_context(&encVideoCtx);
    if (filterGraph) avfilter_graph_free(&filterGraph);

    avformat_close_input(&inFmt);
    if (outFmt && !(outFmt->oformat->flags & AVFMT_NOFILE)) avio_closep(&outFmt->pb);
    avformat_free_context(outFmt);

    reportProgress(1.0);
    return 0;
}

// ─── JNI exports ─────────────────────────────────────────────────────────────

extern "C" JNIEXPORT jint JNICALL
JNI_OnLoad(JavaVM* vm, void*) {
    g_jvm = vm;
    return JNI_VERSION_1_6;
}

extern "C" JNIEXPORT jint JNICALL
Java_dev_stellar_mobile_FFmpegBridge_trimVideo(
    JNIEnv*  env,
    jclass,
    jstring  inputPath,
    jstring  outputPath,
    jlong    startMs,
    jlong    endMs,
    jint     videoBitrate,
    jint     audioBitrate,
    jboolean useHardware,
    jobject  progressCallback
) {
    g_callback   = env->NewGlobalRef(progressCallback);
    jclass cbCls = env->GetObjectClass(g_callback);
    g_onProgress = env->GetMethodID(cbCls, "onProgress", "(D)V");

    const char* in  = env->GetStringUTFChars(inputPath,  nullptr);
    const char* out = env->GetStringUTFChars(outputPath, nullptr);

    int result = trimVideo(in, out, startMs, endMs, videoBitrate, audioBitrate, useHardware);

    env->ReleaseStringUTFChars(inputPath,  in);
    env->ReleaseStringUTFChars(outputPath, out);
    env->DeleteGlobalRef(g_callback);
    g_callback = nullptr;
    return result;
}
