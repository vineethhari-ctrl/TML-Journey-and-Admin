package app.singsync.app.screens

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.singsync.app.data.LyricsRepo
import app.singsync.app.data.Romanizer
import app.singsync.app.data.Song
import app.singsync.common.lyrics.LyricLine
import app.singsync.common.lyrics.Lyrics
import app.singsync.common.lyrics.LyricsEditor
import app.singsync.common.lyrics.LyricsSource
import app.singsync.core.AudioDecoder
import app.singsync.ui.Brand
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private fun sourceLabel(s: String?) = when (s) {
    "LRC", "LRC_WORD" -> "Imported · timed"
    "EMBEDDED_SYLT" -> "From the file's tags · timed"
    "EMBEDDED_USLT_ROUGH", "TEXT_ROUGH" -> "Rough timing – check it in the editor"
    "WHISPER" -> "Transcribed on device"
    "EDITED" -> "Edited by you"
    else -> "No lyrics yet"
}

@Composable
fun LyricsSection(song: Song) {
    val app = app(); val ctx = LocalContext.current; val scope = rememberCoroutineScope()
    var lyrics by remember(song.id, song.lyricsSource, song.status) { mutableStateOf(LyricsRepo.load(app.store, song.id)) }
    var editIndex by remember { mutableStateOf<Int?>(null) }
    var busy by remember { mutableStateOf(false) }
    val mode = song.lyricsMode

    fun persist(l: Lyrics) { lyrics = l; scope.launch(Dispatchers.IO) { LyricsRepo.save(app.store, song.id, l) } }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            busy = true
            try {
                val l = withContext(Dispatchers.IO) {
                    val text = ctx.contentResolver.openInputStream(uri)!!.use { it.readBytes().toString(Charsets.UTF_8) }.removePrefix("﻿")
                    val vocals = if (app.store.vocals(song.id).exists()) try { AudioDecoder.decode(app.store.vocals(song.id)) } catch (_: Exception) { null } else null
                    LyricsRepo.fromImportedText(text, vocals).also { check(it.lines.isNotEmpty()) { "No lyrics found in that file" } }
                }
                persist(l)
            } catch (e: Exception) { Toast.makeText(ctx, "Import failed: ${e.message}", Toast.LENGTH_LONG).show() }
            busy = false
        }
    }

    Spacer(Modifier.height(24.dp))
    Text("Lyrics", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
    Text(sourceLabel(lyrics?.source?.name), color = if (lyrics?.source == LyricsSource.TEXT_ROUGH || lyrics?.source == LyricsSource.EMBEDDED_USLT_ROUGH) Brand.Warn else Brand.TextDim, fontSize = 12.sp)
    Spacer(Modifier.height(8.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Button(onClick = { picker.launch(arrayOf("*/*")) }, enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = Brand.SurfaceHigh)) { Text(if (lyrics == null) "Import .lrc / .txt" else "Replace") }
        if (busy) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
    }
    val lang by app.settings.lyricsLanguage.collectAsState()
    val whisperOk = remember { app.singsync.core.WhisperRecognizer.isUsable(ctx) }
    val running = song.status == app.singsync.app.data.SongStatus.PROCESSING
    Spacer(Modifier.height(10.dp))
    if (whisperOk) {
        Text("Transcribe from the vocal stem (on this phone)", color = Brand.TextDim, fontSize = 12.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            listOf("auto" to "Auto", "en" to "English", "hi" to "Hindi", "ml" to "Malayalam").forEach { (code, label) ->
                FilterChip(selected = lang == code, onClick = { app.settings.setLyricsLanguage(code) }, label = { Text(label, fontSize = 12.sp) })
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Button(onClick = { app.singsync.app.processing.ProcessingService.transcribe(ctx, song.id, lang) }, enabled = !running, colors = ButtonDefaults.buttonColors(containerColor = Brand.Violet)) {
                Text(if (lyrics == null) "Find lyrics" else "Re-transcribe")
            }
            if (running) { CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp); OutlinedButton(onClick = { app.singsync.app.processing.ProcessingService.cancel(ctx, song.id) }) { Text("Cancel") } }
        }
    } else Text("Speech recognition is not part of this build.", color = Brand.Warn, fontSize = 11.sp)
    song.lyricsError?.let { Text(it, color = Brand.Bad, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp)) }

    val l = lyrics ?: return
    Spacer(Modifier.height(12.dp))
    val romanUseful = l.lines.any { Romanizer.needsRoman(it.text) }
    val hasEnglish = l.lines.any { it.english != null }
    val pair = remember(l) { app.singsync.common.translate.PackSelector.packFor(l) }
    val canTranslate = pair != null && remember(pair) { app.singsync.ml.TranslationPacks.isBundled(ctx, pair) }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(selected = mode == "ORIGINAL", onClick = { app.store.update(song.id) { it.copy(lyricsMode = "ORIGINAL") } }, label = { Text("Original") })
        FilterChip(selected = mode == "ROMAN", enabled = romanUseful, onClick = { app.store.update(song.id) { it.copy(lyricsMode = "ROMAN") } }, label = { Text("Roman") })
        FilterChip(selected = mode == "ENGLISH", enabled = hasEnglish, onClick = { app.store.update(song.id) { it.copy(lyricsMode = "ENGLISH") } }, label = { Text("English") })
    }
    if (!hasEnglish && pair != null) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { app.singsync.app.processing.ProcessingService.translate(ctx, song.id) }, enabled = canTranslate) { Text("Translate to English") }
            if (!canTranslate) Text("Translation pack missing from this build", color = Brand.Warn, fontSize = 11.sp)
        }
    }
    Spacer(Modifier.height(8.dp))
    Column(Modifier.clip(RoundedCornerShape(16.dp)).background(Brand.Surface.copy(alpha = .9f)).padding(vertical = 6.dp)) {
        l.lines.take(300).forEachIndexed { i, line ->
            Row(Modifier.fillMaxWidth().clickable { editIndex = i }.padding(horizontal = 14.dp, vertical = 7.dp)) {
                Text(formatDuration(line.startMs), color = Brand.Cyan, fontSize = 12.sp, modifier = Modifier.width(44.dp))
                Text(when (mode) { "ROMAN" -> Romanizer.romanize(line.text); "ENGLISH" -> line.english ?: line.text; else -> line.text }, color = Color.White, fontSize = 15.sp)
            }
        }
    }
    Text("Tap a line to fix words, shift timing, split or merge.", color = Brand.TextDim, fontSize = 11.sp, modifier = Modifier.padding(top = 6.dp))

    editIndex?.let { i ->
        if (i >= l.lines.size) { editIndex = null; return@let }
        LineEditor(l, i, onChange = { persist(it) }, onClose = { editIndex = null })
    }
}

