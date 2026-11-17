package com.doublesymmetry.kotlinaudio.players.components

import com.google.android.exoplayer2.C
import com.google.android.exoplayer2.audio.BaseAudioProcessor
import com.google.android.exoplayer2.audio.AudioProcessor.AudioFormat
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicLong

/** Receives only this player's decoded PCM. Never records the microphone or other apps. */
object HetingAnalysisTap {
    @Volatile var enabled = false
    @Volatile var onWindow: ((FloatArray, Long) -> Unit)? = null
    val epoch = AtomicLong(0)
}

/** Transparent pass-through. The model runs elsewhere; no inference or I/O on the audio thread. */
class HetingAnalysisProcessor : BaseAudioProcessor() {
    private var generation = -1L
    private val window = FloatArray(15600) // YAMNet classification model: 0.975 s at 16 kHz.
    private var count = 0
    private var skip = 0
    private var phase = 0
    private var sum = 0f
    private var sumCount = 0

    override fun onConfigure(inputAudioFormat: AudioFormat): AudioFormat =
        if (inputAudioFormat.encoding == C.ENCODING_PCM_16BIT) inputAudioFormat else AudioFormat.NOT_SET

    override fun queueInput(inputBuffer: ByteBuffer) {
        val analysis = inputBuffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
        val output = replaceOutputBuffer(inputBuffer.remaining())
        output.put(inputBuffer).flip() // Playback bytes remain bit-for-bit unchanged.
        if (!HetingAnalysisTap.enabled) return
        val token = HetingAnalysisTap.epoch.get()
        if (generation != token) {
            generation = token
            count = 0; skip = 0; phase = 0; sum = 0f; sumCount = 0
        }
        val channels = inputAudioFormat.channelCount
        val rate = inputAudioFormat.sampleRate
        while (analysis.remaining() >= channels * 2) {
            var mono = 0f
            repeat(channels) { mono += analysis.short / 32768f }
            mono /= channels
            // Average input frames before decimating; no change to the playback stream.
            sum += mono; sumCount++
            phase += 16000
            while (phase >= rate) {
                phase -= rate
                val sample = if (sumCount > 0) sum / sumCount else mono
                if (skip > 0) skip-- else {
                    window[count++] = sample
                    if (count == window.size) {
                        try { HetingAnalysisTap.onWindow?.invoke(window.copyOf(), token) }
                        catch (_: RuntimeException) { /* Analysis must never interrupt playback. */ }
                        count = 0
                        skip = 16000 * 3
                    }
                }
            }
            if (phase < 16000) { sum = 0f; sumCount = 0 }
        }
    }
    override fun onFlush() {
        HetingAnalysisTap.epoch.incrementAndGet()
        generation = -1
    }
}
