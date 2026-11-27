package app.singsync.app.screens

import android.media.MediaPlayer
import java.io.File

/**
 * Minimal A/B listening harness: switch between original / instrumental / vocals at the same playback position.
 * (The sample-accurate karaoke player arrives in Milestone 3.)
 */
class AbPlayer {
    private var mp: MediaPlayer? = null
    var currentLabel: String? = null; private set
    val isPlaying: Boolean get() = try { mp?.isPlaying == true } catch (_: Exception) { false }

    fun play(label: String, file: File, onEnd: () -> Unit) {
        val pos = try { mp?.currentPosition ?: 0 } catch (_: Exception) { 0 }
        release()
        mp = MediaPlayer().apply {
            setDataSource(file.absolutePath)
            prepare()
            seekTo(pos.coerceAtMost(duration))
            setOnCompletionListener { currentLabel = null; onEnd() }
            start()
        }
        currentLabel = label
    }

    fun stop() { release() }

    private fun release() { try { mp?.stop() } catch (_: Exception) {}; mp?.release(); mp = null; currentLabel = null }
}