@Composable
private fun LineEditor(l: Lyrics, index: Int, onChange: (Lyrics) -> Unit, onClose: () -> Unit) {
    val line: LyricLine = l.lines[index]
    var text by remember(index, line.text) { mutableStateOf(line.text) }
    AlertDialog(
        onDismissRequest = onClose,
        title = { Text("Line ${index + 1} · ${formatDuration(line.startMs)}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(text, { text = it }, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(-500L, -100L, 100L, 500L).forEach { d -> OutlinedButton(onClick = { onChange(LyricsEditor.nudgeLine(l, index, d)) }, contentPadding = PaddingValues(horizontal = 8.dp)) { Text(if (d > 0) "+${d}" else "$d", fontSize = 12.sp) } }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    OutlinedButton(onClick = { if (line.words.size > 1) { onChange(LyricsEditor.splitLine(l, index, line.words.size / 2)); onClose() } }, enabled = line.words.size > 1) { Text("Split") }
                    OutlinedButton(onClick = { onChange(LyricsEditor.mergeWithNext(l, index)); onClose() }, enabled = index < l.lines.size - 1) { Text("Merge next") }
                    OutlinedButton(onClick = { onChange(LyricsEditor.deleteLine(l, index)); onClose() }) { Text("Delete", color = Brand.Bad) }
                }
            }
        },
        confirmButton = { TextButton(onClick = { if (text.isNotBlank() && text != line.text) onChange(LyricsEditor.setLineText(l, index, text)); onClose() }) { Text("Done") } },
    )
}
