package app.singsync.app.screens

import app.singsync.ml.TranslationPacks
import app.singsync.core.WhisperRecognizer
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.singsync.core.NativeCore
import app.singsync.ml.Quality
import app.singsync.ml.SeparatorFactory
import app.singsync.ui.Brand
import app.singsync.ui.GradientBackground
import androidx.compose.ui.platform.LocalContext

@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val app = app()
    val ctx = LocalContext.current
    val quality by app.settings.quality.collectAsState()
    val nnapi by app.settings.useNnapi.collectAsState()
    GradientBackground {
        Column(Modifier.fillMaxSize().systemBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Color.White) }
                Text("Settings", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
            Spacer(Modifier.height(16.dp))
            Section("Separation quality")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Quality.entries.forEach { q -> FilterChip(selected = q == quality, onClick = { app.settings.setQuality(q) }, label = { Text(q.label) }) }
            }
            Hint(if (quality == Quality.BEST) "Best: Demucs v4 neural separation (25 % overlap, cross-faded). Slower, clean result." else "Fast: basic centre-channel method – seconds per song, but vocals bleed through. Use Best for real karaoke.")
            Spacer(Modifier.height(20.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text("Use NNAPI acceleration", color = Color.White); Hint("Experimental. Falls back to CPU if unsupported.") }
                Switch(checked = nnapi, onCheckedChange = { app.settings.setNnapi(it) })
            }
            Spacer(Modifier.height(24.dp))
            Section("Bundled models")
            Hint(if (SeparatorFactory.hasNeuralModel(ctx)) "Demucs v4 bundled in this build (used by Best)." else "Demucs model is MISSING from this build – Best falls back to the basic method. Check the CI \"models\" job.")
            Spacer(Modifier.height(24.dp))
            Section("About")
            Hint("SingSync works fully offline. Songs never leave this device.")
            Hint("Speech recognition (Whisper small): " + if (WhisperRecognizer.isUsable(ctx)) "bundled" else "MISSING from this build")
            Hint("English translation packs: " + listOf("hi-en", "ml-en").joinToString { it + if (TranslationPacks.isBundled(ctx, it)) " ✓" else " ✗ missing" })
            Hint("Native core: ${NativeCore.nativeVersion()}")
            Hint("Open-source components: Demucs (MIT), ONNX Runtime (MIT), AndroidX / Jetpack Compose (Apache-2.0). Full licence list will ship with the model bundle.")
        }
    }
}

@Composable private fun Section(t: String) = Text(t, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.padding(bottom = 8.dp))
@Composable private fun Hint(t: String) = Text(t, color = Brand.TextDim, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
