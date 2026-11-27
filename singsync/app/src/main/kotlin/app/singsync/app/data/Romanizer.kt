package app.singsync.app.data

import android.icu.text.Transliterator

/** Offline Roman transliteration through Android's bundled ICU (Devanagari, Malayalam, Tamil, Arabic, Cyrillic, …). */
object Romanizer {
    private val t: Transliterator? by lazy {
        try { Transliterator.getInstance("Any-Latin; Latin-ASCII") } catch (_: Exception) { null }
    }
    fun romanize(text: String): String = try { t?.transliterate(text) ?: text } catch (_: Exception) { text }
    /** True if the text has anything that isn't already Latin (so the Roman chip is useful). */
    fun needsRoman(text: String) = text.any { it.code > 0x024F && it.isLetter() }
}
