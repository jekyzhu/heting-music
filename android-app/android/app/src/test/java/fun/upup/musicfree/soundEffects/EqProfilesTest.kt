package `fun`.upup.musicfree.soundEffects

import org.junit.Assert.*
import org.junit.Test

class EqProfilesTest {
    @Test fun automaticRecognitionUsesTheSameStrongerCurvesAsManualPresets() {
        assertArrayEquals(doubleArrayOf(6.0, 4.0, -2.0, 2.0, 4.0), EqProfiles.gains("rock", 1.7), 0.001)
        assertArrayEquals(doubleArrayOf(-1.5, 1.5, 3.5, 1.5, 0.0), EqProfiles.gains("folk", 1.7), 0.001)
        assertArrayEquals(doubleArrayOf(3.0, 1.0, -1.0, 2.0, 3.0), EqProfiles.gains("rock", 1.0), 0.001)
    }
    @Test fun unknownAndOriginalStayFlatAndStrongProfilesRemainBounded() {
        assertArrayEquals(DoubleArray(5), EqProfiles.gains("unknown", 1.7), 0.001)
        assertArrayEquals(DoubleArray(5), EqProfiles.gains("flat", 1.7), 0.001)
        assertTrue(EqProfiles.gains("electronic", 1.7).all { it in -6.0..6.0 })
    }
}
