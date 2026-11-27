package app.singsync.common.lyrics

import app.singsync.common.StereoPcm
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayOutputStream
import kotlin.math.PI
import kotlin.math.sin

class LrcParserTest {
    @Test fun parsesLinesMultiStampsOffsetAndSkipsMetadata() {
        val l = LrcParser.parse("[ar:Someone]\n[offset:500]\n[00:10.00]Hello world\n[00:20.50][00:30.5]Chorus line\n[00:25.00]\n")
        assertEquals(listOf("Hello world", "Chorus line", "Chorus line"), l.lines.map { it.text })
        assertEquals(10_500, l.lines[0].startMs)
        assertEquals(21_000, l.lines[1].startMs)
        assertEquals(31_000, l.lines[2].startMs)
        assertEquals(LyricsSource.LRC, l.source)
        assertTrue("blank [00:25.00] marker ends line 1 at the next start, capped", l.lines[0].endMs <= 10_500 + 8000)
    }
    @Test fun parsesEnhancedWordTimes() {
        val l = LrcParser.parse("[00:01.00]<00:01.00>Hel<00:01.40>lo <00:02.00>world")
        assertEquals(LyricsSource.LRC_WORD, l.source)
        assertEquals(listOf(1000L, 1400L, 2000L), l.lines[0].words.map { it.startMs })
    }
    @Test fun plainTextIsUntimed() {
        val l = LrcParser.parsePlainText("one two\n\n three ")
        assertEquals(2, l.lines.size); assertFalse(LrcParser.looksTimed("one two"))
        assertEquals("three", l.lines[1].text)
    }
    @Test fun nonLatinScriptsSurvive() {
        val l = LrcParser.parse("[00:05.00]മലയാളം പാട്ട്\n[00:09.00]यह एक गाना है")
        assertEquals("മലയാളം പാട്ട്", l.lines[0].text); assertEquals(4, l.lines[1].words.size)
    }
    @Test fun jsonRoundTrip() {
        val l = LrcParser.parse("[00:01.00]a b\n[00:03.00]c").copy(language = "ml")
        assertEquals(l, Lyrics.fromJson(l.toJson()))
    }
}

class EditorTest {
    private val base = LrcParser.parse("[00:01.00]one two three\n[00:05.00]four five")
    @Test fun setTextKeepsSpanAndIsMonotonic() {
        val e = LyricsEditor.setLineText(base, 0, "uno dos")
        assertEquals(base.lines[0].startMs, e.lines[0].startMs); assertEquals(base.lines[0].endMs, e.lines[0].endMs)
        assertTrue(e.lines[0].words.zipWithNext().all { (a, b) -> a.endMs <= b.startMs })
        assertEquals(LyricsSource.EDITED, e.source)
    }
    @Test fun nudgeMovesWordsAndClampsAtZeroAndPrevious() {
        assertEquals(1500, LyricsEditor.nudgeLine(base, 0, 500).lines[0].startMs)
        assertEquals(0, LyricsEditor.nudgeLine(base, 0, -5000).lines[0].startMs)
        assertEquals(base.lines[0].startMs + 1, LyricsEditor.nudgeLine(base, 1, -100_000).lines[1].startMs)
    }
    @Test fun splitAndMergeAreInverse() {
        val s = LyricsEditor.splitLine(base, 0, 2)
        assertEquals(listOf("one two", "three", "four five"), s.lines.map { it.text })
        assertEquals(base.lines.map { it.text }, LyricsEditor.mergeWithNext(s, 0).lines.map { it.text })
        assertEquals(base.lines[0].words, LyricsEditor.mergeWithNext(s, 0).lines[0].words)
    }
    @Test(expected = IllegalArgumentException::class) fun splitAtEdgeRejected() { LyricsEditor.splitLine(base, 0, 0) }
}

