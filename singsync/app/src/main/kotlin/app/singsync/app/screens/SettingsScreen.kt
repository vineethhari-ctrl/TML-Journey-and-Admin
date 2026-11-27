package app.singsync.app.screens

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
            Hint(if (quality == Quality.BEST) "Best: 25 % chunk overlap with cross-fade. Slower, smoothest result." else "Fast: 10 % overlap. Roughly 1.5× faster, seams may be slightly audible.")
            Spacer(Modifier.height(20.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text("Use NNAPI acceleration", color = Color.White); Hint("Experimental. Falls back to CPU if unsupported.") }
                Switch(checked = nnapi, onCheckedChange = { app.settings.setNnapi(it) })
            }
            Spacer(Modifier.height(24.dp))
            Section("Engine")
            Hint(if (SeparatorFactory.hasNeuralModel(ctx)) "Demucs v4 (int8) bundled in this build." else "No AI model bundled in this build – using the basic fallback separator.")
            Spacer(Modifier.height(24.dp))
            Section("About")
            Hint("SingSync works fully offline. Songs never leave this device.")
            Hint("Native core: ${NativeCore.nativeVersion()}")
            Hint("Open-source components: Demucs (MIT), ONNX Runtime (MIT), AndroidX / Jetpack Compose (Apache-2.0). Full licence list will ship with the model bundle.")
        }
    }
}

@Composable private fun Section(t: String) = Text(t, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.padding(bottom = 8.dp))
@Composable private fun Hint(t: String) = Text(t, color = Brand.TextDim, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
