package app.singsync.app.data

import kotlinx.serialization.Serializable

enum class SongStatus { QUEUED, PROCESSING, PAUSED, DONE, FAILED }
enum class Stage { ANALYSING, SEPARATING, LYRICS, DONE }

@Serializable
data class Song(
    val id: String,
    val title: String,
    val artist: String = "",
    val durationMs: Long = 0,
    val addedAt: Long = System.currentTimeMillis(),
    val sourceName: String = "",
    val status: SongStatus = SongStatus.QUEUED,
    val stage: Stage = Stage.ANALYSING,
    /** Overall 0..1 across all stages. */
    val progress: Float = 0f,
    val quality: String = "BEST",
    /** Separator id used, e.g. "htdemucs-int8" or "classic-midside". */
    val engine: String? = null,
    /** True when no neural model was bundled and the low-quality Classic fallback produced the stems. */
    val usedFallback: Boolean = false,
    val nullTestDb: Double? = null,
    val hasCover: Boolean = false,
    val error: String? = null,
)
