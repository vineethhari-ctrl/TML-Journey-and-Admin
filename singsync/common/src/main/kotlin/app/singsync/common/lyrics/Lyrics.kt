package app.singsync.common.lyrics

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

enum class Singer { A, B, BOTH }

@Serializable
data class LyricWord(val text: String, val startMs: Long, val endMs: Long)

@Serializable
data class LyricLine(
    val words: List<LyricWord>,
    val singer: Singer = Singer.A,
    /** Cached Roman transliteration / English meaning of the whole line (filled lazily by the app). */
    val roman: String? = null,
    val english: String? = null,
) {
    val startMs: Long get() = words.firstOrNull()?.startMs ?: 0
    val endMs: Long get() = words.lastOrNull()?.endMs ?: 0
    val text: String get() = words.joinToString(" ") { it.text }
}

/** How the timings were produced – shown in the UI so rough syncs are never mistaken for exact ones. */
enum class LyricsSource { LRC, LRC_WORD, EMBEDDED_SYLT, EMBEDDED_USLT_ROUGH, TEXT_ROUGH, WHISPER, EDITED }

@Serializable
data class Lyrics(val language: String? = null, val source: LyricsSource, val lines: List<LyricLine>, val version: Int = 1) {
    fun toJson(): String = JSON.encodeToString(serializer(), this)
    companion object {
        private val JSON = Json { ignoreUnknownKeys = true; encodeDefaults = true }
        fun fromJson(s: String): Lyrics = JSON.decodeFromString(serializer(), s)

        /** Words of [text] get time proportionally to their length inside [startMs, endMs). */
        fun splitWords(text: String, startMs: Long, endMs: Long): List<LyricWord> {
            val toks = text.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
            if (toks.isEmpty()) return emptyList()
            val total = toks.sumOf { it.length }.coerceAtLeast(1)
            val span = (endMs - startMs).coerceAtLeast(toks.size.toLong())
            var acc = 0
            return toks.map { t ->
                val s = startMs + span * acc / total
                acc += t.length
                LyricWord(t, s, startMs + span * acc / total)
            }
        }
    }
}
