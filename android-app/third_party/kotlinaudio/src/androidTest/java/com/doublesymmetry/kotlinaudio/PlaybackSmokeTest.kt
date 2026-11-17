package com.doublesymmetry.kotlinaudio

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.doublesymmetry.kotlinaudio.models.AudioItemOptions
import com.doublesymmetry.kotlinaudio.models.AudioPlayerState
import com.doublesymmetry.kotlinaudio.models.DefaultAudioItem
import com.doublesymmetry.kotlinaudio.players.QueuedAudioPlayer
import com.doublesymmetry.kotlinaudio.players.components.HetingAnalysisTap
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.net.ServerSocket
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import kotlin.math.PI
import kotlin.math.sin

/** Exercises the actual Android decoder and AudioTrack, not a mocked PCM buffer. */
@RunWith(AndroidJUnit4::class)
class PlaybackSmokeTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext
    private fun main(block: () -> Unit) = instrumentation.runOnMainSync(block)

    @Test fun localPlaybackWithoutAnalysis() = play(false, false)
    @Test fun localPlaybackWithAnalysis() = play(true, false)
    @Test fun authenticatedStreamWithoutAnalysis() = play(false, true)
    @Test fun authenticatedStreamWithAnalysis() = play(true, true)

    private fun play(analysis: Boolean, http: Boolean) {
        val audio = wave()
        val file = File(context.cacheDir, "playback-smoke.wav").apply { writeBytes(audio) }
        val windows = AtomicInteger()
        val authorized = AtomicInteger()
        val server = if (http) ServerSocket(0) else null
        val serving = server?.let {
            thread(isDaemon = true) {
                try {
                    it.accept().use { socket ->
                        val reader = socket.getInputStream().bufferedReader()
                        val headers = mutableListOf<String>()
                        while (true) { val line = reader.readLine() ?: break; if (line.isEmpty()) break; headers.add(line) }
                        val valid = headers.any { h -> h.equals("Authorization: Bearer smoke-test-only", true) }
                        if (valid) authorized.incrementAndGet()
                        socket.getOutputStream().use { output ->
                            val status = if (valid) "200 OK" else "403 Forbidden"
                            output.write("HTTP/1.1 $status\r\nContent-Type: audio/wav\r\nContent-Length: ${if (valid) audio.size else 0}\r\nConnection: close\r\n\r\n".toByteArray())
                            if (valid) output.write(audio)
                        }
                    }
                } catch (_: java.io.IOException) { }
            }
        }
        lateinit var player: QueuedAudioPlayer
        var created = false
        try {
            HetingAnalysisTap.enabled = analysis
            HetingAnalysisTap.onWindow = { _, _ -> windows.incrementAndGet() }
            main {
                player = QueuedAudioPlayer(context)
                created = true
                val url = if (http) "http://127.0.0.1:${server!!.localPort}/audio" else file.toURI().toString()
                player.add(DefaultAudioItem(url, title = "Playback smoke test",
                    options = AudioItemOptions(headers = mutableMapOf("Authorization" to "Bearer smoke-test-only"))), true)
            }
            await("audio position must advance") { player.position > 1200 && player.isPlaying }
            main { player.pause() }
            var paused = 0L
            main { paused = player.position }
            Thread.sleep(250)
            main { assertFalse(player.isPlaying); assertTrue(player.position - paused < 150) }
            main { player.play() }
            await("playback must finish without an error") { player.playerState == AudioPlayerState.ENDED }
            main { assertNull(player.playbackError) }
            if (analysis) assertTrue("analysis receives decoded PCM", windows.get() > 0)
            else assertEquals(0, windows.get())
            if (http) assertEquals("stream headers survive", 1, authorized.get())
        } finally {
            main { if (created) player.destroy() }
            HetingAnalysisTap.enabled = false
            HetingAnalysisTap.onWindow = null
            server?.close(); serving?.join(1000); file.delete()
        }
    }

    private fun await(message: String, condition: () -> Boolean) {
        val deadline = System.currentTimeMillis() + 15000
        while (System.currentTimeMillis() < deadline) {
            var done = false
            main { done = condition() }
            if (done) return
            Thread.sleep(50)
        }
        fail(message)
    }

    private fun wave(): ByteArray {
        val rate = 48000
        val size = rate * 2 * 2 * 5
        val buffer = ByteBuffer.allocate(44 + size).order(ByteOrder.LITTLE_ENDIAN)
        buffer.put("RIFF".toByteArray()).putInt(36 + size).put("WAVEfmt ".toByteArray())
        buffer.putInt(16).putShort(1).putShort(2).putInt(rate).putInt(rate * 4).putShort(4).putShort(16)
        buffer.put("data".toByteArray()).putInt(size)
        repeat(rate * 5) { frame ->
            val sample = (sin(2 * PI * 440 * frame / rate) * 4000).toInt().toShort()
            buffer.putShort(sample).putShort(sample)
        }
        return buffer.array()
    }
}
