package app.singsync.common

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * Band-limited windowed-sinc resampler (Blackman-Harris window, table-interpolated kernel).
 * When down-sampling the kernel is stretched so the cut-off sits just below the new Nyquist.
 * Deterministic and allocation-light; used to bring any decoded file to the 44.1 kHz pipeline rate.
 */
object Resampler {
    private const val ZERO_CROSSINGS = 24
    private const val TABLE_RES = 256
    private val table: DoubleArray by lazy { kernelTable() }

    fun resample(input: FloatArray, inRate: Int, outRate: Int): FloatArray {
        if (inRate == outRate || input.isEmpty()) return input.copyOf()
        val ratio = inRate.toDouble() / outRate                       // input samples per output sample
        val outLen = (input.size / ratio).toInt()
        // Kernel stretch: 1 when up-sampling; >1 when down-sampling (cut-off at 98.5 % of new Nyquist).
        val stretch = if (ratio > 1.0) ratio / 0.985 else 1.0
        val support = (ZERO_CROSSINGS * stretch).toInt() + 1
        val out = FloatArray(outLen)
        for (n in 0 until outLen) {
            val t = n * ratio
            val center = t.toInt()
            var acc = 0.0
            var norm = 0.0
            for (k in center - support..center + support) {
                val u = abs(k - t) / stretch
                if (u >= ZERO_CROSSINGS) continue
                val pos = u * TABLE_RES
                val i0 = pos.toInt()
                val frac = pos - i0
                val w = table[i0] * (1 - frac) + table[i0 + 1] * frac
                norm += w                                              // normalising keeps DC gain exactly 1
                if (k >= 0 && k < input.size) acc += input[k] * w
            }
            out[n] = if (norm != 0.0) (acc / norm).toFloat() else 0f
        }
        return out
    }

    private fun kernelTable(): DoubleArray = DoubleArray(ZERO_CROSSINGS * TABLE_RES + 2) { i ->
        val u = i.toDouble() / TABLE_RES
        val sinc = if (u == 0.0) 1.0 else sin(PI * u) / (PI * u)
        val r = min(u / ZERO_CROSSINGS, 1.0)
        val win = 0.35875 + 0.48829 * cos(PI * r) + 0.14128 * cos(2 * PI * r) + 0.01168 * cos(3 * PI * r)
        sinc * win
    }
}
