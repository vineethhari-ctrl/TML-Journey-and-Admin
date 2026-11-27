package app.singsync.app.screens

import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.SaveAlt
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.singsync.app.data.Song
import app.singsync.app.data.SongStatus
import app.singsync.app.data.Stage
import app.singsync.app.processing.ProcessingService
import app.singsync.core.MediaStoreExporter
import app.singsync.ui.Brand
import app.singsync.ui.GradientBackground
import app.singsync.ui.StageRow
import app.singsync.ui.StageState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun SongScreen(id: String, onBack: () -> Unit) {
    val app = app()
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val songs by app.store.songs.collectAsState()
    val song = songs.firstOrNull { it.id == id }
    val player = remember { AbPlayer() }
    var playing by remember { mutableStateOf<String?>(null) }
    DisposableEffect(Unit) { onDispose { player.stop() } }
    var confirmDelete by remember { mutableStateOf(false) }

    GradientBackground {
        if (song == null) { Text("Song not found", color = Color.White, modifier = Modifier.padding(32.dp)); return@GradientBackground }
        val cover by rememberCover(song)
        Column(Modifier.fillMaxSize().systemBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Color.White) }
                Spacer(Modifier.weight(1f))
                IconButton(onClick = { confirmDelete = true }) { Icon(Icons.Filled.Delete, "Delete", tint = Brand.TextDim) }
            }
            Box(Modifier.align(Alignment.CenterHorizontally).size(180.dp).clip(RoundedCornerShape(24.dp)).background(Brand.accentBrush), contentAlignment = Alignment.Center) {
                val c = cover
                if (c != null) Image(c, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                else Icon(Icons.Filled.MusicNote, null, tint = Color.White.copy(alpha = .85f), modifier = Modifier.size(72.dp))
            }
            Spacer(Modifier.height(16.dp))
            Text(song.title, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = Color.White, modifier = Modifier.align(Alignment.CenterHorizontally))
            if (song.artist.isNotBlank()) Text(song.artist, color = Brand.TextDim, modifier = Modifier.align(Alignment.CenterHorizontally))
            Spacer(Modifier.height(8.dp)); Box(Modifier.align(Alignment.CenterHorizontally)) { statusChip(song) }
            Spacer(Modifier.height(24.dp))

            Card(colors = CardDefaults.cardColors(containerColor = Brand.Surface.copy(alpha = .9f)), shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(16.dp)) {
                    val active = song.status == SongStatus.PROCESSING || song.status == SongStatus.QUEUED
                    val done = song.status == SongStatus.DONE
                    val failed = song.status == SongStatus.FAILED
                    fun st(stage: Stage, idx: Int): StageState = when {
                        done -> StageState.Done
                        failed && song.stage == stage -> StageState.Failed
                        song.stage.ordinal > idx -> StageState.Done
                        song.stage == stage && active -> StageState.Active
                        else -> StageState.Pending
                    }
                    StageRow("Analysing", "Decoding to 44.1 kHz stereo", st(Stage.ANALYSING, 0), if (song.stage == Stage.ANALYSING) (song.progress / 0.10f).coerceIn(0f, 1f) else null)
                    StageRow("Separating voice", song.engine?.let { engineLabel(it) } ?: "Splitting singer and band", st(Stage.SEPARATING, 1),
                        if (song.stage == Stage.SEPARATING) ((song.progress - 0.10f) / 0.85f).coerceIn(0f, 1f) else null)
                    StageRow("Finding lyrics", when { song.lyricsSource == "WHISPER" -> "Transcribed on this phone"; song.lyricsSource != null -> "Found / imported"; done -> "None yet – transcribe or import below"; else -> "Tags, then on-device Whisper" },
                        if (done) (if (song.lyricsSource != null) StageState.Done else StageState.Skipped) else if (song.stage == Stage.LYRICS && active) StageState.Active else StageState.Pending,
                        if (song.stage == Stage.LYRICS && active) ((song.progress - 0.95f) / 0.05f).coerceIn(0f, 1f) else null)
                    StageRow("Done", if (done) "Stems saved on this phone" else null, if (done) StageState.Done else StageState.Pending)
                }
            }
            Spacer(Modifier.height(16.dp))

            when (song.status) {
                SongStatus.PROCESSING, SongStatus.QUEUED ->
                    OutlinedButton(onClick = { ProcessingService.cancel(ctx, song.id) }, modifier = Modifier.fillMaxWidth()) { Text("Cancel (progress is kept)") }
                SongStatus.PAUSED ->
                    Button(onClick = { ProcessingService.start(ctx, song.id) }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Brand.Violet)) { Text("Resume from ${(song.progress * 100).toInt()}%") }
                SongStatus.FAILED -> {
                    Text(song.error ?: "Something went wrong", color = Brand.Bad)
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { ProcessingService.start(ctx, song.id) }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Brand.Violet)) { Text("Try again") }
                }
                SongStatus.DONE -> DoneSection(song, player, playing, { playing = it }, onExport = { label, file, name ->
                    scope.launch {
                        try { withContext(Dispatchers.IO) { MediaStoreExporter.export(ctx, file, name, "audio/flac") }
                            Toast.makeText(ctx, "Saved $label to Music/SingSync", Toast.LENGTH_LONG).show()
                        } catch (e: Exception) { Toast.makeText(ctx, "Export failed: ${e.message}", Toast.LENGTH_LONG).show() }
                    }
                })
            }
            Spacer(Modifier.height(32.dp))
        }
    }

    if (confirmDelete && song != null) AlertDialog(
        onDismissRequest = { confirmDelete = false },
        title = { Text("Delete \"${song.title}\"?") },
        text = { Text("Removes the original copy, the instrumental and the vocal stem from this phone.") },
        confirmButton = { TextButton(onClick = { confirmDelete = false; player.stop(); app.store.delete(song.id); onBack() }) { Text("Delete", color = Brand.Bad) } },
        dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Keep") } },
    )
}

