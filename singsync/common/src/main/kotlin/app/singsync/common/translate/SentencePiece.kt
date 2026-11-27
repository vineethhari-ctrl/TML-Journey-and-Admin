package app.singsync.common.translate

import java.io.ByteArrayInputStream
import java.text.Normalizer

/**
 * Minimal SentencePiece (.spm / ModelProto) reader + encoder/decoder for UNIGRAM and BPE models – enough for the
 * Marian opus-mt models. Normalisation = NFKC + whitespace collapse + "▁" dummy prefix (what opus-mt models use;
 * verified against the Python `sentencepiece` package on hi/ml/en text in SentencePieceTest).
 */
class SentencePiece private constructor(
    private val pieces: List<String>, private val scores: FloatArray, private val types: IntArray, val isBpe: Boolean,
) {
    private val index: Map<String, Int> = pieces.indices.filter { types[it] == NORMAL || types[it] == USER_DEFINED }.associateBy { pieces[it] }
    private val maxLen = pieces.indices.filter { types[it] == NORMAL || types[it] == USER_DEFINED }.maxOfOrNull { pieces[it].codePointCount(0, pieces[it].length) } ?: 1
    private val unkScore = (scores.indices.filter { types[it] == NORMAL }.minOfOrNull { scores[it] } ?: 0f) - 10f

    fun normalize(text: String): String {
        val n = Normalizer.normalize(text, Normalizer.Form.NFKC).replace(Regex("\\s+"), " ").trim()
        return "▁" + n.replace(' ', '▁')
    }

    /** Pieces as surface strings; consecutive unknown characters are merged into ONE piece (not in the vocab → unk), like sentencepiece. */
    fun encode(text: String): List<String> {
        val norm = normalize(text)
        if (norm == "▁") return emptyList()
        val cps = norm.codePoints().toArray()
        return if (isBpe) bpe(cps) else unigram(cps)
    }

    private fun str(cps: IntArray, from: Int, to: Int) = String(cps, from, to - from)

    private fun unigram(cps: IntArray): List<String> {
        val n = cps.size
        val best = FloatArray(n + 1) { Float.NEGATIVE_INFINITY }; val prev = IntArray(n + 1); val isUnk = BooleanArray(n + 1)
        best[0] = 0f
        for (i in 0 until n) {
            if (best[i] == Float.NEGATIVE_INFINITY) continue
            var found = false
            for (len in 1..minOf(maxLen, n - i)) {
                val id = index[str(cps, i, i + len)] ?: continue
                val sc = best[i] + scores[id]
                if (sc > best[i + len]) { best[i + len] = sc; prev[i + len] = i; isUnk[i + len] = false }
                if (len == 1) found = true
            }
            if (!found || index[str(cps, i, i + 1)] == null) {
                val sc = best[i] + unkScore
                if (sc > best[i + 1]) { best[i + 1] = sc; prev[i + 1] = i; isUnk[i + 1] = true }
            }
        }
        val out = ArrayList<Pair<String, Boolean>>()
        var p = n
        while (p > 0) { val s = prev[p]; out += str(cps, s, p) to isUnk[p]; p = s }
        out.reverse()
        return mergeUnk(out)
    }

    private fun bpe(cps: IntArray): List<String> {
        val syms = ArrayList<String>(); for (cp in cps) syms += String(Character.toChars(cp))
        while (true) {
            var bestScore = Float.NEGATIVE_INFINITY; var bestAt = -1
            for (i in 0 until syms.size - 1) {
                val id = index[syms[i] + syms[i + 1]] ?: continue
                if (scores[id] > bestScore) { bestScore = scores[id]; bestAt = i }
            }
            if (bestAt < 0) break
            syms[bestAt] = syms[bestAt] + syms[bestAt + 1]; syms.removeAt(bestAt + 1)
        }
        return mergeUnk(syms.map { it to (it !in index) })
    }

    private fun mergeUnk(parts: List<Pair<String, Boolean>>): List<String> {
        val out = ArrayList<String>(); var unk: StringBuilder? = null
        for ((s, u) in parts) {
            if (u) { if (unk == null) unk = StringBuilder(); unk.append(s) }
            else { unk?.let { out += it.toString(); unk = null }; out += s }
        }
        unk?.let { out += it.toString() }
        return out
    }

    /** Detokenise surface pieces (control/unknown markers dropped). */
    fun decode(pieces: List<String>): String = pieces.joinToString("").replace('▁', ' ').trim()

    companion object {
        const val NORMAL = 1; const val USER_DEFINED = 4

        fun parse(bytes: ByteArray): SentencePiece {
            val ps = ArrayList<String>(); val sc = ArrayList<Float>(); val ty = ArrayList<Int>(); var modelType = 1
            val r = Proto(bytes)
            while (r.hasMore()) {
                val (field, wire) = r.tag()
                when {
                    field == 1 && wire == 2 -> {
                        val m = Proto(r.bytes()); var piece = ""; var score = 0f; var type = NORMAL
                        while (m.hasMore()) { val (f, w) = m.tag()
                            when { f == 1 && w == 2 -> piece = String(m.bytes(), Charsets.UTF_8); f == 2 && w == 5 -> score = m.float32(); f == 3 && w == 0 -> type = m.varint().toInt(); else -> m.skip(w) } }
                        ps += piece; sc += score; ty += type
                    }
                    field == 2 && wire == 2 -> {
                        val t = Proto(r.bytes())
                        while (t.hasMore()) { val (f, w) = t.tag(); if (f == 3 && w == 0) modelType = t.varint().toInt() else t.skip(w) }
                    }
                    else -> r.skip(wire)
                }
            }
            require(ps.isNotEmpty()) { "not a SentencePiece model" }
            return SentencePiece(ps, sc.toFloatArray(), ty.toIntArray(), isBpe = modelType == 2)
        }
    }

    private class Proto(private val b: ByteArray) {
        private var p = 0
        fun hasMore() = p < b.size
        fun varint(): Long { var r = 0L; var s = 0; while (true) { val x = b[p++].toInt(); r = r or ((x and 0x7F).toLong() shl s); if (x and 0x80 == 0) return r; s += 7 } }
        fun tag(): Pair<Int, Int> { val v = varint().toInt(); return (v ushr 3) to (v and 7) }
        fun bytes(): ByteArray { val n = varint().toInt(); val o = b.copyOfRange(p, p + n); p += n; return o }
        fun float32(): Float { val v = (b[p].toInt() and 0xFF) or ((b[p + 1].toInt() and 0xFF) shl 8) or ((b[p + 2].toInt() and 0xFF) shl 16) or ((b[p + 3].toInt() and 0xFF) shl 24); p += 4; return Float.fromBits(v) }
        fun skip(w: Int) { when (w) { 0 -> varint(); 1 -> p += 8; 2 -> { val n = varint().toInt(); p += n }; 5 -> p += 4; else -> error("bad wire type $w") } }
    }
}
