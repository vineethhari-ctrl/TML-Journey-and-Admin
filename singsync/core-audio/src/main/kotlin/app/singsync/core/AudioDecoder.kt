package app.singsync.core

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import app.singsync.common.Resampler
import app.singsync.common.StereoPcm
import java.io.File
import java.nio.ByteOrder

class DecodeException(message: String, cause: Throwable? = null) : Exception(message, cause)

/**
 * Decodes any file Android can read (mp3, m4a/aac, wav, flac, ogg…) to 44.1 kHz stereo float PCM, in memory.
 * Mono is duplicated, >2 channels are folded down (front L/R + centre/surround at -3 dB). No dithering, no lossy re-encode.
 */
object AudioDecoder {
    private const val TIMEOUT_US = 10_000L

    fun decode(context: Context, uri: Uri, isCancelled: () -> Boolean = { false }, onProgress: (Float) -> Unit = {}): StereoPcm {
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(context, uri, null)
            return decode(extractor, isCancelled, onProgress)
        } catch (e: DecodeException) { throw e
        } catch (e: java.util.concurrent.CancellationException) { throw e
        } catch (e: Exception) { throw DecodeException("Could not read this audio file (${e.message ?: e.javaClass.simpleName})", e)
        } finally { extractor.release() }
    }

    fun decode(file: File, isCancelled: () -> Boolean = { false }, onProgress: (Float) -> Unit = {}): StereoPcm {
        val extractor = MediaExtractor()
        try { extractor.setDataSource(file.absolutePath); return decode(extractor, isCancelled, onProgress) }
        catch (e: DecodeException) { throw e }
        catch (e: java.util.concurrent.CancellationException) { throw e }
        catch (e: Exception) { throw DecodeException("Could not read this audio file (${e.message ?: e.javaClass.simpleName})", e) }
        finally { extractor.release() }
    }

    private fun decode(extractor: MediaExtractor, isCancelled: () -> Boolean, onProgress: (Float) -> Unit): StereoPcm {
        val track = (0 until extractor.trackCount).firstOrNull {
            extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
        } ?: throw DecodeException("No audio track found in this file")
        extractor.selectTrack(track)
        val format = extractor.getTrackFormat(track)
        val mime = format.getString(MediaFormat.KEY_MIME)!!
        val durationUs = if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION) else 0L
        format.setInteger(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_FLOAT) // honoured on API 24+ decoders that support it

        val codec = try { MediaCodec.createDecoderByType(mime) } catch (e: Exception) { throw DecodeException("This audio format ($mime) is not supported on this device", e) }
        var rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        var pcmEncoding = AudioFormat.ENCODING_PCM_16BIT
        val out = PlanarBuffer(((durationUs / 1_000_000.0) * rate).toInt().coerceAtLeast(1 shl 16))
        try {
            codec.configure(format, null, null, 0)
            codec.start()
            val info = MediaCodec.BufferInfo()
            var inputDone = false
            var outputDone = false
            while (!outputDone) {
                if (isCancelled()) throw java.util.concurrent.CancellationException("decode cancelled")
                if (!inputDone) {
                    val i = codec.dequeueInputBuffer(TIMEOUT_US)
                    if (i >= 0) {
                        val buf = codec.getInputBuffer(i)!!
                        val size = extractor.readSampleData(buf, 0)
                        if (size < 0) { codec.queueInputBuffer(i, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inputDone = true }
                        else {
                            codec.queueInputBuffer(i, 0, size, extractor.sampleTime, 0)
                            if (durationUs > 0) onProgress((extractor.sampleTime.toFloat() / durationUs).coerceIn(0f, 1f))
                            extractor.advance()
                        }
                    }
                }
                val o = codec.dequeueOutputBuffer(info, TIMEOUT_US)
                when {
                    o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val f = codec.outputFormat
                        rate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        channels = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        pcmEncoding = if (f.containsKey(MediaFormat.KEY_PCM_ENCODING)) f.getInteger(MediaFormat.KEY_PCM_ENCODING) else AudioFormat.ENCODING_PCM_16BIT
                    }
                    o >= 0 -> {
                        if (info.size > 0) {
                            val buf = codec.getOutputBuffer(o)!!
                            buf.position(info.offset); buf.limit(info.offset + info.size)
                            buf.order(ByteOrder.nativeOrder())
                            appendInterleaved(buf, channels, pcmEncoding, out)
                        }
                        codec.releaseOutputBuffer(o, false)
                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true
                    }
                }
            }
        } finally {
            try { codec.stop() } catch (_: Exception) {}
            codec.release()
        }
        if (out.size == 0) throw DecodeException("The file contains no decodable audio")
        val l = out.left(); val r = out.right()
        return if (rate == StereoPcm.PIPELINE_SAMPLE_RATE) StereoPcm(l, r)
        else StereoPcm(Resampler.resample(l, rate, StereoPcm.PIPELINE_SAMPLE_RATE), Resampler.resample(r, rate, StereoPcm.PIPELINE_SAMPLE_RATE))
    }

    private fun appendInterleaved(buf: java.nio.ByteBuffer, channels: Int, encoding: Int, out: PlanarBuffer) {
        val bytesPer = if (encoding == AudioFormat.ENCODING_PCM_FLOAT) 4 else 2
        val frames = buf.remaining() / (bytesPer * channels)
        val fb = if (encoding == AudioFormat.ENCODING_PCM_FLOAT) buf.asFloatBuffer() else null
        val sb = if (encoding != AudioFormat.ENCODING_PCM_FLOAT) buf.asShortBuffer() else null
        out.ensure(frames)
        for (f in 0 until frames) {
            var l = 0f; var r = 0f
            var extra = 0f
            for (c in 0 until channels) {
                val v = if (fb != null) fb.get() else sb!!.get() / 32768f
                when {
                    channels == 1 -> { l = v; r = v }
                    c == 0 -> l = v
                    c == 1 -> r = v
                    else -> extra += v
                }
            }
            if (channels > 2) { val e = extra * 0.7071f / (channels - 2); l += e; r += e }
            out.put(l, r)
        }
    }

    /** Growable planar float buffer (avoids boxing and big copies for long files). */
    private class PlanarBuffer(initial: Int) {
        private var l = FloatArray(initial); private var r = FloatArray(initial)
        var size = 0; private set
        fun ensure(extra: Int) { if (size + extra > l.size) { val n = maxOf(l.size * 3 / 2, size + extra); l = l.copyOf(n); r = r.copyOf(n) } }
        fun put(a: Float, b: Float) { l[size] = a; r[size] = b; size++ }
        fun left(): FloatArray = l.copyOf(size)
        fun right(): FloatArray = r.copyOf(size)
    }
}
