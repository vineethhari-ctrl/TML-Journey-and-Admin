package app.singsync.common.lyrics

/**
 * Parses .lrc (line timestamps `[mm:ss.xx]`, several stamps per line, `[offset:ms]`) and Enhanced LRC
 * (word stamps `<mm:ss.xx>`). Plain text without any stamp is returned by [parsePlainText] (untimed).
 * Line ends come from the next line's start (capped at 8 s) – LRC has no end times.
 */
object LrcParser {
    private val lineStamp = Regex("\\[(\\d{1,3}):(\\d{1,2})(?:[.:](\\d{1,3}))?]")
    private val wordStamp = Regex("<(\\d{1,3}):(\\d{1,2})(?:[.:](\\d{1,3}))?>")
    private val offsetTag = Regex("^\\[offset:\\s*(-?\\d+)]", RegexOption.IGNORE_CASE)

    fun looksTimed(text: String) = lineStamp.containsMatchIn(text)

    private fun ms(m: String, s: String, frac: String?): Long {
        val f = when (frac?.length) { null -> 0L; 1 -> frac.toLong() * 100; 2 -> frac.toLong() * 10; else -> frac.take(3).toLong() }
        return m.toLong() * 60_000 + s.toLong() * 1000 + f
    }

    fun parse(text: String, language: String? = null): Lyrics {
        var offset = 0L
        val raw = ArrayList<Pair<Long, String>>()
        for (line in text.lineSequence()) {
            val t = line.trim()
            val off = offsetTag.find(t)
            if (off != null) { offset = off.groupValues[1].toLong(); continue }
            val stamps = lineStamp.findAll(t).toList()
            if (stamps.isEmpty()) continue            // metadata tags ([ar:], [ti:]) and junk
            val body = t.substring(stamps.last().range.last + 1).trim()
            // Skip metadata like [ar:Artist] – those don't match numeric stamps, so only real stamps arrive here.
            for (st in stamps) raw += ms(st.groupValues[1], st.groupValues[2], st.groupValues[3].ifEmpty { null }) to body
        }
        raw.sortBy { it.first }
        var enhanced = false
        val lines = ArrayList<LyricLine>()
        for ((i, p) in raw.withIndex()) {
            val start = (p.first + offset).coerceAtLeast(0)
            val nextStart = raw.getOrNull(i + 1)?.let { (it.first + offset).coerceAtLeast(0) }
            val end = minOf(nextStart ?: (start + 5000), start + 8000).coerceAtLeast(start + 1)
            if (p.second.isBlank()) continue          // instrumental gap marker
            val words = if (wordStamp.containsMatchIn(p.second)) { enhanced = true; parseEnhanced(p.second, start, end, offset) } else Lyrics.splitWords(p.second, start, end)
            if (words.isNotEmpty()) lines += LyricLine(words)
        }
        return Lyrics(language, if (enhanced) LyricsSource.LRC_WORD else LyricsSource.LRC, lines)
    }

    private fun parseEnhanced(body: String, lineStart: Long, lineEnd: Long, offset: Long): List<LyricWord> {
        val stamps = wordStamp.findAll(body).toList()
        val out = ArrayList<LyricWord>()
        for ((i, s) in stamps.withIndex()) {
            val textEnd = stamps.getOrNull(i + 1)?.range?.first ?: body.length
            val text = body.substring(s.range.last + 1, textEnd).trim()
            if (text.isEmpty()) continue
            val st = (ms(s.groupValues[1], s.groupValues[2], s.groupValues[3].ifEmpty { null }) + offset).coerceAtLeast(0)
            val en = stamps.getOrNull(i + 1)?.let { (ms(it.groupValues[1], it.groupValues[2], it.groupValues[3].ifEmpty { null }) + offset).coerceAtLeast(0) } ?: lineEnd
            out += LyricWord(text, st, maxOf(en, st + 1))
        }
        // text before the first stamp belongs to the line start
        val lead = body.substring(0, stamps.firstOrNull()?.range?.first ?: 0).trim()
        return if (lead.isNotEmpty()) Lyrics.splitWords(lead, lineStart, out.firstOrNull()?.startMs ?: lineEnd) + out else out
    }

    /** Untimed text: one line per non-blank row, zero timings (use [VocalActivityAligner] to place them). */
    fun parsePlainText(text: String, language: String? = null): Lyrics =
        Lyrics(language, LyricsSource.TEXT_ROUGH, text.lineSequence().map { it.trim() }.filter { it.isNotEmpty() }
            .map { l -> LyricLine(l.split(Regex("\\s+")).map { LyricWord(it, 0, 0) }) }.toList())
}