class AlignerTest {
    /** 30 s of silence with singing bursts (a 300 Hz tone) at the given [startMs, endMs] ranges. */
    private fun vocal(vararg bursts: Pair<Int, Int>): StereoPcm {
        val sr = 44_100; val x = FloatArray(sr * 30)
        for ((s, e) in bursts) for (i in s * sr / 1000 until e * sr / 1000) x[i] = (0.5 * sin(2 * PI * 300 * i / sr)).toFloat()
        return StereoPcm(x, x.copyOf())
    }
    @Test fun findsSingingRegions() {
        val r = VocalActivityAligner.activeRegions(vocal(2000 to 6000, 12_000 to 20_000))
        assertEquals(2, r.size)
        assertEquals(2000.0, r[0].startMs.toDouble(), 60.0); assertEquals(6000.0, r[0].endMs.toDouble(), 60.0)
        assertEquals(12_000.0, r[1].startMs.toDouble(), 60.0)
    }
    @Test fun linesLandInsideSingingAndNeverInTheLongGap() {
        val text = LrcParser.parsePlainText("aaaa aaaa\nbbbb bbbb\ncccc cccc\ndddd dddd")
        val out = VocalActivityAligner.align(text, vocal(2000 to 6000, 12_000 to 20_000))
        assertEquals(4, out.lines.size)
        assertEquals(2000.0, out.lines.first().startMs.toDouble(), 80.0)
        assertEquals(20_000.0, out.lines.last().endMs.toDouble(), 80.0)
        out.lines.zipWithNext().forEach { (a, b) -> assertTrue(a.endMs <= b.startMs + 1) }
        assertTrue("no line may start in the silent gap", out.lines.none { it.startMs in 6_100..11_900 })
        assertEquals(LyricsSource.TEXT_ROUGH, out.source)
    }
    @Test fun silentVocalLeavesTextUntouched() {
        val text = LrcParser.parsePlainText("a b")
        assertEquals(text, VocalActivityAligner.align(text, StereoPcm(FloatArray(44100), FloatArray(44100))))
    }
}

class Id3Test {
    private fun frame(id: String, body: ByteArray, v4: Boolean): ByteArray {
        val o = ByteArrayOutputStream(); o.write(id.toByteArray())
        val n = body.size
        if (v4) o.write(byteArrayOf((n shr 21 and 0x7F).toByte(), (n shr 14 and 0x7F).toByte(), (n shr 7 and 0x7F).toByte(), (n and 0x7F).toByte()))
        else o.write(byteArrayOf((n shr 24).toByte(), (n shr 16).toByte(), (n shr 8).toByte(), n.toByte()))
        o.write(byteArrayOf(0, 0)); o.write(body); return o.toByteArray()
    }
    private fun tag(frames: ByteArray, ver: Int): ByteArray {
        val n = frames.size
        return "ID3".toByteArray() + byteArrayOf(ver.toByte(), 0, 0, (n shr 21 and 0x7F).toByte(), (n shr 14 and 0x7F).toByte(), (n shr 7 and 0x7F).toByte(), (n and 0x7F).toByte()) + frames
    }
    private fun be32(v: Long) = byteArrayOf((v shr 24).toByte(), (v shr 16).toByte(), (v shr 8).toByte(), v.toByte())

