package app.singsync.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.Icon

object Brand {
    val Ink = Color(0xFF0B0716)
    val Violet = Color(0xFF7C4DFF)
    val Pink = Color(0xFFFF4D8D)
    val Cyan = Color(0xFF29D3E8)
    val Surface = Color(0xFF17112B)
    val SurfaceHigh = Color(0xFF241A42)
    val TextDim = Color(0xFFB9B0D6)
    val Good = Color(0xFF4CE0A0)
    val Warn = Color(0xFFFFB74D)
    val Bad = Color(0xFFFF6B7A)
    val backgroundBrush = Brush.verticalGradient(listOf(Color(0xFF2A1458), Color(0xFF140B2B), Ink))
    val accentBrush = Brush.horizontalGradient(listOf(Violet, Pink))
}

private val Scheme = darkColorScheme(
    primary = Brand.Violet, onPrimary = Color.White,
    secondary = Brand.Pink, tertiary = Brand.Cyan,
    background = Brand.Ink, onBackground = Color.White,
    surface = Brand.Surface, onSurface = Color.White,
    surfaceVariant = Brand.SurfaceHigh, onSurfaceVariant = Brand.TextDim,
    error = Brand.Bad,
)

@Composable
fun SingSyncTheme(content: @Composable () -> Unit) = MaterialTheme(colorScheme = Scheme, content = content)

/** Full-screen gradient used behind every screen (album-art blur is layered on top in the player). */
@Composable
fun GradientBackground(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) =
    Box(modifier.fillMaxSize().background(Brand.backgroundBrush), content = content)

@Composable
fun StatusChip(text: String, color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.18f)).padding(horizontal = 10.dp, vertical = 4.dp),
    ) { Text(text, color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold) }
}

enum class StageState { Pending, Active, Done, Failed, Skipped }

@Composable
fun StageRow(title: String, subtitle: String?, state: StageState, progress: Float? = null) {
    Row(Modifier.padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) {
            when (state) {
                StageState.Done -> Box(Modifier.size(24.dp).clip(CircleShape).background(Brand.Good), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.Check, null, tint = Brand.Ink, modifier = Modifier.size(16.dp)) }
                StageState.Failed -> Icon(Icons.Filled.ErrorOutline, null, tint = Brand.Bad)
                StageState.Active ->
                    if (progress != null) CircularProgressIndicator(progress = { progress }, modifier = Modifier.size(24.dp), strokeWidth = 3.dp, color = Brand.Pink)
                    else CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 3.dp, color = Brand.Pink)
                else -> Box(Modifier.size(14.dp).clip(CircleShape).background(Brand.TextDim.copy(alpha = if (state == StageState.Skipped) 0.2f else 0.4f)))
            }
        }
        Spacer(Modifier.width(14.dp))
        androidx.compose.foundation.layout.Column {
            Text(title, fontSize = 16.sp, fontWeight = if (state == StageState.Active) FontWeight.Bold else FontWeight.Medium,
                color = if (state == StageState.Pending || state == StageState.Skipped) Brand.TextDim else Color.White)
            if (subtitle != null) Text(subtitle, fontSize = 12.sp, color = Brand.TextDim)
        }
    }
}
