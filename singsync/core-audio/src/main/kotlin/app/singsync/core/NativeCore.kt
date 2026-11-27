package app.singsync.core

import app.singsync.common.NullTest
import app.singsync.common.StereoPcm

/** JNI entry points into the shared C++ core (`singcore`). Falls back to Kotlin if the library cannot load. */
object NativeCore {
    private val loaded: Boolean = try { System.loadLibrary("singcore"); true } catch (_: UnsatisfiedLinkError) { false }

    private external fun nullTestResidualDb(oL: FloatArray, oR: FloatArray, aL: FloatArray, aR: FloatArray, bL: FloatArray, bR: FloatArray): Double
    private external fun version(): String

    fun nativeVersion(): String = if (loaded) version() else "kotlin-fallback"

    /** dB of residual in (a + b - original); about -300 = perfect. */
    fun nullTestDb(original: StereoPcm, a: StereoPcm, b: StereoPcm): Double =
        if (loaded) nullTestResidualDb(original.left, original.right, a.left, a.right, b.left, b.right)
        else NullTest.residualDb(original, a, b)
}
