package app.singsync.app

import android.app.Application
import app.singsync.app.data.Settings
import app.singsync.app.data.SongImporter
import app.singsync.app.data.SongStore

/** Tiny manual DI container – enough for this app, no framework. */
class SingSyncApp : Application() {
    lateinit var store: SongStore; private set
    lateinit var settings: Settings; private set
    lateinit var importer: SongImporter; private set

    override fun onCreate() {
        super.onCreate()
        store = SongStore(this).also { it.reconcileAfterProcessStart() }
        settings = Settings(this)
        importer = SongImporter(this, store)
    }
}
