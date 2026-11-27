package app.singsync.common.translate

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File

/** Verifies the Kotlin tokenizer + decode loop against Python (sentencepiece + onnxruntime) on a tiny random Marian fixture. */
class TranslateTest {
    private val dir = File(javaClass.getResource("/marian_tiny/meta.json")!!.toURI()).parentFile
    private val gold = Json.parseToJsonElement(File(dir, "golden.json").readText()).jsonArray.map { it.jsonObject }
    private val vocab = Json.parseToJsonElement(File(dir, "vocab.json").readText()).jsonObject.mapValues { it.value.jsonPrimitive.int }
    private val metaJson = Json.parseToJsonElement(File(dir, "meta.json").readText()).jsonObject
    private val meta = MarianMeta(metaJson["eos"]!!.jsonPrimitive.int, metaJson["pad"]!!.jsonPrimitive.int, metaJson["decoder_start"]!!.jsonPrimitive.int, metaJson["vocab_size"]!!.jsonPrimitive.int, 12)
    private val src = SentencePiece.parse(File(dir, "source.spm").readBytes())
    private val tgt = SentencePiece.parse(File(dir, "target.spm").readBytes())

    @Test fun modelTypesAreDetected() { assertFalse(src.isBpe); assertTrue(tgt.isBpe) }

    @Test fun unigramEncodeMatchesPython() {
        for (g in gold) assertEquals(g["text"]!!.jsonPrimitive.content, g["src_pieces"]!!.jsonArray.map { it.jsonPrimitive.content }, src.encode(g["text"]!!.jsonPrimitive.content))
    }

    @Test fun bpeEncodeAndDecodeMatchPython() {
        for (g in gold) {
            val t = g["text"]!!.jsonPrimitive.content
            assertEquals(t, g["tgt_pieces"]!!.jsonArray.map { it.jsonPrimitive.content }, tgt.encode(t))
        }
        for (i in 0..3) assertEquals(gold[i]["tgt_decode"]!!.jsonPrimitive.content, tgt.decode(tgt.encode(gold[i]["text"]!!.jsonPrimitive.content)))
    }

    @Test fun tokenIdsMatchPython() {
        val tr = MarianTranslator(src, tgt, vocab, meta, NoModel)
        for (g in gold) assertEquals(g["src_ids"]!!.jsonArray.map { it.jsonPrimitive.int }, tr.tokenize(g["text"]!!.jsonPrimitive.content).toList())
    }

    @Test fun greedyDecodeThroughOnnxMatchesPython() {
        OnnxSeq2Seq(dir).use { model ->
            val tr = MarianTranslator(src, tgt, vocab, meta, model, noRepeatNgram = 0)
            for (g in gold) assertEquals(g["text"]!!.jsonPrimitive.content, g["greedy"]!!.jsonArray.map { it.jsonPrimitive.int }, tr.greedyIds(tr.tokenize(g["text"]!!.jsonPrimitive.content), 12))
            assertTrue(tr.translate("यह एक गाना है").isNotEmpty())
        }
    }

    @Test fun noRepeatGuardBreaksLoops() {
        val fake = object : Seq2Seq {
            override fun encode(ids: IntArray) = AutoCloseable {}
            override fun nextLogits(encoded: AutoCloseable, decoded: IntArray) = FloatArray(10).also { it[3] = 5f; it[4] = 1f }   // always prefers token 3
        }
        val m = MarianMeta(eos = 0, pad = 9, decoderStart = 9, vocabSize = 10, maxLength = 8)
        val out = MarianTranslator(src, tgt, mapOf("<unk>" to 1), m, fake, noRepeatNgram = 3).greedyIds(intArrayOf(0))
        val grams = (0..out.size - 3).map { out.subList(it, it + 3) }
        assertEquals("no trigram may occur twice: $out", grams.size, grams.toSet().size)
    }

    private object NoModel : Seq2Seq {
        override fun encode(ids: IntArray) = AutoCloseable {}
        override fun nextLogits(encoded: AutoCloseable, decoded: IntArray) = FloatArray(1)
    }
}

class PackSelectorTest {
    private fun l(text: String, lang: String? = null) = app.singsync.common.lyrics.LrcParser.parse("[00:01.00]$text", lang)
    @Test fun byLanguageTag() { assertEquals("hi-en", PackSelector.packFor(l("x", "hi"))); assertEquals("ml-en", PackSelector.packFor(l("x", "ml"))); assertNull(PackSelector.packFor(l("यह", "en"))) }
    @Test fun byScript() {
        assertEquals("hi-en", PackSelector.packFor(l("यह एक गाना है")))
        assertEquals("ml-en", PackSelector.packFor(l("ഇത് ഒരു പാട്ടാണ്")))
        assertNull(PackSelector.packFor(l("just english words")))
        assertNull(PackSelector.packFor(l("ഇത് hello this is a long english line with a tiny bit of malayalam")))
    }
}
