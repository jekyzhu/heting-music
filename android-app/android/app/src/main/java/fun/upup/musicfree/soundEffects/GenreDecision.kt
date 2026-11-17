package `fun`.upup.musicfree.soundEffects

/** Confidence gate and consecutive-window voting; scores are model confidences, not accuracy. */
class GenreDecision {
    private var candidate: String? = null
    private var votes = 0
    fun reset() { candidate = null; votes = 0 }
    fun accept(scores: Map<String, Float>): String? {
        val ranked = scores.entries.filter { it.value.isFinite() }.sortedByDescending { it.value }
        val best = ranked.firstOrNull() ?: return null.also { reset() }
        val runnerUp = ranked.getOrNull(1)?.value ?: 0f
        if (best.value < 0.20f || best.value - runnerUp < 0.08f) {
            reset(); return null
        }
        if (candidate == best.key) votes++ else { candidate = best.key; votes = 1 }
        return if (votes >= 3) best.key else null
    }
}
