package app.singsync.ml

import android.content.Context
import app.singsync.common.ChunkPlan
import app.singsync.common.ClassicMidSideSeparator
import app.singsync.common.Separator
import java.io.File

enum class Quality(val label: String, val overlapFraction: Double) {
    /** Lower overlap = ~1.5x faster, slightly more audible chunk seams. */
    FAST("Fast", 0.10),
    /** 25 % overlap with cross-fade: best quality. */
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
    const val MODEL_ASSET = "models/htdemucs_int8.onnx"

    fun hasNeuralModel(context: Context): Boolean = try { context.assets.open(MODEL_ASSET).close(); true } catch (_: Exception) { false }

    fun create(context: Context, quality: Quality, useNnapi: Boolean = false): SeparatorChoice {
        if (hasNeuralModel(context)) {
            val file = materialise(context, MODEL_ASSET)
            return SeparatorChoice(OnnxSeparator(file, "htdemucs-int8", ChunkPlan.DEMUCS_SEGMENT_FRAMES, useNnapi = useNnapi), quality.overlapFraction, false)
        }
        return SeparatorChoice(ClassicMidSideSeparator(), quality.overlapFraction, true)
    }

    private fun materialise(context: Context, asset: String): File {
        val dest = File(context.filesDir, "models/${asset.substringAfterLast('/')}")
        val size = context.assets.openFd(asset).use { it.length }   // asset must be stored uncompressed (see app/build.gradle.kts)
        if (dest.exists() && dest.length() == size) return dest
        dest.parentFile!!.mkdirs()
        val tmp = File(dest.path + ".tmp")
        context.assets.open(asset).use { i -> tmp.outputStream().use { o -> i.copyTo(o, 1 shl 20) } }
        check(tmp.renameTo(dest))
        return dest
    }
}
