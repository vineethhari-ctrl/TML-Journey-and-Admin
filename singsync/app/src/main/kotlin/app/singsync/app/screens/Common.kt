package app.singsync.app.screens

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import app.singsync.app.SingSyncApp
import app.singsync.app.data.Song
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun app(): SingSyncApp = LocalContext.current.applicationContext as SingSyncApp

@Composable
fun rememberCover(song: Song?): State<ImageBitmap?> {
    val a = app()
    return produceState<ImageBitmap?>(null, song?.id, song?.hasCover) {
        value = if (song != null && song.hasCover) withContext(Dispatchers.IO) {
            BitmapFactory.decodeFile(a.store.cover(song.id).path)?.asImageBitmap()
        } else null
    }
}

fun formatDuration(ms: Long): String { val s = ms / 1000; return "%d:%02d".format(s / 60, s % 60) }
