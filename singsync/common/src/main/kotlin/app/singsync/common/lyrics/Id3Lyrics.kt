package app.singsync.common.lyrics

/** Reads embedded lyrics from an ID3v2.3/2.4 tag: SYLT (synchronised, ms timestamps) preferred over USLT (plain text). */
object Id3Lyrics {
    /** [head] = the first bytes of the file (tag size is in the header; 1 MB is plenty for lyrics). Returns null if none. */
    fun read(head: ByteArray): Lyrics? {
        if (head.size < 10 || head[0] != 'I'.code.toByte() || head[1] != 'D'.code.toByte() || head[2] != '3'.code.toByte()) return null
        val version = head[3].toInt()
        if (version != 3 && version != 4) return null
        val tagSize = synchsafe(head, 6)
        val end = minOf(head.size, 10 + tagSize)
        var p = 10
        if (head[5].toInt() and 0x40 != 0) { // extended header
            p += if (version == 4) synchsafe(head, p) else 4 + int32(head, p)
        }
        var uslt: String? = null; var sylt: List<Pair<Long, String>>? = null; var lang: String? = null
        while (p + 10 <= end) {
            val id = String(head, p, 4, Charsets.ISO_8859_1)
            if (id[0] == '\u0000') break
            val size = if (version == 4) synchsafe(head, p + 4) else int32(head, p + 4)
            val bodyStart = p + 10
            if (size <= 0 || bodyStart + size > end) break
            val body = head.copyOfRange(bodyStart, bodyStart + size)
            when (id) {
                "USLT" -> if (uslt == null) parseUslt(body)?.let { uslt = it.second; lang = it.first }
                "SYLT" -> if (sylt == null) parseSylt(body)?.let { sylt = it.second; lang = it.first }
            }
            p = bodyStart + size
        }
        val lines = sylt
        if (lines != null && lines.isNotEmpty()) {
            val out = lines.mapIndexed { i, (t, text) ->
                val e = lines.getOrNull(i + 1)?.first ?: (t + 5000)
                LyricLine(Lyrics.splitWords(text, t, minOf(e, t + 8000).coerceAtLeast(t + 1)))
            }.filter { it.words.isNotEmpty() }
            if (out.isNotEmpty()) return Lyrics(lang, LyricsSource.EMBEDDED_SYLT, out)
        }
        val plain = uslt ?: return null
        val parsed = if (LrcParser.looksTimed(plain)) LrcParser.parse(plain, lang) else LrcParser.parsePlainText(plain, lang).copy(source = LyricsSource.EMBEDDED_USLT_ROUGH)
        return parsed.takeIf { it.lines.isNotEmpty() }
    }

    private fun parseUslt(b: ByteArray): Pair<String?, String>? {
        if (b.size < 5) return null
        val enc = b[0].toInt()
        val lang = String(b, 1, 3, Charsets.ISO_8859_1).trim().ifBlank { null }
        var p = 4
        p = skipTerminated(b, p, enc)             // content descriptor
        return lang to decode(b, p, b.size, enc)
    }

    private fun parseSylt(b: ByteArray): Pair<String?, List<Pair<Long, String>>>? {
        if (b.size < 7) return null
        val enc = b[0].toInt()
        val lang = String(b, 1, 3, Charsets.ISO_8859_1).trim().ifBlank { null }
        val format = b[4].toInt()                  // 2 = milliseconds (1 = MPEG frames: unsupported)
        if (format != 2) return null
        var p = skipTerminated(b, 6, enc)
        val out = ArrayList<Pair<Long, String>>()
        while (p < b.size) {
            val textEnd = findTerminator(b, p, enc)
            if (textEnd < 0 || textEnd + termLen(enc) + 4 > b.size) break
            val text = decode(b, p, textEnd, enc).trim('\n', '\r')
            val q = textEnd + termLen(enc)
            val t = int32(b, q).toLong() and 0xFFFFFFFFL
            if (text.isNotBlank()) out += t to text
            p = q + 4
        }
        return lang to out
    }

    private fun termLen(enc: Int) = if (enc == 1 || enc == 2) 2 else 1
    private fun findTerminator(b: ByteArray, from: Int, enc: Int): Int {
        if (termLen(enc) == 1) { for (i in from until b.size) if (b[i].toInt() == 0) return i; return -1 }
        var i = from
        while (i + 1 < b.size) { if (b[i].toInt() == 0 && b[i + 1].toInt() == 0) return i; i += 2 }
        return -1
    }
    private fun skipTerminated(b: ByteArray, from: Int, enc: Int): Int { val t = findTerminator(b, from, enc); return if (t < 0) b.size else t + termLen(enc) }
    private fun decode(b: ByteArray, from: Int, to: Int, enc: Int): String {
        if (from >= to) return ""
        val cs = when (enc) { 0 -> Charsets.ISO_8859_1; 1 -> Charsets.UTF_16; 2 -> Charsets.UTF_16BE; else -> Charsets.UTF_8 }
        return String(b, from, to - from, cs).removePrefix("﻿")
    }
    private fun synchsafe(b: ByteArray, o: Int) = ((b[o].toInt() and 0x7F) shl 21) or ((b[o + 1].toInt() and 0x7F) shl 14) or ((b[o + 2].toInt() and 0x7F) shl 7) or (b[o + 3].toInt() and 0x7F)
    private fun int32(b: ByteArray, o: Int) = ((b[o].toInt() and 0xFF) shl 24) or ((b[o + 1].toInt() and 0xFF) shl 16) or ((b[o + 2].toInt() and 0xFF) shl 8) or (b[o + 3].toInt() and 0xFF)
}
