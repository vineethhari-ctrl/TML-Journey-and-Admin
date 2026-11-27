package app.singsync.ml

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import app.singsync.common.Separator
import app.singsync.common.Stem
import java.io.File
import java.nio.FloatBuffer

/**
 * Runs a Demucs-family model exported with the tensor contract defined in `models-tools/convert_htdemucs.py`:
 *
 *   input  "mix"     float32 [1, 2, chunkLen]            (44.1 kHz stereo, NOT normalised – the wrapper graph does that)
 *   output "sources" float32 [1, S, 2, chunkLen]         (S stems in [sourceNames] order)
 *
 * Instrumental = sum of every stem except "vocals". STFT/iSTFT live inside the exported graph (see DECISIONS.md D-07).
 */
class OnnxSeparator(
    modelFile: File,
    override val id: String,
    override val chunkLen: Int,
    private val sourceNames: List<String> = listOf("drums", "bass", "other", "vocals"),
    useNnapi: Boolean = false,
    threads: Int = (Runtime.getRuntime().availableProcessors() / 2).coerceIn(2, 6),
) : Separator {
    private val env = OrtEnvironment.getEnvironment()
    private val session: OrtSession
    private val vocalsIdx = sourceNames.indexOf("vocals").also { require(it >= 0) { "model has no vocals stem" } }

    init {
        val opts = OrtSession.SessionOptions().apply {
            setIntraOpNumThreads(threads)
            setMemoryPatternOptimization(false)           // keeps peak RAM lower; chunk shapes are fixed anyway
            setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
            if (useNnapi) try { addNnapi() } catch (_: Exception) { /* CPU fallback */ }
        }
        session = env.createSession(modelFile.absolutePath, opts)
    }

    override fun separate(chunk: Array<FloatArray>): Array<Array<FloatArray>> {
        val n = chunk[0].size
        require(n == chunkLen) { "chunk must be $chunkLen frames" }
        val flat = FloatBuffer.allocate(2 * n).apply { put(chunk[0]); put(chunk[1]); rewind() }
        OnnxTensor.createTensor(env, flat, longArrayOf(1, 2, n.toLong())).use { input ->
            session.run(mapOf("mix" to input)).use { result ->
                @Suppress("UNCHECKED_CAST")
                val sources = (result[0].value as Array<Array<Array<FloatArray>>>)[0]   // [S][2][n]
                val vocals = Array(2) { sources[vocalsIdx][it].copyOf() }
                val inst = Array(2) { FloatArray(n) }
                for (s in sources.indices) if (s != vocalsIdx) for (c in 0 until 2) { val src = sources[s][c]; val dst = inst[c]; for (i in 0 until n) dst[i] += src[i] }
                return arrayOf(vocals, inst).also { check(it.size == Stem.COUNT) }
            }
        }
    }

    override fun close() { session.close() }
}
