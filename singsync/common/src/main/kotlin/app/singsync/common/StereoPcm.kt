package app.singsync.common

/** Planar float PCM. [channels] is always 2 inside the pipeline; sample rate is [sampleRate]. */
class StereoPcm(val left: FloatArray, val right: FloatArray, val sampleRate: Int = PIPELINE_SAMPLE_RATE) {
    init { require(left.size == right.size) { "channel length mismatch" } }
    val frames: Int get() = left.size
    val durationMs: Long get() = frames * 1000L / sampleRate
    fun channel(i: Int): FloatArray = if (i == 0) left else right

    companion object {
        const val PIPELINE_SAMPLE_RATE = 44_100
    }
}
