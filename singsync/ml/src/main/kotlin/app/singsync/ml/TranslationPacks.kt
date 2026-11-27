package app.singsync.ml

import android.content.Context
import app.singsync.common.translate.MarianMeta
import app.singsync.common.translate.MarianTranslator
import app.singsync.common.translate.OnnxSeq2Seq
import app.singsync.common.translate.SentencePiece
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File

/** Bundled opus-mt packs (`assets/models/opus-mt-<pair>/`, produced by CI). Fully offline. */
object TranslationPacks {
    private val FILES = listOf("encoder.onnx", "decoder.onnx", "source.spm", "target.spm", "vocab.json", "meta.json")

    fun isBundled(context: Context, pair: String): Boolean = try {
        context.assets.list("models/opus-mt-$pair")?.toSet()?.containsAll(FILES) == true
    } catch (_: Exception) { false }

    /** Copies the pack to internal storage once (ONNX Runtime wants paths) and returns a translator; close it when done. */
    fun open(context: Context, pair: String): Pair<MarianTranslator, AutoCloseable> {
        val dir = File(context.filesDir, "models/opus-mt-$pair").apply { mkdirs() }
        for (f in FILES) {
            val dest = File(dir, f)
            val size = context.assets.open("models/opus-mt-$pair/$f").use { i -> var n = 0L; val b = ByteArray(1 shl 16); while (true) { val r = i.read(b); if (r < 0) break; n += r }; n }
            if (dest.exists() && dest.length() == size) continue
            val tmp = File(dest.path + ".tmp")
            context.assets.open("models/opus-mt-$pair/$f").use { i -> tmp.outputStream().use { o -> i.copyTo(o, 1 shl 20) } }
            check(tmp.renameTo(dest)) { "could not install translation pack" }
        }
        val json = Json.Default
        val meta = json.parseToJsonElement(File(dir, "meta.json").readText()).jsonObject
        val vocab = json.parseToJsonElement(File(dir, "vocab.json").readText()).jsonObject.mapValues { it.value.jsonPrimitive.int }
        val model = OnnxSeq2Seq(dir)
        val translator = MarianTranslator(
            SentencePiece.parse(File(dir, "source.spm").readBytes()), SentencePiece.parse(File(dir, "target.spm").readBytes()), vocab,
            MarianMeta(meta["eos"]!!.jsonPrimitive.int, meta["pad"]!!.jsonPrimitive.int, meta["decoder_start"]!!.jsonPrimitive.int,
                meta["vocab_size"]!!.jsonPrimitive.int, meta["max_length"]!!.jsonPrimitive.int.coerceAtMost(96)), model)
        return translator to model
    }
}
