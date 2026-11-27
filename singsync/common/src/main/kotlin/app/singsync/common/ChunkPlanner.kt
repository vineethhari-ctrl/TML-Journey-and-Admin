package app.singsync.common

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Splits [totalFrames] into fixed-length chunks (the model input size) overlapping by [overlap] frames.
 * Chunk i starts at i*hop. The last chunk is zero-padded by the caller up to [chunkLen]; only [validLen] frames are real.
 */
class ChunkPlan(val totalFrames: Int, val chunkLen: Int, val overlap: Int) {
    init {
        require(totalFrames >= 0)
        require(chunkLen > 0)
        require(overlap in 0 until chunkLen) { "overlap must be in [0, chunkLen)" }
    }

    val hop: Int = chunkLen - overlap

    val count: Int = when {
        totalFrames == 0 -> 0
        totalFrames <= chunkLen -> 1
        else -> 1 + (totalFrames - chunkLen + hop - 1) / hop
    }

    fun start(i: Int): Int = i * hop
    fun validLen(i: Int): Int = minOf(chunkLen, totalFrames - start(i))
    fun isFirst(i: Int) = i == 0
    fun isLast(i: Int) = i == count - 1

    /** Fade-in length at the head of chunk i (0 for the first chunk – nothing to blend with). */
    fun fadeIn(i: Int): Int = if (isFirst(i)) 0 else overlap
    /** Fade-out length at the tail of chunk i (0 for the last chunk). Clamped to the real data. */
    fun fadeOut(i: Int): Int = if (isLast(i)) 0 else overlap

    companion object {
        /** ~7.8 s @ 44.1 kHz = htdemucs training segment (343 980 frames), 25 % overlap by default. */
        const val DEMUCS_SEGMENT_FRAMES = 343_980

        fun forDemucs(totalFrames: Int, overlapFraction: Double = 0.25): ChunkPlan =
            ChunkPlan(totalFrames, DEMUCS_SEGMENT_FRAMES, (DEMUCS_SEGMENT_FRAMES * overlapFraction).roundToInt())
    }
}

/**
 * Cross-fade overlap-add. Fades are sin²/cos² (they sum to exactly 1 in the overlap), so a signal that is
 * identical in both chunks is reproduced bit-for-bit up to float rounding. Output is also normalised by the
 * accumulated weight as a safety net.
 */
class OverlapAdd(private val plan: ChunkPlan, private val stems: Int, private val channels: Int = 2) {
    val out: Array<Array<FloatArray>> = Array(stems) { Array(channels) { FloatArray(plan.totalFrames) } }
    private val weight = FloatArray(plan.totalFrames)
    private val weightedChunks = BooleanArray(plan.count)

    /** [chunk] is [stem][channel][chunkLen] (may be longer than validLen; the padded tail is ignored). */
    fun add(index: Int, chunk: Array<Array<FloatArray>>) {
        val start = plan.start(index)
        val valid = plan.validLen(index)
        val fadeIn = minOf(plan.fadeIn(index), valid)
        val fadeOut = minOf(plan.fadeOut(index), valid)
        for (n in 0 until valid) {
            var w = 1f
            if (n < fadeIn) w = fadeInGain(n, fadeIn)
            val fromEnd = valid - 1 - n
            if (fromEnd < fadeOut) w *= fadeOutGain(fromEnd, fadeOut)
            if (w == 0f) { /* still counts toward nothing */ continue }
            weight[start + n] += w
            for (s in 0 until stems) for (c in 0 until channels) out[s][c][start + n] += chunk[s][c][n] * w
        }
        weightedChunks[index] = true
    }

    /** Divide by accumulated weight. Call once after all chunks were added. */
    fun finish(): Array<Array<FloatArray>> {
        require(weightedChunks.all { it }) { "not all chunks were added" }
        for (n in 0 until plan.totalFrames) {
            val w = weight[n]
            if (w > 0f && w != 1f) for (s in 0 until stems) for (c in 0 until channels) out[s][c][n] /= w
        }
        return out
    }

    companion object {
        /** Rising raised-cosine, position n of len (strictly between 0 and 1 for interior, 0 at n=0 would mute sample 0). */
        fun fadeInGain(n: Int, len: Int): Float {
            val t = (n + 0.5) / len
            val s = sin(PI / 2 * t)
            return (s * s).toFloat()
        }
        fun fadeOutGain(fromEnd: Int, len: Int): Float {
            val t = (fromEnd + 0.5) / len
            val s = sin(PI / 2 * t)
            return (s * s).toFloat()
        }
    }
}
