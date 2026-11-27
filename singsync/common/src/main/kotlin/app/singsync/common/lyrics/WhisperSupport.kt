package app.singsync.common.lyrics

import app.singsync.common.Resampler
import app.singsync.common.StereoPcm

/** Pure helpers around the speech recogniser (kept out of JNI so they are unit-tested on the JVM). */
object WhisperSupport {
    const val SAMPLE_RATE = 16_000

    /** Stereo 44.1 kHz vocal stem → mono 16 kHz, the input format Whisper expects. */
    fun toWhisperInput(vocals: StereoPcm): FloatArray {
        val mono = FloatArray(vocals.frames) { (vocals.left[it] + vocals.right[it]) * 0.5f }
        return Resampler.resample(mono, vocals.sampleRate, SAMPLE_RATE)
    }

    /** Whisper emits non-lyrics tags for music/silence: "[MUSIC]", "(applause)", "♪", "[_BEG_]"… */
    fun isNoise(text: String): Boolean {
        val t = text.trim()
        if (t.isEmpty()) return true
        if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("(") && t.endsWith(")")) || (t.startsWith("*") && t.endsWith("*"))) return true
        return t.all { !it.isLetterOrDigit() }          // only music notes / punctuation
    }

    /**
     * Whisper-style word list → lyric lines. A new line starts after a pause > [gapMs], after sentence punctuation once the line has
     * >= 3 words, when it reaches [maxWords], or when it would last longer than [maxLineMs]. Times are made monotonic.
     */
    fun groupIntoLines(words: List<LyricWord>, gapMs: Long = 700, maxWords: Int = 9, maxLineMs: Long = 7000): List<LyricLine> {
        val clean = words.filter { !isNoise(it.text) }.map { it.copy(text = it.text.trim()) }
        if (clean.isEmpty()) return emptyList()
        val fixed = ArrayList<LyricWord>(clean.size)
        for (w in clean) {
            val start = maxOf(w.startMs, fixed.lastOrNull()?.endMs ?: 0)
            fixed += LyricWord(w.text, start, maxOf(w.endMs, start + 1))
        }
        val lines = ArrayList<LyricLine>(); var cur = ArrayList<LyricWord>()
        fun flush() { if (cur.isNotEmpty()) { lines += LyricLine(cur); cur = ArrayList() } }
        for (w in fixed) {
            val prev = cur.lastOrNull()
            if (prev != null) {
                val gap = w.startMs - prev.endMs
                val sentenceEnd = prev.text.last() in ".?!;。।॥" && cur.size >= 3
                if (gap > gapMs || sentenceEnd || cur.size >= maxWords || w.endMs - cur.first().startMs > maxLineMs) flush()
            }
            cur += w
        }
        flush()
        return lines
    }
}
