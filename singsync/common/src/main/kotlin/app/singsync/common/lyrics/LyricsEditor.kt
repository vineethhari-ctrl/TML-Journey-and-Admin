package app.singsync.common.lyrics

/** Pure edit operations for the lyrics editor. All return a new [Lyrics]; timings stay monotonic. */
object LyricsEditor {
    private fun Lyrics.with(lines: List<LyricLine>) = copy(lines = lines, source = LyricsSource.EDITED)
    private fun <T> List<T>.replaceAt(i: Int, vararg v: T) = take(i) + v + drop(i + 1)

    /** Replace the words of a line, re-spreading them over the line's existing time span. Singer/roman cache reset. */
    fun setLineText(l: Lyrics, index: Int, text: String): Lyrics {
        val old = l.lines[index]
        val words = Lyrics.splitWords(text, old.startMs, maxOf(old.endMs, old.startMs + 1))
        require(words.isNotEmpty()) { "line text must not be empty" }
        return l.with(l.lines.replaceAt(index, old.copy(words = words, roman = null, english = null)))
    }

    /** Shift a whole line; clamped so it never overlaps the previous line's start or goes below 0. */
    fun nudgeLine(l: Lyrics, index: Int, deltaMs: Long): Lyrics {
        val old = l.lines[index]
        val minStart = l.lines.getOrNull(index - 1)?.startMs?.plus(1) ?: 0
        val d = maxOf(deltaMs, minStart - old.startMs)
        return l.with(l.lines.replaceAt(index, old.copy(words = old.words.map { it.copy(startMs = it.startMs + d, endMs = it.endMs + d) })))
    }

    /** Split before word [wordIndex] (1 until size). */
    fun splitLine(l: Lyrics, index: Int, wordIndex: Int): Lyrics {
        val old = l.lines[index]
        require(wordIndex in 1 until old.words.size) { "cannot split here" }
        val a = old.copy(words = old.words.take(wordIndex), roman = null, english = null)
        val b = old.copy(words = old.words.drop(wordIndex), roman = null, english = null)
        return l.with(l.lines.replaceAt(index, a, b))
    }

    fun mergeWithNext(l: Lyrics, index: Int): Lyrics {
        require(index in 0 until l.lines.size - 1) { "no next line" }
        val a = l.lines[index]; val b = l.lines[index + 1]
        return l.with(l.lines.take(index) + a.copy(words = a.words + b.words, roman = null, english = null) + l.lines.drop(index + 2))
    }

    fun deleteLine(l: Lyrics, index: Int) = l.with(l.lines.filterIndexed { i, _ -> i != index })

    fun setSinger(l: Lyrics, index: Int, singer: Singer) = l.with(l.lines.replaceAt(index, l.lines[index].copy(singer = singer)))
}
