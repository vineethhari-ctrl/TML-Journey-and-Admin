#include <jni.h>
#include "singcore.h"

extern "C" {

JNIEXPORT jdouble JNICALL
Java_app_singsync_core_NativeCore_nullTestResidualDb(JNIEnv* env, jobject, jfloatArray oL, jfloatArray oR,
                                                    jfloatArray aL, jfloatArray aR, jfloatArray bL, jfloatArray bR) {
    const jsize n = env->GetArrayLength(oL);
    jfloat* p[6] = {
        env->GetFloatArrayElements(oL, nullptr), env->GetFloatArrayElements(oR, nullptr),
        env->GetFloatArrayElements(aL, nullptr), env->GetFloatArrayElements(aR, nullptr),
        env->GetFloatArrayElements(bL, nullptr), env->GetFloatArrayElements(bR, nullptr)};
    const double r = singcore::nullTestResidualDb(p[0], p[1], p[2], p[3], p[4], p[5], static_cast<size_t>(n));
    jfloatArray arrs[6] = {oL, oR, aL, aR, bL, bR};
    for (int i = 0; i < 6; ++i) env->ReleaseFloatArrayElements(arrs[i], p[i], JNI_ABORT);  // read-only: no copy-back
    return r;
}

JNIEXPORT jstring JNICALL Java_app_singsync_core_NativeCore_version(JNIEnv* env, jobject) {
    return env->NewStringUTF("singcore 0.1");
}

}  // extern "C"
