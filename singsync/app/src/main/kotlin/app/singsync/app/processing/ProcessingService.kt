package app.singsync.app.processing

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import app.singsync.app.MainActivity
import app.singsync.app.SingSyncApp
import app.singsync.app.data.SongStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

/**
 * Foreground service that works through a queue of songs, one at a time (RAM budget), with a progress
 * notification and a Cancel action. Cancelling keeps the chunk checkpoints, so tapping Resume continues where it stopped.
 */
class ProcessingService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val queue = Channel<String>(Channel.UNLIMITED)
    private val cancelled = ConcurrentHashMap.newKeySet<String>()
    private val queued = ConcurrentHashMap.newKeySet<String>()
    private var worker: Job? = null
    @Volatile private var current: String? = null
    @Volatile private var note: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel()
        startForegroundCompat(buildNotification("Preparing…", 0, true))
        val id = intent?.getStringExtra(EXTRA_SONG_ID)
        when (intent?.action) {
            ACTION_CANCEL -> if (id != null) { cancelled.add(id); app.store.update(id) { s -> if (s.status == SongStatus.QUEUED) s.copy(status = SongStatus.PAUSED) else s } }
            else -> if (id != null && queued.add(id)) {
                cancelled.remove(id)
                app.store.update(id) { s -> s.copy(status = SongStatus.QUEUED, error = null) }
                queue.trySend(id)
            }
        }
        if (worker?.isActive != true) worker = scope.launch { runQueue() }
        return START_NOT_STICKY
    }

    private val app get() = application as SingSyncApp

    private suspend fun runQueue() {
        val engine = ProcessingEngine(applicationContext, app.store, ThermalGuard(applicationContext))
        while (true) {
            val next = queue.tryReceive().getOrNull() ?: break
            queued.remove(next)
            if (next in cancelled) { cancelled.remove(next); continue }
            current = next
            val title = app.store.get(next)?.title ?: "song"
            val job = scope.launch { // progress → notification
                app.store.songs.collect { list ->
                    val s = list.firstOrNull { it.id == next } ?: return@collect
                    if (s.status == SongStatus.PROCESSING) notify(buildNotification("${stageLabel(s.stage.name)} · $title", (s.progress * 100).toInt(), false))
                }
            }
            engine.process(next, app.settings.quality.value, app.settings.useNnapi.value, { next in cancelled }, { note = it })
            job.cancel(); cancelled.remove(next); current = null
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun stageLabel(stage: String) = when (stage) { "ANALYSING" -> "Analysing"; "SEPARATING" -> "Separating voice"; else -> "Working" }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val nm = getSystemService(NotificationManager::class.java)
            if (nm.getNotificationChannel(CHANNEL) == null)
                nm.createNotificationChannel(NotificationChannel(CHANNEL, "Song processing", NotificationManager.IMPORTANCE_LOW))
        }
    }

    private fun buildNotification(text: String, percent: Int, indeterminate: Boolean): Notification {
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val cancel = PendingIntent.getService(this, 1,
            Intent(this, ProcessingService::class.java).setAction(ACTION_CANCEL).putExtra(EXTRA_SONG_ID, current ?: ""), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle("SingSync")
            .setContentText(note ?: text)
            .setOngoing(true).setOnlyAlertOnce(true).setContentIntent(open)
            .setProgress(100, percent, indeterminate)
            .addAction(0, "Cancel", cancel)
            .build()
    }

    private fun notify(n: Notification) = getSystemService(NotificationManager::class.java).notify(NOTIF_ID, n)

    private fun startForegroundCompat(n: Notification) {
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC) else startForeground(NOTIF_ID, n)
    }

    override fun onDestroy() { scope.cancel(); super.onDestroy() }

    companion object {
        private const val CHANNEL = "processing"
        private const val NOTIF_ID = 42
        private const val ACTION_CANCEL = "app.singsync.CANCEL"
        private const val EXTRA_SONG_ID = "song_id"

        fun start(context: Context, songId: String) {
            androidx.core.content.ContextCompat.startForegroundService(context, Intent(context, ProcessingService::class.java).putExtra(EXTRA_SONG_ID, songId))
        }
        fun cancel(context: Context, songId: String) {
            context.startService(Intent(context, ProcessingService::class.java).setAction(ACTION_CANCEL).putExtra(EXTRA_SONG_ID, songId))
        }
    }
}
