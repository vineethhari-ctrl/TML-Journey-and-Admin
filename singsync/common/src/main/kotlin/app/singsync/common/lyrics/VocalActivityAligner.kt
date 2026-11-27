package app.singsync.common.lyrics

import app.singsync.common.StereoPcm
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * "Rough sync" for lyrics that have text but no timings: finds where the isolated VOCAL stem is actually singing
 * (energy VAD with an adaptive threshold) and spreads the lines over those regions proportionally to text length.
 * This is NOT forced alignment (that needs the ASR model, see WordRecognizer); expect errors of a second or more,
 * which is why the result is tagged [LyricsSource.TEXT_ROUGH] and the editor exists.
 */
object VocalActivityAligner {
    data class Region(val startMs: Long, val endMs: Long)

    fun activeRegions(vocals: StereoPcm, frameMs: Int = 20, minGapMs: Int = 400, minLenMs: Int = 200): List<Region> {
        val hop = vocals.sampleRate * frameMs / 1000
        val n = vocals.frames / hop
        if (n == 0) return emptyList()
        val rms = DoubleArray(n) { f ->
            var s = 0.0
            for (i in f * hop until (f + 1) * hop) { val v = (vocals.left[i] + vocals.right[i]) * 0.5; s += v * v }
            sqrt(s / hop)
        }
        val sorted = rms.sorted()
        val floor = sorted[(n * 0.10).toInt()]
        val peak = sorted[(n * 0.95).toInt().coerceAtMost(n - 1)]
        if (peak <= 1e-5) return emptyList()
        val thr = floor + (peak - floor) * 0.12
        val regions = ArrayList<Region>()
        var start = -1; var last = -1
        for (f in 0 until n) {
            if (rms[f] > thr) { if (start < 0) start = f; last = f }
            else if (start >= 0 && (f - last) * frameMs > minGapMs) { regions += Region(start * frameMs.toLong(), (last + 1) * frameMs.toLong()); start = -1 }
        }
        if (start >= 0) regions += Region(start * frameMs.toLong(), (last + 1) * frameMs.toLong())
        return regions.filter { it.endMs - it.startMs >= minLenMs }
    }

    fun align(text: Lyrics, vocals: StereoPcm): Lyrics {
        val regions = activeRegions(vocals)
        if (regions.isEmpty() || text.lines.isEmpty()) return text
        val total = regions.sumOf { it.endMs - it.startMs }
        val weights = text.lines.map { it.words.sumOf { w -> w.text.length }.coerceAtLeast(1) }
        val weightSum = weights.sum()
        // Map a position along the "singing timeline" (silence removed) back to real time.
        fun at(pos: Double): Long {
            var left = pos
            for (r in regions) { val len = (r.endMs - r.startMs).toDouble(); if (left <= len) return r.startMs + left.toLong(); left -= len }
            return regions.last().endMs
        }
        var acc = 0
        val lines = text.lines.mapIndexed { i, line ->
            val s = at(total.toDouble() * acc / weightSum); acc += weights[i]
            val e = at(total.toDouble() * acc / weightSum)
            line.copy(words = Lyrics.splitWords(line.words.joinToString(" ") { it.text }, s, maxOf(e, s + 1)))
        }
        return text.copy(lines = lines, source = LyricsSource.TEXT_ROUGH)
    }
}

/**
 * Speech recogniser seam (whisper.cpp via JNI lives in :core-audio). Input: 16 kHz mono float PCM of the VOCAL stem.
 * Output: lyrics with word timings, grouped into lines.
 */
interface WordRecognizer : AutoCloseable {
    fun transcribe(pcm16kMono: FloatArray, languageHint: String?, isCancelled: () -> Boolean = { false }, onProgress: (Float) -> Unit = {}): Lyrics
    override fun close() {}
}
