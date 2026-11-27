package app.singsync.app.processing

import android.content.Context
import android.net.Uri
import app.singsync.app.data.Song
import app.singsync.app.data.SongStatus
import app.singsync.app.data.SongStore
import app.singsync.app.data.Stage
import app.singsync.common.FlacEncoder
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

    fun process(songId: String, quality: Quality, useNnapi: Boolean, isCancelled: () -> Boolean, onNote: (String?) -> Unit = {}): Outcome {
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
            store.update(songId) { it.copy(status = SongStatus.DONE, stage = Stage.DONE, progress = 1f, nullTestDb = nullDb) }
            return Outcome.Done
        } catch (_: SeparationCancelled) { return paused(songId)
        } catch (_: java.util.concurrent.CancellationException) { return paused(songId)
        } catch (e: DecodeException) { return failed(songId, e.message ?: "Could not read this file")
        } catch (e: OutOfMemoryError) { return failed(songId, "Not enough memory for this song. Close other apps and retry, or pick Fast quality.")
        } catch (e: Exception) { return failed(songId, e.message ?: e.javaClass.simpleName) }
    }

    private fun paused(id: String): Outcome { store.update(id) { it.copy(status = SongStatus.PAUSED) }; return Outcome.Cancelled }
    private fun failed(id: String, msg: String): Outcome { store.update(id) { it.copy(status = SongStatus.FAILED, error = msg) }; return Outcome.Failed(msg) }
}

