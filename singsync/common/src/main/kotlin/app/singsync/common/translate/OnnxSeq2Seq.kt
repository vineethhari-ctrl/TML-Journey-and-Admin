package app.singsync.common.translate

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.io.File
import java.nio.LongBuffer

/**
 * ONNX Runtime implementation of [Seq2Seq] for the encoder.onnx / decoder.onnx pair written by `marian_export.py`.
 * ORT is `compileOnly` here: the Android app supplies onnxruntime-android at runtime, JVM tests use the desktop artifact
 * (same `ai.onnxruntime` API).
 */
class OnnxSeq2Seq(dir: File, threads: Int = 2) : Seq2Seq {
    private val env = OrtEnvironment.getEnvironment()
    private val opts = OrtSession.SessionOptions().apply { setIntraOpNumThreads(threads) }
    private val enc = env.createSession(File(dir, "encoder.onnx").absolutePath, opts)
    private val dec = env.createSession(File(dir, "decoder.onnx").absolutePath, opts)

    private class Encoded(val hidden: OnnxTensor, val mask: OnnxTensor) : AutoCloseable { override fun close() { hidden.close(); mask.close() } }

    private fun longs(v: LongArray, vararg shape: Long) = OnnxTensor.createTensor(env, LongBuffer.wrap(v), shape)

    override fun encode(ids: IntArray): AutoCloseable {
        val s = ids.size.toLong()
        val inputs = longs(LongArray(ids.size) { ids[it].toLong() }, 1, s)
        val maskIn = longs(LongArray(ids.size) { 1 }, 1, s)
        val result = enc.run(mapOf("input_ids" to inputs, "attention_mask" to maskIn))
        // Keep the hidden state alive beyond the result's scope by re-wrapping it.
        val arr = result[0].value as Array<Array<FloatArray>>
        val hidden = OnnxTensor.createTensor(env, arr)
        result.close(); inputs.close(); maskIn.close()
        return Encoded(hidden, longs(LongArray(ids.size) { 1 }, 1, s))
    }

    override fun nextLogits(encoded: AutoCloseable, decoded: IntArray): FloatArray {
        val e = encoded as Encoded
        longs(LongArray(decoded.size) { decoded[it].toLong() }, 1, decoded.size.toLong()).use { ids ->
            dec.run(mapOf("decoder_input_ids" to ids, "encoder_hidden" to e.hidden, "attention_mask" to e.mask)).use { r ->
                @Suppress("UNCHECKED_CAST")
                return (r[0].value as Array<FloatArray>)[0].copyOf()
            }
        }
    }

    override fun close() { enc.close(); dec.close(); opts.close() }
}
