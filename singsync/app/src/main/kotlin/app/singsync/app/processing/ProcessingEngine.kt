package app.singsync.app.processing

import android.content.Context
import android.net.Uri
import app.singsync.app.data.LyricsRepo
import app.singsync.app.data.Song
import app.singsync.app.data.SongStatus
import app.singsync.app.data.SongStore
import app.singsync.app.data.Stage
import app.singsync.common.FlacEncoder
import app.singsync.common.StereoPcm
import app.singsync.common.lyrics.Lyrics
import app.singsync.common.lyrics.WhisperSupport
import app.singsync.core.WhisperRecognizer
import app.singsync.common.translate.PackSelector
import app.singsync.ml.TranslationPacks
import app.singsync.common.SeparationCancelled
import app.singsync.common.SeparationPipeline
import app.singsync.core.AudioDecoder
import app.singsync.core.DecodeException
import app.singsync.core.NativeCore
import app.singsync.ml.Quality
import app.singsync.ml.SeparatorFactory
import java.io.File

/**
 * Import → Analysing (decode + resample) → Separating (chunked, resumable) → save lossless FLAC stems.
 * Overall progress: 0-10 % analysing, 10-95 % separating, 95-100 % writing.
 * Blocking; run on a background thread (the foreground service does).
 */
class ProcessingEngine(private val context: Context, private val store: SongStore, private val thermal: ThermalGuard) {

    sealed interface Outcome { data object Done : Outcome; data object Cancelled : Outcome; data class Failed(val message: String) : Outcome }

    fun process(songId: String, quality: Quality, useNnapi: Boolean, settingsLang: String, isCancelled: () -> Boolean, onNote: (String?) -> Unit = {}): Outcome {
        val song = store.get(songId) ?: return Outcome.Failed("Song not found")
        store.update(songId) { it.copy(status = SongStatus.PROCESSING, stage = Stage.ANALYSING, error = null, quality = quality.name) }
        try {
            // ---- Stage 1: Analysing --------------------------------------------------------------------------------
            val pcm = AudioDecoder.decode(store.source(songId), isCancelled) { p ->
                store.updateProgress(songId) { it.copy(progress = p * 0.10f) }
            }
            if (isCancelled()) return paused(songId)
            store.update(songId) { it.copy(durationMs = pcm.durationMs, stage = Stage.SEPARATING, progress = 0.10f) }

            // ---- Stage 2: Separating -------------------------------------------------------------------------------
            val choice = SeparatorFactory.create(context, quality, useNnapi)
            store.update(songId) { it.copy(engine = choice.separator.id, usedFallback = choice.isFallback) }
            val result = choice.separator.use {
                SeparationPipeline(it, choice.overlapFraction, store.checkpoints(songId), choice.jobKey) { _, _ ->
                    thermal.beforeChunk(isCancelled, onNote)
                }.run(pcm, isCancelled) { p -> store.updateProgress(songId) { s -> s.copy(progress = 0.10f + p * 0.85f) } }
            }

            // ---- Stage 3: Save + QA --------------------------------------------------------------------------------
            store.update(songId) { it.copy(progress = 0.95f) }
            FlacEncoder.encodeToFile(store.instrumental(songId), arrayOf(result.instrumental.left, result.instrumental.right), pcm.sampleRate, 24)
            FlacEncoder.encodeToFile(store.vocals(songId), arrayOf(result.vocals.left, result.vocals.right), pcm.sampleRate, 24)
            val nullDb = NativeCore.nullTestDb(pcm, result.instrumental, result.vocals)
            store.update(songId) { it.copy(stage = Stage.LYRICS, progress = 0.98f, nullTestDb = nullDb) }

            // ---- Stage 4: Lyrics – embedded tags first, then on-device Whisper on the vocal stem -------------------------
            var found = LyricsRepo.findEmbedded(store.source(songId), result.vocals)
            var lyricsError: String? = null
            if (found == null && WhisperRecognizer.isUsable(context)) {
                try { found = recognise(songId, result.vocals, settingsLang, isCancelled) }
                catch (e: Exception) { lyricsError = if (isCancelled()) "Lyrics cancelled" else (e.message ?: "Lyrics failed") }
            }
            if (found != null) LyricsRepo.save(store, songId, found)
            store.update(songId) { it.copy(status = SongStatus.DONE, stage = Stage.DONE, progress = 1f, lyricsSource = found?.source?.name ?: it.lyricsSource, lyricsError = lyricsError) }
            return Outcome.Done
        } catch (_: SeparationCancelled) { return paused(songId)
        } catch (_: java.util.concurrent.CancellationException) { return paused(songId)
        } catch (e: DecodeException) { return failed(songId, e.message ?: "Could not read this file")
        } catch (e: OutOfMemoryError) { return failed(songId, "Not enough memory for this song. Close other apps and retry, or pick Fast quality.")
        } catch (e: Exception) { return failed(songId, e.message ?: e.javaClass.simpleName) }
    }

