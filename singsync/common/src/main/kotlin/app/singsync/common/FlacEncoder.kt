package app.singsync.common

import java.io.OutputStream
import java.io.RandomAccessFile
import java.security.MessageDigest
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Minimal lossless FLAC encoder (pure Kotlin, API 26 safe: MediaCodec has no FLAC encoder before API 27).
 * Fixed predictors (order 0-4) with partitioned Rice coding, independent stereo, 24-bit, fixed 4096 block size.
 * Writes a correct STREAMINFO (incl. MD5) so any decoder can verify integrity. Typical ratio ~55-65 % of PCM.
 */
class FlacEncoder(
    private val out: OutputStream,
    private val sampleRate: Int,
    private val channels: Int = 2,
    private val bitsPerSample: Int = 24,
    private val blockSize: Int = 4096,
) {
    private val md5 = MessageDigest.getInstance("MD5")
    private var frameNumber = 0L
    private var totalSamples = 0L
    private var minFrame = Int.MAX_VALUE
    private var maxFrame = 0
    private val bytesPerSample = (bitsPerSample + 7) / 8
    private val maxInt = (1 shl (bitsPerSample - 1)) - 1
    private val buffered = Array(channels) { IntArray(blockSize) }
    private var buffered_n = 0
    private var headerWritten = false
    private val streamInfoPlaceholder = ByteArray(34 + 4)

    private fun writeHeader() {
        out.write("fLaC".toByteArray(Charsets.US_ASCII))
        // Placeholder STREAMINFO (last-metadata-block flag set); patched by [patchStreamInfo] once totals are known.
        out.write(streamInfoPlaceholder)
        headerWritten = true
    }

    /** Append planar float samples in [-1, 1]. */
    fun write(planar: Array<FloatArray>, offset: Int = 0, length: Int = planar[0].size - offset) {
        if (!headerWritten) writeHeader()
        var i = 0
        while (i < length) {
            val n = minOf(blockSize - buffered_n, length - i)
            for (c in 0 until channels) {
                val src = planar[c]
                val dst = buffered[c]
                for (j in 0 until n) {
                    dst[buffered_n + j] = (src[offset + i + j].coerceIn(-1f, 1f) * maxInt).roundToInt().coerceIn(-maxInt - 1, maxInt)
                }
            }
            buffered_n += n
            i += n
            if (buffered_n == blockSize) flushBlock()
        }
    }

    /** Finish the stream. Returns the final STREAMINFO block bytes (caller patches them in, see [encodeToFile]). */
    fun finish(): ByteArray {
        if (!headerWritten) writeHeader()
        if (buffered_n > 0) flushBlock()
        out.flush()
        return buildStreamInfo()
    }

    private fun flushBlock() {
        val n = buffered_n
        // MD5 over interleaved little-endian signed samples, per FLAC spec.
        val md = ByteArray(n * channels * bytesPerSample)
        var p = 0
        for (j in 0 until n) for (c in 0 until channels) {
            val v = buffered[c][j]
            for (b in 0 until bytesPerSample) md[p++] = (v shr (8 * b)).toByte()
        }
        md5.update(md)

        val bw = BitWriter(n * channels * bytesPerSample + 64)
        writeFrameHeader(bw, n)
        for (c in 0 until channels) writeSubframe(bw, buffered[c], n)
        bw.alignZero()
        val bytes = bw.toByteArray()
        val crc16 = Crc.crc16(bytes, bytes.size)
        out.write(bytes)
        out.write(crc16 shr 8); out.write(crc16 and 0xFF)
        val size = bytes.size + 2
        minFrame = minOf(minFrame, size); maxFrame = maxOf(maxFrame, size)
        frameNumber++
        totalSamples += n
        buffered_n = 0
    }

    private fun writeFrameHeader(bw: BitWriter, n: Int) {
        bw.bits(0x3FFE, 14); bw.bits(0, 1); bw.bits(0, 1)           // sync, reserved, fixed block size strategy
        val bsCode = if (n == 4096) 12 else if (n - 1 < 256) 6 else 7
        bw.bits(bsCode, 4)
        val srCode = when (sampleRate) { 44100 -> 9; 48000 -> 10; 96000 -> 11; 32000 -> 8; else -> 0 } // 0 = take from STREAMINFO
        bw.bits(srCode, 4)
        bw.bits(channels - 1, 4)                                      // independent channel assignment
        val bpsCode = when (bitsPerSample) { 8 -> 1; 12 -> 2; 16 -> 4; 20 -> 5; 24 -> 6; else -> 0 }
        bw.bits(bpsCode, 3); bw.bits(0, 1)
        bw.utf8(frameNumber)
        if (bsCode == 6) bw.bits(n - 1, 8) else if (bsCode == 7) bw.bits(n - 1, 16)
        val hdr = bw.toByteArray()
        bw.bits(Crc.crc8(hdr, hdr.size), 8)
    }

    private fun writeSubframe(bw: BitWriter, x: IntArray, n: Int) {
        // Constant?
        var allSame = true
        for (j in 1 until n) if (x[j] != x[0]) { allSame = false; break }
        if (allSame) { bw.bits(0, 1); bw.bits(0b000000, 6); bw.bits(0, 1); bw.signed(x[0], bitsPerSample); return }

        var bestOrder = -1
        var bestBits = Long.MAX_VALUE
        var bestRes: IntArray? = null
        var bestPart = 0
        var bestParams: IntArray? = null
        for (order in 0..4) {
            if (n <= order) break
            val res = residual(x, n, order)
            val (po, params, bits) = bestRice(res, order, n)
            val total = bits + order.toLong() * bitsPerSample
            if (total < bestBits) { bestBits = total; bestOrder = order; bestRes = res; bestPart = po; bestParams = params }
        }
        val verbatimBits = n.toLong() * bitsPerSample
        if (bestOrder < 0 || bestBits >= verbatimBits) {
            bw.bits(0, 1); bw.bits(0b000001, 6); bw.bits(0, 1)
            for (j in 0 until n) bw.signed(x[j], bitsPerSample)
            return
        }
        bw.bits(0, 1); bw.bits(0b001000 or bestOrder, 6); bw.bits(0, 1)
        for (j in 0 until bestOrder) bw.signed(x[j], bitsPerSample)
        bw.bits(1, 2)                                            // Rice coding method with 5-bit parameters
        bw.bits(bestPart, 4)
        val parts = 1 shl bestPart
        val per = n / parts
        val res = bestRes!!; val params = bestParams!!
        var idx = bestOrder
        for (p in 0 until parts) {
            val count = if (p == 0) per - bestOrder else per
            val k = params[p]
            bw.bits(k, 5)
            for (j in 0 until count) bw.rice(zigzag(res[idx++]), k)
        }
    }

    /** residual[j] for j in order until n (stored at index j to keep warm-up alignment simple). */
    private fun residual(x: IntArray, n: Int, order: Int): IntArray {
        val r = IntArray(n)
        for (j in order until n) {
            r[j] = when (order) {
                0 -> x[j]
                1 -> x[j] - x[j - 1]
                2 -> x[j] - 2 * x[j - 1] + x[j - 2]
                3 -> x[j] - 3 * x[j - 1] + 3 * x[j - 2] - x[j - 3]
                else -> x[j] - 4 * x[j - 1] + 6 * x[j - 2] - 4 * x[j - 3] + x[j - 4]
            }
        }
        return r
    }

    private fun zigzag(v: Int): Long = if (v >= 0) (v.toLong() shl 1) else ((-v.toLong() shl 1) - 1)

    private data class RiceChoice(val partOrder: Int, val params: IntArray, val bits: Long)

    private fun bestRice(res: IntArray, order: Int, n: Int): RiceChoice {
        var best: RiceChoice? = null
        var po = 0
        while (po <= 8) {
            val parts = 1 shl po
            if (n % parts != 0 || n / parts <= order) break
            val per = n / parts
            val params = IntArray(parts)
            var bits = 6L + 4 // method + order fields
            var idx = order
            for (p in 0 until parts) {
                val count = if (p == 0) per - order else per
                var sum = 0L
                for (j in 0 until count) sum += zigzag(res[idx + j])
                var k = 0
                if (count > 0) {
                    val mean = sum / count
                    while (k < 30 && (1L shl (k + 1)) <= mean) k++
                }
                // evaluate k and k+1 exactly, keep better
                var bestK = k; var bestCost = Long.MAX_VALUE
                for (cand in maxOf(0, k - 1)..minOf(30, k + 1)) {
                    var cost = 0L
                    for (j in 0 until count) cost += (zigzag(res[idx + j]) shr cand) + 1 + cand
                    if (cost < bestCost) { bestCost = cost; bestK = cand }
                }
                params[p] = bestK
                bits += 5 + bestCost
                idx += count
            }
            if (best == null || bits < best.bits) best = RiceChoice(po, params, bits)
            po++
        }
        return best!!
    }

    private fun buildStreamInfo(): ByteArray {
        val b = BitWriter(38)
        b.bits(1, 1); b.bits(0, 7)                     // last block flag + type 0 (STREAMINFO)
        b.bits(34, 24)
        b.bits(blockSize, 16); b.bits(blockSize, 16)   // min/max block size
        b.bits(if (minFrame == Int.MAX_VALUE) 0 else minFrame, 24); b.bits(maxFrame, 24)
        b.bits(sampleRate, 20); b.bits(channels - 1, 3); b.bits(bitsPerSample - 1, 5)
        b.bits((totalSamples ushr 32).toInt() and 0xF, 4); b.bits((totalSamples and 0xFFFFFFFFL).toInt(), 32)
        val digest = md5.digest()
        for (d in digest) b.bits(d.toInt() and 0xFF, 8)
        return b.toByteArray()
    }

    companion object {
        /** Encode planar float PCM to [file]; patches STREAMINFO after the pass. */
        fun encodeToFile(file: java.io.File, pcm: Array<FloatArray>, sampleRate: Int, bits: Int = 24) {
            val tmp = java.io.File(file.path + ".tmp")
            var info = ByteArray(0)
            java.io.BufferedOutputStream(java.io.FileOutputStream(tmp), 1 shl 16).use { os ->
                val enc = FlacEncoder(os, sampleRate, pcm.size, bits)
                enc.write(pcm)
                info = enc.finish()
            }
            RandomAccessFile(tmp, "rw").use { raf -> raf.seek(4); raf.write(info) }
            if (file.exists()) file.delete()
            check(tmp.renameTo(file)) { "could not move $tmp to $file" }
        }
    }
}

