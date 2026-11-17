package `fun`.upup.musicfree.soundEffects

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.audiofx.Equalizer
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.roundToInt

/** Process-owned: continues working when the activity is backgrounded. All access on main. */
object SoundEffectsEngine {
    private val handler = Handler(Looper.getMainLooper())
    private val frequencies = doubleArrayOf(60.0, 230.0, 910.0, 3600.0, 14000.0)
    private var initialized = false
    private var sessionId = 0
    private var equalizer: Equalizer? = null
    private var enabled = false
    private var gains = DoubleArray(5)
    private var error: String? = null
    private var animation: Runnable? = null

    fun initialize(context: Context) {
        if (initialized) return
        initialized = true
        val filter = IntentFilter("fun.upup.musicfree.EQ_SESSION").apply {
            addAction("fun.upup.musicfree.EQ_SESSION_CLOSED")
        }
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val id = intent.getIntExtra("sessionId", 0)
                if (intent.action == "fun.upup.musicfree.EQ_SESSION_CLOSED") {
                    if (id == sessionId) { release(); sessionId = 0 }
                } else if (id != sessionId) {
                    release()
                    sessionId = max(0, id)
                    applyProfile()
                }
            }
        }
        ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    fun configure(isEnabled: Boolean, values: DoubleArray) {
        require(values.size == 5 && values.all { it.isFinite() }) { "Expected five finite EQ gains" }
        enabled = isEnabled
        gains = values.map { it.coerceIn(-6.0, 6.0) }.toDoubleArray()
        applyProfile()
    }

    fun status(): Map<String, Any?> = mapOf(
        "active" to (enabled && equalizer != null && error == null),
        "waitingForPlayback" to (enabled && sessionId == 0),
        "bandCount" to (equalizer?.numberOfBands?.toInt() ?: 0),
        "error" to error,
        "headroomDb" to max(0.0, gains.maxOrNull() ?: 0.0)
    )

    private fun applyProfile() {
        animation?.let { handler.removeCallbacks(it) }
        animation = null
        error = null
        if (!enabled) { release(); return }
        if (sessionId <= 0) return
        try {
            val eq = equalizer ?: Equalizer(0, sessionId).also { equalizer = it }
            check(eq.hasControl()) { "音效控制权被其他均衡器占用" }
            val count = eq.numberOfBands.toInt()
            check(count > 0) { "此设备未提供均衡器频段" }
            val range = eq.bandLevelRange
            val headroom = max(0.0, gains.maxOrNull() ?: 0.0)
            val start = IntArray(count) { eq.getBandLevel(it.toShort()).toInt() }
            // Subtract positive gain globally to retain headroom instead of boosting peaks.
            val target = IntArray(count) { band ->
                val hz = eq.getCenterFreq(band.toShort()) / 1000.0
                ((interpolate(hz) - headroom) * 100).roundToInt()
                    .coerceIn(range[0].toInt(), range[1].toInt())
            }
            eq.enabled = true
            var step = 0
            val ramp = object : Runnable {
                override fun run() {
                    try {
                        if (equalizer !== eq || !enabled) return
                        step++
                        for (band in 0 until count) {
                            eq.setBandLevel(band.toShort(),
                                (start[band] + (target[band] - start[band]) * step / 20).toShort())
                        }
                        if (step < 20) handler.postDelayed(this, 20) else animation = null
                    } catch (e: RuntimeException) { fail(e) }
                }
            }
            animation = ramp
            handler.post(ramp)
        } catch (e: RuntimeException) { fail(e) }
    }

    private fun interpolate(hz: Double): Double {
        if (hz <= frequencies.first()) return gains.first()
        for (i in 1 until frequencies.size) {
            if (hz <= frequencies[i]) {
                val ratio = ln(hz / frequencies[i - 1]) / ln(frequencies[i] / frequencies[i - 1])
                return gains[i - 1] + (gains[i] - gains[i - 1]) * ratio
            }
        }
        return gains.last()
    }
    private fun fail(e: RuntimeException) {
        release()
        error = e.message ?: "此设备暂不支持音效"
    }
    private fun release() {
        animation?.let { handler.removeCallbacks(it) }
        animation = null
        equalizer?.let { eq ->
            try { eq.enabled = false } catch (_: RuntimeException) { }
            try { eq.release() } catch (_: RuntimeException) { }
        }
        equalizer = null
    }
}