    @Test fun readsSyltInUtf8() {
        val b = ByteArrayOutputStream()
        b.write(byteArrayOf(3)); b.write("eng".toByteArray()); b.write(byteArrayOf(2, 1)); b.write(0)       // enc, lang, format=ms, type=lyrics, empty descriptor
        for ((t, s) in listOf(1000L to "hello there", 4000L to "മലയാളം")) { b.write(s.toByteArray()); b.write(0); b.write(be32(t)) }
        val l = Id3Lyrics.read(tag(frame("SYLT", b.toByteArray(), true), 4))!!
        assertEquals(LyricsSource.EMBEDDED_SYLT, l.source); assertEquals("eng", l.language)
        assertEquals(listOf("hello there", "മലയാളം"), l.lines.map { it.text }); assertEquals(4000, l.lines[1].startMs)
    }
    @Test fun readsUsltPlainAndTimedAndUtf16() {
        val plain = ByteArrayOutputStream(); plain.write(byteArrayOf(0)); plain.write("eng".toByteArray()); plain.write(0); plain.write("line one\nline two".toByteArray(Charsets.ISO_8859_1))
        val l = Id3Lyrics.read(tag(frame("USLT", plain.toByteArray(), false), 3))!!
        assertEquals(LyricsSource.EMBEDDED_USLT_ROUGH, l.source); assertEquals(2, l.lines.size)

        val timed = ByteArrayOutputStream(); timed.write(byteArrayOf(1)); timed.write("hin".toByteArray()); timed.write(byteArrayOf(0, 0))
        timed.write("[00:02.00]यह गाना".toByteArray(Charsets.UTF_16))
        val t = Id3Lyrics.read(tag(frame("USLT", timed.toByteArray(), true), 4))!!
        assertEquals(LyricsSource.LRC, t.source); assertEquals("यह गाना", t.lines[0].text); assertEquals(2000, t.lines[0].startMs)
    }
    @Test fun noTagOrNoLyricsGivesNull() {
        assertNull(Id3Lyrics.read(ByteArray(20)))
        assertNull(Id3Lyrics.read(tag(frame("TIT2", byteArrayOf(0, 65), true), 4)))
    }
}

class WhisperSupportTest {
    private fun w(t: String, s: Long, e: Long) = LyricWord(t, s, e)
    @Test fun groupsByPauseAndPunctuationAndDropsNoise() {
        val words = listOf(w("[MUSIC]", 0, 900), w("Hello", 1000, 1300), w("there", 1300, 1600), w("friend.", 1600, 2000), w("How", 2100, 2300), w("are", 2300, 2500), w("you", 2500, 2800),
            w("♪", 2800, 3000), w("fine", 6000, 6400))
        val lines = WhisperSupport.groupIntoLines(words)
        assertEquals(listOf("Hello there friend.", "How are you", "fine"), lines.map { it.text })
        assertTrue(lines.zipWithNext().all { (a, b) -> a.endMs <= b.startMs })
    }
    @Test fun splitsLongRunsAndKeepsTimesMonotonic() {
        val words = (0 until 20).map { w("w$it", it * 300L, it * 300L + 250) } + w("overlap", 100, 200)
        val lines = WhisperSupport.groupIntoLines(words)
        assertTrue(lines.all { it.words.size <= 9 })
        val flat = lines.flatMap { it.words }
        assertTrue(flat.zipWithNext().all { (a, b) -> a.endMs <= b.startMs && a.startMs < a.endMs })
    }
    @Test fun indicSentenceEndSplits() {
        val l = WhisperSupport.groupIntoLines(listOf(w("यह", 0, 200), w("एक", 200, 400), w("गाना", 400, 600), w("है।", 600, 800), w("सुनो", 850, 1100)))
        assertEquals(listOf("यह एक गाना है।", "सुनो"), l.map { it.text })
    }
    @Test fun noiseDetection() { assertTrue(WhisperSupport.isNoise(" [BLANK_AUDIO]")); assertTrue(WhisperSupport.isNoise("♪ ♪")); assertFalse(WhisperSupport.isNoise("മലയാളം")) }
    @Test fun inputIsMono16k() {
        val sr = 44_100; val x = FloatArray(sr * 2) { kotlin.math.sin(2 * Math.PI * 440 * it / sr).toFloat() * 0.5f }
        val out = WhisperSupport.toWhisperInput(StereoPcm(x, x.copyOf()))
        assertEquals(32_000.0, out.size.toDouble(), 2.0)
        assertEquals(0.5, out.drop(1000).take(2000).maxOf { kotlin.math.abs(it) }.toDouble(), 0.02)
    }
}