    /** Whisper on a vocal stem; progress is mapped into the last 5 % of the song's overall progress. */
    private fun recognise(songId: String, vocals: StereoPcm, lang: String, isCancelled: () -> Boolean): Lyrics {
        store.update(songId) { it.copy(stage = Stage.LYRICS, progress = 0.95f, lyricsError = null) }
        val input = WhisperSupport.toWhisperInput(vocals)
        return WhisperRecognizer(WhisperRecognizer.modelFile(context)).use { rec ->
            rec.transcribe(input, lang.takeIf { it != "auto" }, isCancelled) { p -> store.updateProgress(songId) { it.copy(progress = 0.95f + 0.05f * p) } }
        }
    }

    /** Re-run lyrics only (user pressed "Transcribe", possibly with another language). Stems stay untouched. */
    fun transcribeOnly(songId: String, lang: String, isCancelled: () -> Boolean): Outcome {
        val song = store.get(songId) ?: return Outcome.Failed("Song not found")
        store.update(songId) { it.copy(status = SongStatus.PROCESSING, stage = Stage.LYRICS, progress = 0.95f, lyricsError = null) }
        return try {
            val vocals = AudioDecoder.decode(store.vocals(songId), isCancelled)
            val l = recognise(songId, vocals, lang, isCancelled)
            check(l.lines.isNotEmpty()) { "No singing was recognised. Try choosing the language manually." }
            LyricsRepo.save(store, songId, l)
            store.update(songId) { it.copy(status = SongStatus.DONE, stage = Stage.DONE, progress = 1f, lyricsSource = l.source.name) }
            Outcome.Done
        } catch (e: Exception) {
            val cancelled = isCancelled()
            store.update(songId) { it.copy(status = SongStatus.DONE, stage = Stage.DONE, progress = 1f, lyricsError = if (cancelled) "Lyrics cancelled" else (e.message ?: "Lyrics failed")) }
            if (cancelled) Outcome.Cancelled else Outcome.Failed(e.message ?: "Lyrics failed")
        }
    }

    /** English meaning for every line, from the bundled opus-mt pack matching the lyrics' language. Fully offline. */
    fun translateLyrics(songId: String, isCancelled: () -> Boolean): Outcome {
        val lyrics = LyricsRepo.load(store, songId) ?: return Outcome.Failed("No lyrics to translate")
        val pair = PackSelector.packFor(lyrics) ?: return Outcome.Failed("These lyrics are already English (or the language is not supported yet)")
        if (!TranslationPacks.isBundled(context, pair)) return Outcome.Failed("The $pair translation pack is missing from this build")
        store.update(songId) { it.copy(status = SongStatus.PROCESSING, stage = Stage.LYRICS, progress = 0.95f, lyricsError = null) }
        return try {
            val (tr, handle) = TranslationPacks.open(context, pair)
            val lines = handle.use {
                lyrics.lines.mapIndexed { i, line ->
                    if (isCancelled()) throw java.util.concurrent.CancellationException()
                    store.updateProgress(songId) { s -> s.copy(progress = 0.95f + 0.05f * i / lyrics.lines.size) }
                    line.copy(english = line.english ?: tr.translate(line.text))
                }
            }
            LyricsRepo.save(store, songId, lyrics.copy(lines = lines), keepSource = true)
            store.update(songId) { it.copy(status = SongStatus.DONE, stage = Stage.DONE, progress = 1f, lyricsMode = "ENGLISH") }
            Outcome.Done
        } catch (e: Exception) {
            val c = isCancelled()
            store.update(songId) { it.copy(status = SongStatus.DONE, stage = Stage.DONE, progress = 1f, lyricsError = if (c) "Translation cancelled" else "Translation failed: ${e.message}") }
            if (c) Outcome.Cancelled else Outcome.Failed(e.message ?: "Translation failed")
        }
    }

    private fun paused(id: String): Outcome { store.update(id) { it.copy(status = SongStatus.PAUSED) }; return Outcome.Cancelled }
    private fun failed(id: String, msg: String): Outcome { store.update(id) { it.copy(status = SongStatus.FAILED, error = msg) }; return Outcome.Failed(msg) }
}

