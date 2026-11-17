package `fun`.upup.musicfree.soundEffects

import com.doublesymmetry.kotlinaudio.players.components.HetingAnalysisProcessor
import com.doublesymmetry.kotlinaudio.players.components.HetingAnalysisTap
import com.google.android.exoplayer2.C
import com.google.android.exoplayer2.audio.AudioProcessor.AudioFormat
import com.google.android.exoplayer2.audio.AudioProcessor
import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.junit.Assert.*
import org.junit.Test

class PcmAnalysisTest {
    @Test fun acceptsEmptyDrainBuffersBeforeFirstAudioWithAnalysisOnAndOff() {
        for (enabled in listOf(false, true)) {
            val processor = HetingAnalysisProcessor()
            HetingAnalysisTap.enabled = enabled
            try {
                processor.configure(AudioFormat(48000, 2, C.ENCODING_PCM_16BIT))
                processor.flush()
                processor.queueInput(AudioProcessor.EMPTY_BUFFER)
                assertFalse(processor.output.hasRemaining())
                val input = ByteBuffer.allocateDirect(4).order(ByteOrder.LITTLE_ENDIAN)
                input.putShort(1234); input.putShort(-1234); input.flip()
                processor.queueInput(input)
                // A drain call must neither throw nor erase undelivered audio.
                processor.queueInput(AudioProcessor.EMPTY_BUFFER)
                val output = processor.output.order(ByteOrder.LITTLE_ENDIAN)
                assertEquals(4, output.remaining())
                assertEquals(1234, output.short.toInt())
                assertEquals(-1234, output.short.toInt())
                processor.queueInput(AudioProcessor.EMPTY_BUFFER)
                processor.queueEndOfStream()
                assertTrue(processor.isEnded)
            } finally {
                HetingAnalysisTap.enabled = false
                processor.reset()
            }
        }
    }

    @Test fun keepsPlaybackBytesAndDownmixesOnlyTheAnalysisCopy() {
        val processor = HetingAnalysisProcessor()
        val windows = mutableListOf<FloatArray>()
        HetingAnalysisTap.enabled = true
        HetingAnalysisTap.onWindow = { samples, _ -> windows.add(samples) }
        try {
            processor.configure(AudioFormat(48000, 2, C.ENCODING_PCM_16BIT))
            processor.flush()
            val input = ByteBuffer.allocateDirect(48000 * 4).order(ByteOrder.LITTLE_ENDIAN)
            repeat(48000) { input.putShort(8192); input.putShort(8192) }
            input.flip()
            val original = ByteArray(input.remaining()); input.duplicate().get(original)
            processor.queueInput(input)
            val output = processor.output
            val actual = ByteArray(output.remaining()); output.get(actual)
            assertArrayEquals(original, actual)
            assertEquals(1, windows.size)
            assertEquals(15600, windows[0].size)
            assertEquals(0.25f, windows[0][100], 0.0001f)
            val before = HetingAnalysisTap.epoch.get()
            processor.flush()
            assertTrue(HetingAnalysisTap.epoch.get() > before)
        } finally {
            HetingAnalysisTap.enabled = false
            HetingAnalysisTap.onWindow = null
            processor.reset()
        }
    }
}
