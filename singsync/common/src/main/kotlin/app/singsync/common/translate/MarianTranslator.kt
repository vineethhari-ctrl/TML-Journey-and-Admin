package app.singsync.common.translate

/** Runs one encoder pass and then one decoder step at a time; no KV cache (lyric lines are short). */
interface Seq2Seq : AutoCloseable {
    override fun close() {}
    /** Encode source ids; the handle is passed back to [nextLogits]. */
    fun encode(ids: IntArray): AutoCloseable
    /** Logits over the vocabulary for the token after [decoded] (which starts with decoder_start). */
    fun nextLogits(encoded: AutoCloseable, decoded: IntArray): FloatArray
}

class MarianMeta(val eos: Int, val pad: Int, val decoderStart: Int, val vocabSize: Int, val maxLength: Int)

/**
 * opus-mt translation of a single line: SentencePiece(source) → vocab ids → greedy decode → vocab pieces → SentencePiece(target) detokenise.
 * Greedy (beam 1) with an optional no-repeat-n-gram guard, which stops the degenerate loops small models produce on sung text.
 */
class MarianTranslator(
    private val source: SentencePiece, private val target: SentencePiece, private val vocab: Map<String, Int>,
    private val meta: MarianMeta, private val model: Seq2Seq, private val noRepeatNgram: Int = 3, private val maxSourceTokens: Int = 128,
) {
    private val reverse: Array<String?> = arrayOfNulls<String>(meta.vocabSize).also { for ((k, v) in vocab) if (v < it.size) it[v] = k }
    private val unk = vocab["<unk>"] ?: 1

    fun tokenize(text: String): IntArray =
        (source.encode(text).map { vocab[it] ?: unk }.take(maxSourceTokens - 1) + meta.eos).toIntArray()

    fun greedyIds(src: IntArray, maxNew: Int = meta.maxLength): List<Int> {
        model.encode(src).use { enc ->
            val out = ArrayList<Int>(); out += meta.decoderStart
            repeat(maxNew) {
                val logits = model.nextLogits(enc, out.toIntArray())
                logits[meta.pad] = Float.NEGATIVE_INFINITY            // Marian never generates <pad>
                if (noRepeatNgram > 1) banRepeats(out, logits)
                var best = 0; for (i in 1 until logits.size) if (logits[i] > logits[best]) best = i
                out += best
                if (best == meta.eos) return out.drop(1)
            }
            return out.drop(1)
        }
    }

    private fun banRepeats(seq: List<Int>, logits: FloatArray) {
        val n = noRepeatNgram
        if (seq.size < n) return
        val prefix = seq.subList(seq.size - (n - 1), seq.size)
        for (i in 0..seq.size - n) if (seq.subList(i, i + n - 1) == prefix) logits[seq[i + n - 1]] = Float.NEGATIVE_INFINITY
    }

    fun detokenize(ids: List<Int>): String =
        target.decode(ids.filter { it != meta.eos && it != meta.pad }.mapNotNull { reverse.getOrNull(it) }.filter { it != "<unk>" })

    fun translate(text: String): String = if (text.isBlank()) "" else detokenize(greedyIds(tokenize(text)))
}
