package app.singsync.common

import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

class SeparationCancelled : RuntimeException("Separation cancelled")

class SeparationResult(val vocals: StereoPcm, val instrumental: StereoPcm)

/**
 * Chunked, cancellable, resumable separation.
 *
 * - Each finished chunk is checkpointed to [checkpointDir]; a restarted run (after cancel, crash or process
 *   death) skips chunks that already exist. A `meta` file keyed by [jobKey] invalidates stale checkpoints.
 * - [beforeChunk] is a hook for thermal throttling / cooperative pausing (may block).
 * - Peak memory = input + 2 output stems + one chunk, independent of model size.
 */
class SeparationPipeline(
    private val separator: Separator,
    private val overlapFraction: Double,
    private val checkpointDir: File?,
    private val jobKey: String,
    private val beforeChunk: (index: Int, count: Int) -> Unit = { _, _ -> },
) {
    fun run(input: StereoPcm, isCancelled: () -> Boolean = { false }, onProgress: (Float) -> Unit = {}): SeparationResult {
        val total = input.frames
        val len = separator.chunkLen
        val plan = ChunkPlan(total, len, (len * overlapFraction).toInt())
        val acc = OverlapAdd(plan, Stem.COUNT)
        prepareCheckpoints()
        val chunk = Array(2) { FloatArray(len) }
        onProgress(0f)
        for (i in 0 until plan.count) {
            if (isCancelled()) throw SeparationCancelled()
            val stems = loadCheckpoint(i, len) ?: run {
                beforeChunk(i, plan.count)
                if (isCancelled()) throw SeparationCancelled()
                val start = plan.start(i); val valid = plan.validLen(i)
                for (c in 0 until 2) {
                    java.util.Arrays.fill(chunk[c], 0f)
                    System.arraycopy(input.channel(c), start, chunk[c], 0, valid)
                }
                separator.separate(chunk).also { saveCheckpoint(i, it) }
            }
            acc.add(i, stems)
            onProgress((i + 1f) / plan.count)
        }
        val out = acc.finish()
        clearCheckpoints()
        return SeparationResult(
            vocals = StereoPcm(out[Stem.VOCALS][0], out[Stem.VOCALS][1], input.sampleRate),
            instrumental = StereoPcm(out[Stem.INSTRUMENTAL][0], out[Stem.INSTRUMENTAL][1], input.sampleRate),
        )
    }

    // ---- checkpoints -------------------------------------------------------------------------------------------
    private fun prepareCheckpoints() {
        val dir = checkpointDir ?: return
        dir.mkdirs()
        val meta = File(dir, "meta")
        if (!meta.exists() || meta.readText() != jobKey) {
            dir.listFiles()?.forEach { it.delete() }
            meta.writeText(jobKey)
        }
    }

    private fun chunkFile(i: Int) = File(checkpointDir, "chunk_%05d.bin".format(i))

    private fun saveCheckpoint(i: Int, stems: Array<Array<FloatArray>>) {
        if (checkpointDir == null) return
        val tmp = File(checkpointDir, "chunk_%05d.tmp".format(i))
        DataOutputStream(tmp.outputStream().buffered(1 shl 16)).use { os ->
            val bb = ByteBuffer.allocate(4 * stems[0][0].size).order(ByteOrder.LITTLE_ENDIAN)
            for (s in stems) for (c in s) { bb.clear(); bb.asFloatBuffer().put(c); os.write(bb.array()) }
        }
        tmp.renameTo(chunkFile(i)) // atomic: a half-written file never looks like a finished chunk
    }

    private fun loadCheckpoint(i: Int, len: Int): Array<Array<FloatArray>>? {
        if (checkpointDir == null) return null
        val f = chunkFile(i)
        if (!f.exists() || f.length() != Stem.COUNT * 2L * len * 4) return null
        return DataInputStream(f.inputStream().buffered(1 shl 16)).use { ins ->
            val bytes = ByteArray(4 * len)
            Array(Stem.COUNT) { Array(2) {
                ins.readFully(bytes)
                FloatArray(len).also { ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(it) }
            } }
        }
    }

    private fun clearCheckpoints() { checkpointDir?.deleteRecursively() }
}

/** Reconstruction check: residual energy of (instrumental + vocals - original) relative to the original, in dB. */
object NullTest {
    fun residualDb(original: StereoPcm, a: StereoPcm, b: StereoPcm): Double {
        var num = 0.0; var den = 0.0
        for (c in 0 until 2) {
            val o = original.channel(c); val x = a.channel(c); val y = b.channel(c)
            for (i in o.indices) { val r = (x[i] + y[i] - o[i]).toDouble(); num += r * r; den += o[i].toDouble() * o[i] }
        }
        if (den == 0.0) return Double.NEGATIVE_INFINITY
        if (num == 0.0) return -300.0
        return 10 * kotlin.math.log10(num / den)
    }
}