private fun engineLabel(id: String) = when (id) {
    "classic-midside" -> "Basic centre-channel method (not AI)"
    else -> "Demucs v4 · on-device"
}

@Composable
private fun DoneSection(song: Song, player: AbPlayer, playing: String?, setPlaying: (String?) -> Unit, onExport: (String, java.io.File, String) -> Unit) {
    val app = app()
    val tracks = listOf(
        Triple("Original", app.store.source(song.id), "original"),
        Triple("Instrumental", app.store.instrumental(song.id), "instrumental"),
        Triple("Vocals", app.store.vocals(song.id), "vocals"),
    )
    if (song.usedFallback) {
        Card(colors = CardDefaults.cardColors(containerColor = Brand.Warn.copy(alpha = .15f)), shape = RoundedCornerShape(16.dp)) {
            Text("Best quality was requested but the Demucs model is missing from this build, so a basic centre-channel method was used. Vocals will bleed through. Check the CI \"models\" job.",
                color = Brand.Warn, fontSize = 13.sp, modifier = Modifier.padding(14.dp))
        }
        Spacer(Modifier.height(12.dp))
    }
    Text("Listen & compare", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
    Spacer(Modifier.height(8.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        tracks.forEach { (label, file, _) ->
            FilterChip(selected = playing == label, onClick = {
                if (playing == label) { player.stop(); setPlaying(null) }
                else try { player.play(label, file) { setPlaying(null) }; setPlaying(label) } catch (_: Exception) { setPlaying(null) }
            }, label = { Text(if (playing == label) "■ $label" else "▶ $label") })
        }
    }
    Spacer(Modifier.height(20.dp))
    Text("Save to your phone", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
    Spacer(Modifier.height(8.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        listOf("Instrumental" to "instrumental", "Vocals" to "vocals").forEach { (label, key) ->
            val file = if (key == "vocals") app.store.vocals(song.id) else app.store.instrumental(song.id)
            Button(onClick = { onExport(label, file, "${song.title} - $key.flac".replace(Regex("[\\\\/:*?\"<>|]"), "_")) },
                colors = ButtonDefaults.buttonColors(containerColor = Brand.SurfaceHigh), modifier = Modifier.weight(1f)) {
                Icon(Icons.Filled.SaveAlt, null); Spacer(Modifier.width(6.dp)); Text(label)
            }
        }
    }
    Text("Lossless FLAC · 24-bit · 44.1 kHz → Music/SingSync", color = Brand.TextDim, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
    LyricsSection(song)
    song.nullTestDb?.let {
        Spacer(Modifier.height(20.dp))
        Text("Quality check (instrumental + vocals vs original): ${if (it <= -250) "exact" else "%.1f dB residual".format(it)}", color = Brand.TextDim, fontSize = 12.sp)
    }
}
