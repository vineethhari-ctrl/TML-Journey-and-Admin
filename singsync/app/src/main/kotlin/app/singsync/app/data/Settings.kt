package app.singsync.app.data

import android.content.Context
import app.singsync.ml.Quality
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class Settings(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)
    private val _quality = MutableStateFlow(Quality.fromName(prefs.getString("quality", null)))
    private val _nnapi = MutableStateFlow(prefs.getBoolean("nnapi", false))
    private val _lang = MutableStateFlow(prefs.getString("lyricsLang", "auto") ?: "auto")
    /** "auto", "en", "hi" or "ml" – language hint for the on-device transcription. */
    val lyricsLanguage: StateFlow<String> = _lang.asStateFlow()
    fun setLyricsLanguage(l: String) { prefs.edit().putString("lyricsLang", l).apply(); _lang.value = l }
    val quality: StateFlow<Quality> = _quality.asStateFlow()
    val useNnapi: StateFlow<Boolean> = _nnapi.asStateFlow()

    fun setQuality(q: Quality) { prefs.edit().putString("quality", q.name).apply(); _quality.value = q }
    fun setNnapi(on: Boolean) { prefs.edit().putBoolean("nnapi", on).apply(); _nnapi.value = on }
}
