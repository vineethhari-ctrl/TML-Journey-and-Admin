// JNI bridge to whisper.cpp. Word-level timestamps via token_timestamps + max_len=1 + split_on_word.
#include <jni.h>
#include <cstring>
#include <string>
#include <vector>

#ifdef SING_HAVE_WHISPER
#include "whisper.h"
#endif

extern "C" {

JNIEXPORT jboolean JNICALL Java_app_singsync_core_WhisperNative_nativeAvailable(JNIEnv*, jobject) {
#ifdef SING_HAVE_WHISPER
    return JNI_TRUE;
#else
    return JNI_FALSE;
#endif
}

#ifdef SING_HAVE_WHISPER

struct CbState {
    JNIEnv* env;
    jobject cb;
    jmethodID onProgress;
    jmethodID isCancelled;
};

static void progressCallback(struct whisper_context*, struct whisper_state*, int progress, void* ud) {
    auto* s = static_cast<CbState*>(ud);
    s->env->CallVoidMethod(s->cb, s->onProgress, static_cast<jint>(progress));
}

static bool abortCallback(void* ud) {
    auto* s = static_cast<CbState*>(ud);
    return s->env->CallBooleanMethod(s->cb, s->isCancelled) == JNI_TRUE;
}

JNIEXPORT jlong JNICALL Java_app_singsync_core_WhisperNative_nativeInit(JNIEnv* env, jobject, jstring path) {
    const char* p = env->GetStringUTFChars(path, nullptr);
    whisper_context_params cp = whisper_context_default_params();
    cp.use_gpu = false;
    whisper_context* ctx = whisper_init_from_file_with_params(p, cp);
    env->ReleaseStringUTFChars(path, p);
    return reinterpret_cast<jlong>(ctx);
}

JNIEXPORT void JNICALL Java_app_singsync_core_WhisperNative_nativeFree(JNIEnv*, jobject, jlong handle) {
    if (handle) whisper_free(reinterpret_cast<whisper_context*>(handle));
}

// Returns Object[4]: long[] t0 (10 ms units), long[] t1, byte[][] utf8 words, byte[] utf8 language. null on failure/cancel.
JNIEXPORT jobjectArray JNICALL Java_app_singsync_core_WhisperNative_nativeTranscribe(
        JNIEnv* env, jobject, jlong handle, jfloatArray pcm, jstring lang, jint threads, jobject callback) {
    auto* ctx = reinterpret_cast<whisper_context*>(handle);
    if (!ctx) return nullptr;

    const jsize n = env->GetArrayLength(pcm);
    jfloat* samples = env->GetFloatArrayElements(pcm, nullptr);
    const char* langC = env->GetStringUTFChars(lang, nullptr);
    std::string language = langC;
    env->ReleaseStringUTFChars(lang, langC);

    jclass cbClass = env->GetObjectClass(callback);
    CbState state{env, callback, env->GetMethodID(cbClass, "onProgress", "(I)V"), env->GetMethodID(cbClass, "isCancelled", "()Z")};

    whisper_full_params wp = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    wp.n_threads = threads > 0 ? threads : 4;
    wp.language = language.c_str();            // "auto" = detect
    wp.translate = false;
    wp.print_progress = false; wp.print_realtime = false; wp.print_timestamps = false; wp.print_special = false;
    wp.token_timestamps = true;                // word-level timing
    wp.max_len = 1;                            // one "segment" per word …
    wp.split_on_word = true;                   // … split on word boundaries (never inside a UTF-8 sequence of a word)
    wp.no_context = true;                      // do not feed previous text back in: avoids repetition loops on sung audio
    wp.suppress_blank = true;
    wp.progress_callback = progressCallback;
    wp.progress_callback_user_data = &state;
    wp.abort_callback = abortCallback;
    wp.abort_callback_user_data = &state;

    const int rc = whisper_full(ctx, wp, samples, static_cast<int>(n));
    env->ReleaseFloatArrayElements(pcm, samples, JNI_ABORT);
    if (rc != 0) return nullptr;

    const int count = whisper_full_n_segments(ctx);
    jlongArray t0 = env->NewLongArray(count);
    jlongArray t1 = env->NewLongArray(count);
    jclass byteArr = env->FindClass("[B");
    jobjectArray words = env->NewObjectArray(count, byteArr, nullptr);
    for (int i = 0; i < count; ++i) {
        jlong a = whisper_full_get_segment_t0(ctx, i), b = whisper_full_get_segment_t1(ctx, i);
        env->SetLongArrayRegion(t0, i, 1, &a);
        env->SetLongArrayRegion(t1, i, 1, &b);
        const char* txt = whisper_full_get_segment_text(ctx, i);
        const jsize len = static_cast<jsize>(strlen(txt));
        jbyteArray bytes = env->NewByteArray(len);
        env->SetByteArrayRegion(bytes, 0, len, reinterpret_cast<const jbyte*>(txt));
        env->SetObjectArrayElement(words, i, bytes);
        env->DeleteLocalRef(bytes);
    }
    const char* l = whisper_lang_str(whisper_full_lang_id(ctx));
    const jsize ll = static_cast<jsize>(strlen(l));
    jbyteArray langBytes = env->NewByteArray(ll);
    env->SetByteArrayRegion(langBytes, 0, ll, reinterpret_cast<const jbyte*>(l));

    jclass objClass = env->FindClass("java/lang/Object");
    jobjectArray result = env->NewObjectArray(4, objClass, nullptr);
    env->SetObjectArrayElement(result, 0, t0);
    env->SetObjectArrayElement(result, 1, t1);
    env->SetObjectArrayElement(result, 2, words);
    env->SetObjectArrayElement(result, 3, langBytes);
    return result;
}

#else  // built without whisper.cpp

JNIEXPORT jlong JNICALL Java_app_singsync_core_WhisperNative_nativeInit(JNIEnv*, jobject, jstring) { return 0; }
JNIEXPORT void JNICALL Java_app_singsync_core_WhisperNative_nativeFree(JNIEnv*, jobject, jlong) {}
JNIEXPORT jobjectArray JNICALL Java_app_singsync_core_WhisperNative_nativeTranscribe(JNIEnv*, jobject, jlong, jfloatArray, jstring, jint, jobject) { return nullptr; }

#endif
}  // extern "C"
