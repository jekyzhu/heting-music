package `fun`.upup.musicfree.soundEffects

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.doublesymmetry.kotlinaudio.players.components.HetingAnalysisTap
import org.tensorflow.lite.task.audio.classifier.AudioClassifier
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

object GenreAnalyzer {
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val busy = AtomicBoolean(false)
    private val decision = GenreDecision()
    private var classifier: AudioClassifier? = null // Worker thread only.
    private var context: Context? = null
    private var token = -1L
    private var attempts = 0
    private var currentTrack = ""
    @Volatile private var terminal: String? = null
    @Volatile private var active = false
    @Volatile var state = "off"
        private set
    @Volatile var detected: String? = null
        private set
    @Volatile var confidence = 0f
        private set
    private var listener: ((String) -> Unit)? = null

    fun initialize(appContext: Context, onDetected: (String) -> Unit) {
        context = appContext.applicationContext
        listener = onDetected
        HetingAnalysisTap.onWindow = { samples, epoch ->
            if (active && busy.compareAndSet(false, true)) {
                worker.execute {
                    try { analyze(samples, epoch) } finally { busy.set(false) }
                }
            }
        }
    }

    fun configure(enabled: Boolean, track: String) {
        if (active != enabled || track != currentTrack) {
            HetingAnalysisTap.epoch.incrementAndGet()
            detected = null; confidence = 0f
            terminal = null
        }
        currentTrack = track
        active = enabled
        HetingAnalysisTap.enabled = enabled && terminal == null
        state = if (enabled) terminal ?: "sampling" else "off"
    }

    private fun analyze(samples: FloatArray, epoch: Long) {
        if (!active || epoch != HetingAnalysisTap.epoch.get()) return
        try {
            if (token != epoch) {
                token = epoch; attempts = 0; decision.reset()
                detected = null; confidence = 0f
            }
            // Stop sampling once stable, or after ten windows (about 37 s of playback).
            if (attempts >= 10 || detected != null) return
            val model = classifier ?: AudioClassifier.createFromFileAndOptions(
                requireNotNull(context), "yamnet.tflite",
                AudioClassifier.AudioClassifierOptions.builder().setMaxResults(521).build()
            ).also { classifier = it }
            val input = model.createInputTensorAudio()
            input.load(samples)
            val scores = mutableMapOf<String, Float>()
            for (result in model.classify(input)) for (category in result.categories) {
                val genre = when (category.label) {
                    "Rock music", "Heavy metal", "Punk rock", "Grunge", "Progressive rock",
                    "Rock and roll", "Psychedelic rock" -> "rock"
                    "Folk music" -> "folk"
                    "Pop music" -> "pop"
                    "Classical music", "Opera" -> "classical"
                    "Electronic music", "House music", "Techno", "Dubstep", "Drum and bass",
                    "Electronica", "Electronic dance music" -> "electronic"
                    else -> null
                }
                if (genre != null) scores[genre] = maxOf(scores[genre] ?: 0f, category.score)
            }
            attempts++
            val stable = decision.accept(scores)
            val score = scores.values.maxOrNull() ?: 0f
            main.post {
                if (!active || epoch != HetingAnalysisTap.epoch.get()) return@post
                confidence = score
                if (stable != null) {
                    detected = stable; state = "detected"; terminal = "detected"
                    HetingAnalysisTap.enabled = false
                    listener?.invoke(stable)
                } else if (attempts >= 10) {
                    state = "uncertain"; terminal = "uncertain"
                    HetingAnalysisTap.enabled = false
                }
            }
        } catch (_: Exception) {
            unavailable(epoch)
        } catch (_: LinkageError) {
            unavailable(epoch)
        }
    }

    private fun unavailable(epoch: Long) {
            main.post {
                if (active && epoch == HetingAnalysisTap.epoch.get()) {
                    state = "unavailable"; terminal = "unavailable"
                    HetingAnalysisTap.enabled = false
                }
            }
    }
}
