package app.singsync.common.translate

import app.singsync.common.lyrics.Lyrics

/** Which bundled opus-mt pack (if any) translates these lyrics to English. */
object PackSelector {
    fun packFor(lyrics: Lyrics): String? {
        when (lyrics.language?.lowercase()?.take(2)) {
            "hi" -> return "hi-en"
            "ml" -> return "ml-en"
            "en" -> return null
        }
        var dev = 0; var mal = 0; var latin = 0
        for (line in lyrics.lines) for (ch in line.text) when (ch.code) {
            in 0x0900..0x097F -> dev++
            in 0x0D00..0x0D7F -> mal++
            in 0x41..0x5A, in 0x61..0x7A -> latin++
        }
        return when { dev > mal && dev > latin / 2 -> "hi-en"; mal > dev && mal > latin / 2 -> "ml-en"; else -> null }
    }
}
