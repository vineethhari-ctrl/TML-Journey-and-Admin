package app.singsync.app.data

import app.singsync.common.StereoPcm
import app.singsync.common.lyrics.Id3Lyrics
import app.singsync.common.lyrics.LrcParser
import app.singsync.common.lyrics.Lyrics
import app.singsync.common.lyrics.LyricsSource
import app.singsync.common.lyrics.VocalActivityAligner
import java.io.File

object LyricsRepo {
    fun load(store: SongStore, id: String): Lyrics? = try { store.lyricsFile(id).takeIf { it.exists() }?.readText()?.let(Lyrics::fromJson) } catch (_: Exception) { null }

    fun save(store: SongStore, id: String, lyrics: Lyrics) {
        val f = store.lyricsFile(id); val tmp = File(f.path + ".tmp")
        tmp.writeText(lyrics.toJson()); if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f) }
        store.update(id) { it.copy(lyricsSource = lyrics.source.name) }
    }

    /** ID3 USLT/SYLT from the original file; plain (untimed) USLT is rough-aligned to the vocal stem. */
    fun findEmbedded(source: File, vocals: StereoPcm): Lyrics? {
        val head = source.inputStream().use { i -> ByteArray(1 shl 20).let { b -> b.copyOf(maxOf(0, i.read(b))) } }
        val l = Id3Lyrics.read(head) ?: return null
        return if (l.source == LyricsSource.EMBEDDED_USLT_ROUGH) VocalActivityAligner.align(l, vocals).copy(source = LyricsSource.EMBEDDED_USLT_ROUGH) else l
    }

    /** Imports a .lrc (timed) or .txt (untimed → rough-aligned to the vocal stem, if available). */
    fun fromImportedText(text: String, vocals: StereoPcm?): Lyrics {
        if (LrcParser.looksTimed(text)) return LrcParser.parse(text)
        val plain = LrcParser.parsePlainText(text)
        return if (vocals != null) VocalActivityAligner.align(plain, vocals) else plain
    }
}
