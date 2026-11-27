package app.singsync.app.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.File

/** Library persisted as one small JSON file (atomic write). Audio lives in `songs/<id>/` next to it. */
class SongStore(context: Context) {
    private val root = File(context.filesDir, "songs").apply { mkdirs() }
    private val index = File(context.filesDir, "library.json")
    private val json = Json { ignoreUnknownKeys = true; prettyPrint = false }
    private val _songs = MutableStateFlow(load())
    val songs: StateFlow<List<Song>> = _songs.asStateFlow()

    fun dir(id: String) = File(root, id).apply { mkdirs() }
    fun source(id: String) = File(dir(id), "source")
    fun cover(id: String) = File(dir(id), "cover.jpg")
    fun instrumental(id: String) = File(dir(id), "instrumental.flac")
    fun vocals(id: String) = File(dir(id), "vocals.flac")
    fun lyricsFile(id: String) = File(dir(id), "lyrics.json")
    fun checkpoints(id: String) = File(dir(id), "ckpt")
    fun get(id: String): Song? = _songs.value.firstOrNull { it.id == id }

    @Synchronized fun add(song: Song) { _songs.value = listOf(song) + _songs.value; persist() }

    @Synchronized fun update(id: String, transform: (Song) -> Song) {
        _songs.value = _songs.value.map { if (it.id == id) transform(it) else it }
        persist()
    }

    /** Progress ticks are frequent: update the UI immediately but only hit the disk at most every ~2 s. */
    @Synchronized fun updateProgress(id: String, transform: (Song) -> Song) {
        _songs.value = _songs.value.map { if (it.id == id) transform(it) else it }
        val now = System.currentTimeMillis()
        if (now - lastPersist > 2000) persist()
    }

    @Synchronized fun delete(id: String) {
        _songs.value = _songs.value.filterNot { it.id == id }
        dir(id).deleteRecursively(); persist()
    }

    /** After a crash / process death nothing is really running: anything "in flight" becomes resumable. */
    @Synchronized fun reconcileAfterProcessStart() {
        _songs.value = _songs.value.map {
            if (it.status == SongStatus.PROCESSING || it.status == SongStatus.QUEUED) it.copy(status = SongStatus.PAUSED) else it
        }
        persist()
    }

    private var lastPersist = 0L
    private fun persist() {
        lastPersist = System.currentTimeMillis()
        val tmp = File(index.path + ".tmp")
        tmp.writeText(json.encodeToString(ListSerializer(Song.serializer()), _songs.value))
        if (!tmp.renameTo(index)) { index.delete(); tmp.renameTo(index) }
    }

    private fun load(): List<Song> = try {
        if (index.exists()) json.decodeFromString(ListSerializer(Song.serializer()), index.readText()) else emptyList()
    } catch (_: Exception) { emptyList() }
}
