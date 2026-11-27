package app.singsync.app.processing

import android.content.Context
import android.os.Build
import android.os.PowerManager

/**
 * Cooperative thermal throttling for the long inference loop (API 29+; no-op below).
 * MODERATE -> short pause between chunks (duty-cycle ~70 %), SEVERE+ -> stop until the device cools or 60 s pass.
 */
class ThermalGuard(context: Context) {
    private val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager

    private fun status(): Int = if (Build.VERSION.SDK_INT >= 29) pm.currentThermalStatus else 0

    /** Returns a human-readable note while throttling (shown in the UI), or null. Blocks the calling worker thread. */
    fun beforeChunk(isCancelled: () -> Boolean, onThrottle: (String?) -> Unit) {
        val s = status()
        when {
            s >= 3 /* SEVERE */ -> {
                onThrottle("Phone is hot – pausing to cool down")
                var waited = 0
                while (status() >= 3 && waited < 60_000 && !isCancelled()) { Thread.sleep(2_000); waited += 2_000 }
                onThrottle(null)
            }
            s == 2 /* MODERATE */ -> { onThrottle("Phone is warm – running slower"); Thread.sleep(1_200); onThrottle(null) }
        }
    }
}
