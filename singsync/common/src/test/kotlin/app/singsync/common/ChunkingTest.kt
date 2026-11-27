package app.singsync.common

import org.junit.Assert.*
import org.junit.Test
import java.util.Random

private fun noise(n: Int, seed: Long = 1): StereoPcm {
    val r = Random(seed)
    return StereoPcm(FloatArray(n) { r.nextFloat() * 2 - 1 }, FloatArray(n) { r.nextFloat() * 2 - 1 })
}

/** Separator whose "vocals" are the input and whose "instrumental" is half of it – isolates the chunking maths. */
private class IdentitySeparator(override val chunkLen: Int) : Separator {
    override val id = "identity"
    var calls = 0
    override fun separate(chunk: Array<FloatArray>): Array<Array<FloatArray>> {
        calls++
        return arrayOf(Array(2) { chunk[it].copyOf() }, Array(2) { c -> FloatArray(chunk[c].size) { chunk[c][it] * 0.5f } })
    }
}

class ChunkPlanTest {
    @Test fun demucsSegmentIsAbout7_8s_with_25pct_overlap() {
        val p = ChunkPlan.forDemucs(44_100 * 240)
        assertEquals(7.8, p.chunkLen / 44_100.0, 0.01)
        assertEquals((p.chunkLen / 4).toDouble(), p.overlap.toDouble(), 1.0)
        assertEquals(p.chunkLen - p.overlap, p.hop)
    }

    @Test fun chunksCoverEveryFrameForAwkwardLengths() {
        for (total in listOf(1, 99, 100, 101, 150, 175, 176, 1000, 12_345)) {
            val p = ChunkPlan(total, 100, 25)
            val covered = BooleanArray(total)
            for (i in 0 until p.count) for (n in 0 until p.validLen(i)) covered[p.start(i) + n] = true
            assertTrue("total=$total", covered.all { it })
            assertTrue("last chunk must be long enough to hold its fade-in (total=$total)", p.count == 1 || p.validLen(p.count - 1) > p.overlap)
        }
        assertEquals(0, ChunkPlan(0, 100, 25).count)
    }
}

class OverlapAddTest {
    private fun roundTrip(total: Int, chunkLen: Int, overlap: Int): Double {
        val input = noise(total)
        val sep = IdentitySeparator(chunkLen)
        val res = SeparationPipeline(sep, overlap.toDouble() / chunkLen, null, "k").run(input)
        var maxErr = 0.0
        for (c in 0 until 2) for (i in 0 until total) {
            maxErr = maxOf(maxErr, kotlin.math.abs(res.vocals.channel(c)[i] - input.channel(c)[i]).toDouble())
            maxErr = maxOf(maxErr, kotlin.math.abs(res.instrumental.channel(c)[i] - input.channel(c)[i] * 0.5f).toDouble())
        }
        return maxErr
    }

    @Test fun crossfadeReconstructsSignal() {
        assertTrue(roundTrip(10_000, 1_000, 250) < 1e-5)
        assertTrue(roundTrip(1_000, 1_000, 250) < 1e-6)   // exactly one chunk
        assertTrue(roundTrip(437, 1_000, 250) < 1e-6)     // shorter than one chunk (zero padded)
        assertTrue(roundTrip(7_777, 1_000, 0) < 1e-6)     // no overlap
    }

    @Test fun fadesSumToOne() {
        for (len in listOf(8, 250, 85_995)) for (n in 0 until len step maxOf(1, len / 17)) {
            val sum = OverlapAdd.fadeInGain(n, len) + OverlapAdd.fadeOutGain(len - 1 - n, len)
            assertEquals(1.0, sum.toDouble(), 1e-6)
        }
    }
}

class PipelineTest {
    @Test fun classicSeparatorPassesNullTest() {
        val input = noise(20_000, 7)
        val sep = ClassicMidSideSeparator(chunkLen = 4_000)
        val res = SeparationPipeline(sep, 0.25, null, "k").run(input)
        val db = NullTest.residualDb(input, res.instrumental, res.vocals)
        assertTrue("null test residual $db dB", db < -100)
    }

    @Test fun cancelThenResumeGivesIdenticalResultAndSkipsFinishedChunks() {
        val dir = java.nio.file.Files.createTempDirectory("ckpt").toFile()
        try {
            val input = noise(10_000, 3)
            val reference = SeparationPipeline(IdentitySeparator(1_000), 0.25, null, "k").run(input)

            val first = IdentitySeparator(1_000)
            var processed = 0
            try {
                SeparationPipeline(first, 0.25, dir, "k").run(input, isCancelled = { processed >= 5 }) { processed = (it * 14).toInt() }
                fail("expected cancellation")
            } catch (_: SeparationCancelled) {}
            val doneBefore = first.calls
            assertTrue(doneBefore in 1..13)

            val second = IdentitySeparator(1_000)
            val resumed = SeparationPipeline(second, 0.25, dir, "k").run(input)
            assertEquals("resume must only compute what is missing", ChunkPlan(10_000, 1_000, 250).count, doneBefore + second.calls)
            assertArrayEquals(reference.vocals.left, resumed.vocals.left, 0f)
            assertArrayEquals(reference.instrumental.right, resumed.instrumental.right, 0f)
            assertFalse("checkpoints are removed after success", dir.exists())
        } finally { dir.deleteRecursively() }
    }

    @Test fun staleCheckpointsFromAnotherModelAreDiscarded() {
        val dir = java.nio.file.Files.createTempDirectory("ckpt").toFile()
        try {
            val input = noise(3_000, 5)
            val a = IdentitySeparator(1_000)
            try { SeparationPipeline(a, 0.25, dir, "model-A").run(input, isCancelled = { a.calls >= 2 }) } catch (_: SeparationCancelled) {}
            val b = IdentitySeparator(1_000)
            SeparationPipeline(b, 0.25, dir, "model-B").run(input)
            assertEquals(ChunkPlan(3_000, 1_000, 250).count, b.calls)
        } finally { dir.deleteRecursively() }
    }
}
