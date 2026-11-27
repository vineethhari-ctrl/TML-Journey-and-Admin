package app.singsync.common

import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin

class ResamplerTest {
    private fun check(inRate: Int, outRate: Int, freq: Double) {
        val n = inRate * 2
        val x = FloatArray(n) { sin(2 * PI * freq * it / inRate).toFloat() * 0.8f }
        val y = Resampler.resample(x, inRate, outRate)
        assertEquals((n.toLong() * outRate / inRate).toDouble(), y.size.toDouble(), 2.0)
        var maxErr = 0.0
        for (i in 200 until y.size - 200) maxErr = maxOf(maxErr, abs(y[i] - 0.8 * sin(2 * PI * freq * i / outRate)))
        assertTrue("$inRate->$outRate error $maxErr", maxErr < 2e-3)
    }
    @Test fun downsample48kTo44k1() = check(48_000, 44_100, 1_000.0)
    @Test fun upsample22k05To44k1() = check(22_050, 44_100, 3_000.0)
    @Test fun downsample96kTo44k1() = check(96_000, 44_100, 5_000.0)
    @Test fun identityRateIsCopy() { val x = floatArrayOf(1f, 2f); assertArrayEquals(x, Resampler.resample(x, 44100, 44100), 0f) }
}

class FlacEncoderTest {
    private fun ffmpegAvailable() = try { ProcessBuilder("ffmpeg", "-version").redirectErrorStream(true).start().waitFor() == 0 } catch (e: Exception) { false }

    @Test fun roundTripThroughFfmpegIsBitExactAt24Bit() {
        assumeTrue("ffmpeg not installed – skipping external decoder check", ffmpegAvailable())
        val r = java.util.Random(11)
        val n = 4096 * 3 + 777                                   // partial last frame
        val tone = FloatArray(n) { (sin(2 * PI * 440 * it / 44100) * 0.5 + r.nextGaussian() * 0.01).toFloat() }
        val loud = FloatArray(n) { (r.nextFloat() * 2 - 1) }       // incompressible
        val silence = FloatArray(n)
        for ((name, pcm) in listOf("tone" to arrayOf(tone, loud), "silence" to arrayOf(silence, silence), "stereo" to arrayOf(tone, tone))) {
            val flac = File.createTempFile("t-$name", ".flac"); val raw = File.createTempFile("t-$name", ".raw")
            try {
                FlacEncoder.encodeToFile(flac, pcm, 44_100, 24)
                val pb = ProcessBuilder("ffmpeg", "-v", "error", "-err_detect", "crccheck+bitstream", "-y", "-i", flac.path, "-f", "s32le", raw.path).redirectErrorStream(true).start()
                val log = pb.inputStream.bufferedReader().readText()
                assertEquals("ffmpeg complained: $log", 0, pb.waitFor()); assertEquals("ffmpeg complained: $log", "", log.trim())
                val bb = ByteBuffer.wrap(raw.readBytes()).order(ByteOrder.LITTLE_ENDIAN).asIntBuffer()
                assertEquals(n * 2, bb.remaining())
                val max = (1 shl 23) - 1
                for (i in 0 until n) for (c in 0..1) {
                    val expect = Math.round(pcm[c][i].coerceIn(-1f, 1f) * max)
                    assertEquals("$name frame $i ch $c", expect, bb.get(i * 2 + c) shr 8)
                }
            } finally { flac.delete(); raw.delete() }
        }
    }
}
