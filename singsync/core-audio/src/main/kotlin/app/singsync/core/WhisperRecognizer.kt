package app.singsync.core

import android.content.Context
import app.singsync.common.lyrics.LyricWord
import app.singsync.common.lyrics.Lyrics
import app.singsync.common.lyrics.LyricsSource
import app.singsync.common.lyrics.WhisperSupport
import app.singsync.common.lyrics.WordRecognizer
import java.io.File

object WhisperNative {
    interface Callback { fun onProgress(percent: Int); fun isCancelled(): Boolean }

    private val loaded: Boolean = try { System.loadLibrary("singcore"); true } catch (_: UnsatisfiedLinkError) { false }
    private external fun nativeAvailable(): Boolean
    external fun nativeInit(path: String): Long
    external fun nativeFree(handle: Long)
    external fun nativeTranscribe(handle: Long, pcm: FloatArray, lang: String, threads: Int, cb: Callback): Array<Any?>?

    /** True when this build contains whisper.cpp (CI fetched it). */
    val available: Boolean get() = loaded && nativeAvailable()
}

/** whisper.cpp small (q5_1, multilingual) running on the isolated vocal stem. Word timings → grouped into lyric lines. */
class WhisperRecognizer(modelFile: File, private val threads: Int = (Runtime.getRuntime().availableProcessors() - 1).coerceIn(2, 6)) : WordRecognizer {
    private val handle: Long = WhisperNative.nativeInit(modelFile.absolutePath).also { check(it != 0L) { "Could not load the Whisper model" } }

    override fun transcribe(pcm16kMono: FloatArray, languageHint: String?, isCancelled: () -> Boolean, onProgress: (Float) -> Unit): Lyrics {
        val cb = object : WhisperNative.Callback {
            override fun onProgress(percent: Int) = onProgress(percent / 100f)
            override fun isCancelled() = isCancelled()
        }
        val r = WhisperNative.nativeTranscribe(handle, pcm16kMono, languageHint?.takeIf { it.isNotBlank() } ?: "auto", threads, cb)
            ?: if (isCancelled()) throw java.util.concurrent.CancellationException("transcription cancelled") else error("Whisper failed to transcribe this audio")
        @Suppress("UNCHECKED_CAST")
        val t0 = r[0] as LongArray; val t1 = r[1] as LongArray; val texts = r[2] as Array<ByteArray>
        val lang = String(r[3] as ByteArray, Charsets.UTF_8)
        // Whisper times are in 10 ms units. Malformed UTF-8 (rare) is replaced rather than crashing.
        val words = texts.indices.map { LyricWord(String(texts[it], Charsets.UTF_8), t0[it] * 10, t1[it] * 10) }
        return Lyrics(lang, LyricsSource.WHISPER, WhisperSupport.groupIntoLines(words))
    }

    override fun close() { WhisperNative.nativeFree(handle) }

    companion object {
        const val MODEL_ASSET = "models/ggml-small-q5_1.bin"
        fun modelBundled(context: Context): Boolean = try { context.assets.open(MODEL_ASSET).close(); true } catch (_: Exception) { false }
        fun isUsable(context: Context) = WhisperNative.available && modelBundled(context)

        /** Copies the asset to internal storage once (whisper.cpp reads from a path). */
        fun modelFile(context: Context): File {
            val dest = File(context.filesDir, "models/ggml-small-q5_1.bin")
            val size = context.assets.open(MODEL_ASSET).use { i -> var n = 0L; val b = ByteArray(1 shl 16); while (true) { val r = i.read(b); if (r < 0) break; n += r }; n }
            if (dest.exists() && dest.length() == size) return dest
            dest.parentFile!!.mkdirs()
            val tmp = File(dest.path + ".tmp")
            context.assets.open(MODEL_ASSET).use { i -> tmp.outputStream().use { o -> i.copyTo(o, 1 shl 20) } }
            check(tmp.renameTo(dest)) { "could not install the Whisper model" }
            return dest
        }
    }
}