internal class BitWriter(capacity: Int) {
    private var buf = ByteArray(maxOf(capacity, 64))
    private var bytePos = 0
    private var cur = 0L
    private var curBits = 0

    fun bits(value: Int, n: Int) = bitsLong(value.toLong() and ((1L shl n) - 1), n)
    fun bitsLong(value: Long, n: Int) {
        var left = n
        while (left > 0) {
            val take = minOf(left, 32)
            val chunk = (value ushr (left - take)) and ((1L shl take) - 1)
            cur = (cur shl take) or chunk
            curBits += take
            left -= take
            while (curBits >= 8) { put(((cur ushr (curBits - 8)) and 0xFF).toInt()); curBits -= 8 }
            cur = cur and ((1L shl curBits) - 1)
        }
    }
    fun signed(v: Int, n: Int) = bitsLong(v.toLong() and ((1L shl n) - 1), n)
    fun alignZero() { if (curBits > 0) { bitsLong(0, 8 - curBits) } }
    /** Unary quotient then k-bit remainder. */
    fun rice(z: Long, k: Int) {
        var q = z shr k
        while (q >= 32) { bitsLong(0, 32); q -= 32 }
        bitsLong(0, q.toInt()); bitsLong(1, 1)
        if (k > 0) bitsLong(z and ((1L shl k) - 1), k)
    }
    fun utf8(v: Long) {
        when {
            v < 0x80 -> bitsLong(v, 8)
            v < 0x800 -> { bitsLong(0xC0L or (v shr 6), 8); bitsLong(0x80L or (v and 0x3F), 8) }
            v < 0x10000 -> { bitsLong(0xE0L or (v shr 12), 8); cont(v, 6); cont(v, 0) }
            v < 0x200000 -> { bitsLong(0xF0L or (v shr 18), 8); cont(v, 12); cont(v, 6); cont(v, 0) }
            v < 0x4000000 -> { bitsLong(0xF8L or (v shr 24), 8); cont(v, 18); cont(v, 12); cont(v, 6); cont(v, 0) }
            else -> { bitsLong(0xFCL or (v shr 30), 8); cont(v, 24); cont(v, 18); cont(v, 12); cont(v, 6); cont(v, 0) }
        }
    }
    private fun cont(v: Long, shift: Int) = bitsLong(0x80L or ((v shr shift) and 0x3F), 8)
    private fun put(b: Int) { if (bytePos == buf.size) buf = buf.copyOf(buf.size * 2); buf[bytePos++] = b.toByte() }
    /** Bytes written so far (whole bytes only; call after [alignZero] when closing). */
    fun toByteArray(): ByteArray = buf.copyOf(bytePos)
}

internal object Crc {
    private val t8 = IntArray(256) { i -> var c = i; repeat(8) { c = if (c and 0x80 != 0) (c shl 1) xor 0x07 else c shl 1 }; c and 0xFF }
    private val t16 = IntArray(256) { i -> var c = i shl 8; repeat(8) { c = if (c and 0x8000 != 0) (c shl 1) xor 0x8005 else c shl 1 }; c and 0xFFFF }
    fun crc8(b: ByteArray, n: Int): Int { var c = 0; for (i in 0 until n) c = t8[(c xor (b[i].toInt() and 0xFF))]; return c }
    fun crc16(b: ByteArray, n: Int): Int { var c = 0; for (i in 0 until n) c = ((c shl 8) and 0xFFFF) xor t16[((c shr 8) xor (b[i].toInt() and 0xFF)) and 0xFF]; return c }
}
