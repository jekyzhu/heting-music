# KotlinAudio source used by Heting Android

Upstream: https://github.com/doublesymmetry/KotlinAudio

Tag: v2.1.0; commit: bf71120704bfe4be2311cf86fc1e2ee1c3c702b7.

The `src/main` files are copied from that commit. The upstream Apache-2.0
LICENSE is retained here. Heting adds package-scoped audio-session broadcasts
to BaseAudioPlayer so its own equalizer follows ExoPlayer session changes and
releases effects when the player is destroyed. This avoids reflection, session
0, system-wide audio capture, and edits to node_modules. Gradle substitutes
this source module for RN Track Player's exact KotlinAudio v2.1.0 dependency.

The local build file retains the upstream runtime dependency versions and
omits upstream publishing and instrumentation-test plugins.
