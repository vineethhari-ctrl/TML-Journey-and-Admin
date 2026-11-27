package app.singsync.core

import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File

/** Copies a file from app storage into the public Music/SingSync folder (visible in any music app / file manager). */
object MediaStoreExporter {
    fun export(context: Context, source: File, displayName: String, mimeType: String): Uri {
        return if (Build.VERSION.SDK_INT >= 29) {
            val values = ContentValues().apply {
                put(MediaStore.Audio.Media.DISPLAY_NAME, displayName)
                put(MediaStore.Audio.Media.MIME_TYPE, mimeType)
                put(MediaStore.Audio.Media.RELATIVE_PATH, "${Environment.DIRECTORY_MUSIC}/SingSync")
                put(MediaStore.Audio.Media.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values)
                ?: error("Could not create a file in Music/SingSync")
            try {
                resolver.openOutputStream(uri)!!.use { os -> source.inputStream().use { it.copyTo(os) } }
                resolver.update(uri, ContentValues().apply { put(MediaStore.Audio.Media.IS_PENDING, 0) }, null, null)
            } catch (e: Exception) { resolver.delete(uri, null, null); throw e }
            uri
        } else {
            // API 26-28: legacy external storage (WRITE_EXTERNAL_STORAGE, requested with maxSdkVersion=28).
            val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC), "SingSync").apply { mkdirs() }
            val dest = File(dir, displayName)
            source.copyTo(dest, overwrite = true)
            MediaScannerConnection.scanFile(context, arrayOf(dest.path), arrayOf(mimeType), null)
            Uri.fromFile(dest)
        }
    }
}
