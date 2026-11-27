package app.singsync.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import app.singsync.app.screens.LibraryScreen
import app.singsync.app.screens.SettingsScreen
import app.singsync.app.screens.SongScreen
import app.singsync.ui.SingSyncTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { SingSyncTheme { Root() } }
    }
}

@Composable
private fun Root() {
    val nav = rememberNavController()
    NavHost(nav, startDestination = "library") {
        composable("library") { LibraryScreen(onOpenSong = { nav.navigate("song/$it") }, onOpenSettings = { nav.navigate("settings") }) }
        composable("song/{id}") { SongScreen(id = it.arguments?.getString("id").orEmpty(), onBack = { nav.popBackStack() }) }
        composable("settings") { SettingsScreen(onBack = { nav.popBackStack() }) }
    }
}
