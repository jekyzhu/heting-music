package `fun`.upup.musicfree.soundEffects

import kotlin.math.roundToInt

/** Same five reference points and half-dB rounding as the JS preset policy. */
object EqProfiles {
    fun gains(genre: String, strength: Double): DoubleArray {
        require(strength.isFinite() && strength in 0.5..2.0)
        if (genre == "rock" && strength >= 1.5) return doubleArrayOf(6.0, 4.0, -2.0, 2.0, 4.0)
        val base = when (genre) {
            "rock" -> doubleArrayOf(3.0, 1.0, -1.0, 2.0, 3.0)
            "folk" -> doubleArrayOf(-1.0, 1.0, 2.0, 1.0, 0.0)
            "pop" -> doubleArrayOf(1.0, 0.0, 1.0, 2.0, 1.0)
            "classical" -> doubleArrayOf(1.0, 0.0, 0.0, 1.0, 2.0)
            "electronic" -> doubleArrayOf(4.0, 2.0, -1.0, 1.0, 3.0)
            else -> DoubleArray(5)
        }
        return base.map { ((it * strength * 2).roundToInt() / 2.0).coerceIn(-6.0, 6.0) }.toDoubleArray()
    }
}
