package app.singsync.app.data

import android.content.Context
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns
import java.io.FileOutputStream
import java.util.UUID

/** Copies the picked file into app storage (so processing can resume even if the URI grant is gone) and reads tags + cover. */
class SongImporter(private val context: Context, private val store: SongStore) {
    fun import(uri: Uri, quality: String): Song {
        val name = displayName(uri) ?: "Imported song"
        val id = UUID.randomUUID().toString()
        val src = store.source(id)
        try {
            val input = context.contentResolver.openInputStream(uri) ?: error("Cannot open the selected file")
            input.use { i -> FileOutputStream(src).use { o -> i.copyTo(o, 1 shl 20) } }
        } catch (e: Exception) { store.dir(id).deleteRecursively(); throw e }

        var title = name.substringBeforeLast('.')
        var artist = ""
        var duration = 0L
        var hasCover = false
        val mmr = MediaMetadataRetriever()
        try {
            mmr.setDataSource(src.absolutePath)
            mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)?.takeIf { it.isNotBlank() }?.let { title = it }
            artist = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST) ?: ""
            duration = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            mmr.embeddedPicture?.let { bytes ->
                // Down-scale to a sane size: library thumbnails + blurred player background don't need 3000 px art.
                val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
                val sample = generateSequence(1) { it * 2 }.first { opts.outWidth / it <= 800 }
                val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
                if (bmp != null) { FileOutputStream(store.cover(id)).use { bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 90, it) }; hasCover = true }
            }
        } catch (_: Exception) { /* tags are optional */ } finally { mmr.release() }

        val song = Song(id = id, title = title, artist = artist, durationMs = duration, sourceName = name, quality = quality, hasCover = hasCover)
        store.add(song)
        return song
    }

    private fun displayName(uri: Uri): String? = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
        if (it.moveToFirst()) it.getString(0) else null
    } ?: uri.lastPathSegment
}
