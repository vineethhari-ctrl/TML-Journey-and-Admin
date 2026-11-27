package app.singsync.common

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** Stem indices in every [Separator] result. */
object Stem { const val VOCALS = 0; const val INSTRUMENTAL = 1; const val COUNT = 2 }

/** Turns one fixed-length stereo chunk into [Stem.COUNT] stems. */
interface Separator : AutoCloseable {
    /** Human readable id stored with the song ("htdemucs-int8", "classic-midside"). */
    val id: String
    /** Fixed input length in frames (model segment). */
    val chunkLen: Int
    /** [chunk] is [channel][chunkLen]; returns [stem][channel][chunkLen]. */
    fun separate(chunk: Array<FloatArray>): Array<Array<FloatArray>>
    override fun close() {}
}

/**
 * "Classic" fallback used ONLY when no neural model is bundled: estimates the vocal as the band-passed
 * centre (mid) channel, instrumental = mix - vocal. Poor isolation, but it is exactly reconstructive
 * (instrumental + vocal == original) and lets the whole pipeline run end-to-end. Not for production use.
 */
class ClassicMidSideSeparator(override val chunkLen: Int = ChunkPlan.DEMUCS_SEGMENT_FRAMES, private val sampleRate: Int = 44_100) : Separator {
    override val id = "classic-midside"
    private val hp = Biquad.highpass(sampleRate, 150.0)
    private val lp = Biquad.lowpass(sampleRate, 6500.0)

    override fun separate(chunk: Array<FloatArray>): Array<Array<FloatArray>> {
        val n = chunk[0].size
        val mid = FloatArray(n) { (chunk[0][it] + chunk[1][it]) * 0.5f }
        val voc = lp.copy().process(hp.copy().process(mid))
        val vocals = Array(2) { voc.copyOf() }
        val inst = Array(2) { c -> FloatArray(n) { chunk[c][it] - voc[it] } }
        return arrayOf(vocals, inst)
    }
}

/** RBJ biquad, 2 cascaded sections for a 24 dB/oct slope. State is per instance; use [copy] for a fresh run. */
class Biquad private constructor(private val b0: Double, private val b1: Double, private val b2: Double, private val a1: Double, private val a2: Double) {
    fun copy() = Biquad(b0, b1, b2, a1, a2)
    fun process(x: FloatArray): FloatArray {
        val y = FloatArray(x.size)
        var x1 = 0.0; var x2 = 0.0; var y1 = 0.0; var y2 = 0.0
        for (i in x.indices) {
            val xi = x[i].toDouble()
            val yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            x2 = x1; x1 = xi; y2 = y1; y1 = yi
            y[i] = yi.toFloat()
        }
        return y
    }
    companion object {
        private const val Q = 0.7071067811865476
        fun lowpass(fs: Int, fc: Double): Biquad { val w = 2 * PI * fc / fs; val al = sin(w) / (2 * Q); val c = cos(w); val a0 = 1 + al
            return Biquad((1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, -2 * c / a0, (1 - al) / a0) }
        fun highpass(fs: Int, fc: Double): Biquad { val w = 2 * PI * fc / fs; val al = sin(w) / (2 * Q); val c = cos(w); val a0 = 1 + al
            return Biquad((1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - al) / a0) }
    }
}
