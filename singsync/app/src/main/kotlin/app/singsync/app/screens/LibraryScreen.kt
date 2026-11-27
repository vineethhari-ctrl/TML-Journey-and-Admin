package app.singsync.app.screens

import android.Manifest
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.singsync.app.data.Song
import app.singsync.app.data.SongStatus
import app.singsync.app.processing.ProcessingService
import app.singsync.ui.Brand
import app.singsync.ui.GradientBackground
import app.singsync.ui.StatusChip
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun LibraryScreen(onOpenSong: (String) -> Unit, onOpenSettings: () -> Unit) {
    val app = app()
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val songs by app.store.songs.collectAsState()
    var query by remember { mutableStateOf("") }
    val filtered = remember(songs, query) {
        songs.filter { query.isBlank() || it.title.contains(query, true) || it.artist.contains(query, true) }
    }

    fun importUris(uris: List<android.net.Uri>) {
        scope.launch {
            for (uri in uris) {
                try {
                    val song = withContext(Dispatchers.IO) { app.importer.import(uri, app.settings.quality.value.name) }
                    ProcessingService.start(ctx, song.id)
                } catch (e: Exception) {
                    Toast.makeText(ctx, "Import failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { importUris(it) }
    val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        picker.launch(arrayOf("audio/*"))   // continue regardless: processing works, only the progress notification is hidden
    }
    fun startImport() {
        if (Build.VERSION.SDK_INT >= 33 &&
            androidx.core.content.ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS) else picker.launch(arrayOf("audio/*"))
    }

    GradientBackground {
        Column(Modifier.fillMaxSize().systemBarsPadding()) {
            Row(Modifier.padding(start = 20.dp, end = 8.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("SingSync", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = Color.White)
                    Text("Your songs, your voice. All on this phone.", color = Brand.TextDim, fontSize = 13.sp)
                }
                IconButton(onClick = onOpenSettings) { Icon(Icons.Filled.Settings, "Settings", tint = Color.White) }
            }
            OutlinedTextField(
                value = query, onValueChange = { query = it }, singleLine = true,
                placeholder = { Text("Search songs") }, leadingIcon = { Icon(Icons.Filled.Search, null) },
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = Brand.SurfaceHigh, focusedBorderColor = Brand.Violet, unfocusedContainerColor = Brand.Surface.copy(alpha = .6f), focusedContainerColor = Brand.Surface),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            )
            if (songs.isEmpty()) EmptyLibrary(onImport = ::startImport, modifier = Modifier.weight(1f))
            else LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 96.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(filtered, key = { it.id }) { SongRow(it) { onOpenSong(it.id) } }
            }
        }
        ExtendedFloatingActionButton(
            onClick = ::startImport, containerColor = Brand.Violet, contentColor = Color.White,
            icon = { Icon(Icons.Filled.Add, null) }, text = { Text("Import song") },
            modifier = Modifier.align(Alignment.BottomEnd).navigationBarsPadding().padding(20.dp),
        )
    }
}

@Composable
private fun EmptyLibrary(onImport: () -> Unit, modifier: Modifier) {
    Column(modifier.fillMaxWidth().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Filled.LibraryMusic, null, tint = Brand.Pink, modifier = Modifier.size(72.dp))
        Spacer(Modifier.height(16.dp))
        Text("No songs yet", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.White)
        Spacer(Modifier.height(8.dp))
        Text("Import an mp3, m4a, wav or flac. SingSync removes the singer's voice right here on your phone – no internet needed.",
            color = Brand.TextDim, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Spacer(Modifier.height(20.dp))
        Button(onClick = onImport, colors = ButtonDefaults.buttonColors(containerColor = Brand.Violet)) { Text("Choose a song") }
    }
}

@Composable
private fun SongRow(song: Song, onClick: () -> Unit) {
    val cover by rememberCover(song)
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brand.Surface.copy(alpha = .85f)).clickable(onClick = onClick).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(60.dp).clip(RoundedCornerShape(12.dp)).background(Brand.accentBrush), contentAlignment = Alignment.Center) {
            val c = cover
            if (c != null) Image(c, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            else Icon(Icons.Filled.MusicNote, null, tint = Color.White.copy(alpha = .85f), modifier = Modifier.size(30.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(song.title, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(listOf(song.artist, if (song.durationMs > 0) formatDuration(song.durationMs) else "").filter { it.isNotBlank() }.joinToString(" · ").ifEmpty { "Unknown artist" },
                color = Brand.TextDim, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(6.dp))
            statusChip(song)
        }
    }
}

@Composable
fun statusChip(song: Song) {
    when (song.status) {
        SongStatus.QUEUED -> StatusChip("Queued", Brand.TextDim)
        SongStatus.PROCESSING -> StatusChip("Processing ${(song.progress * 100).toInt()}%", Brand.Cyan)
        SongStatus.PAUSED -> StatusChip("Paused ${(song.progress * 100).toInt()}% · tap to resume", Brand.Warn)
        SongStatus.FAILED -> StatusChip("Failed", Brand.Bad)
        SongStatus.DONE -> when {
            song.usedFallback -> StatusChip("Ready · model missing", Brand.Warn)
            song.engine == "classic-midside" -> StatusChip("Ready · Fast mode", Brand.Cyan)
            else -> StatusChip("Ready", Brand.Good)
        }
    }
}
