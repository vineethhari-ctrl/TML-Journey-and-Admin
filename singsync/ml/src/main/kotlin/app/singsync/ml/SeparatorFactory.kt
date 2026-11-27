package app.singsync.ml

import android.content.Context
import app.singsync.common.ChunkPlan
import app.singsync.common.ClassicMidSideSeparator
import app.singsync.common.Separator
import java.io.File

enum class Quality(val label: String, val overlapFraction: Double) {
    /** Basic centre-channel method (no AI): seconds per song, but vocals bleed through. */
    FAST("Fast", 0.10),
    /** Demucs v4 neural separation, 25 % overlap with cross-fade: the real thing. */
    BEST("Best", 0.25);
    companion object { fun fromName(n: String?) = entries.firstOrNull { it.name == n } ?: BEST }
}

class SeparatorChoice(val separator: Separator, val overlapFraction: Double, val isFallback: Boolean) {
    /** Cache key: a checkpoint is only valid for the same model and chunk geometry. */
    val jobKey: String get() = "${separator.id}|${separator.chunkLen}|$overlapFraction"
}

/**
 * Picks the best separator that is actually bundled. Models are APK assets under `assets/models/`
 * (copied once to internal storage because ONNX Runtime wants a file path, avoiding a giant in-RAM byte array).
 * If no neural model is bundled, falls back to [ClassicMidSideSeparator] and flags it so the UI can say so honestly.
 */
object SeparatorFactory {
    const val MODEL_ASSET = "models/htdemucs.onnx"
    const val MODEL_ID = "htdemucs-fp16w"

    fun hasNeuralModel(context: Context): Boolean = try { context.assets.open(MODEL_ASSET).close(); true } catch (_: Exception) { false }

    /**
     * BEST -> Demucs. If the model is missing from this build (CI model step failed) it degrades to Classic and says so
     * ([SeparatorChoice.isFallback]). FAST -> Classic on purpose.
     */
    fun create(context: Context, quality: Quality, useNnapi: Boolean = false): SeparatorChoice {
        if (quality == Quality.BEST && hasNeuralModel(context)) {
            val file = materialise(context, MODEL_ASSET)
            return SeparatorChoice(OnnxSeparator(file, MODEL_ID, ChunkPlan.DEMUCS_SEGMENT_FRAMES, useNnapi = useNnapi), quality.overlapFraction, false)
        }
        return SeparatorChoice(ClassicMidSideSeparator(), quality.overlapFraction, isFallback = quality == Quality.BEST)
    }

    /** Copy once to internal storage: ONNX Runtime wants a path, and this avoids a 100 MB in-RAM byte array. */
    private fun materialise(context: Context, asset: String): File {
        val dest = File(context.filesDir, "models/${asset.substringAfterLast('/')}")
        val size = context.assets.open(asset).use { i -> var n = 0L; val b = ByteArray(1 shl 16); while (true) { val r = i.read(b); if (r < 0) break; n += r }; n }
        if (dest.exists() && dest.length() == size) return dest
        dest.parentFile!!.mkdirs()
        val tmp = File(dest.path + ".tmp")
        context.assets.open(asset).use { i -> tmp.outputStream().use { o -> i.copyTo(o, 1 shl 20) } }
        check(tmp.renameTo(dest)) { "could not install model" }
        return dest
    }
}
