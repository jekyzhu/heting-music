package `fun`.upup.musicfree.soundEffects

import org.junit.Assert.*
import org.junit.Test

class GenreDecisionTest {
    @Test fun requiresThreeConsistentWindowsAndResetsOnTrackChange() {
        val decision = GenreDecision()
        val rock = mapOf("rock" to 0.7f, "folk" to 0.1f)
        assertNull(decision.accept(rock))
        assertNull(decision.accept(rock))
        assertEquals("rock", decision.accept(rock))
        decision.reset()
        assertNull(decision.accept(rock))
    }
    @Test fun rejectsLowConfidenceAndMixedGenres() {
        val decision = GenreDecision()
        repeat(4) { assertNull(decision.accept(mapOf("folk" to 0.19f))) }
        repeat(4) { assertNull(decision.accept(mapOf("rock" to 0.6f, "folk" to 0.58f))) }
        repeat(4) { assertNull(decision.accept(mapOf("rock" to Float.NaN))) }
    }
    @Test fun changingCandidatesNeverAccumulatesUnrelatedVotes() {
        val decision = GenreDecision()
        repeat(4) {
            assertNull(decision.accept(mapOf("rock" to 0.7f)))
            assertNull(decision.accept(mapOf("folk" to 0.7f)))
        }
    }
}
