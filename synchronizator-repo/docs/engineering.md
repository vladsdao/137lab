# Engineering core

*Status: design brief for Phase 0.5 → 1. Numbers here are engineering targets, revised by measurement (Phase 0.5 exists to produce the real ones).*

## The problem

"Simultaneous across the planet" cannot be built by streaming a metronome: network jitter is larger than the tolerance the body notices. Target: any two participants anywhere hear/feel the same beat within **±50 ms**.

## The principle: schedule, not stream

The network never carries the rhythm. It carries the **wave schedule** — start moment, trajectory, tempo — and each phone plays the rhythm locally against a shared clock.

**Shared clock.** NTP-style offset estimation over the app's own connection: a dozen-plus round-trip samples, keep the best third by RTT, take the median offset. Re-measure before each wave.

**Local rhythm.** WebAudio with lookahead scheduling — audio events are queued against the corrected clock, so UI jank cannot shift the beat.

**Output latency calibration as ritual.** Every device adds its own audio/haptic latency. Calibration = eight taps to the beat; the constant offset between tap and beat is that device's correction. It doubles as the pre-wave tuning ritual — the tuning fork is tuned first.

## Three channels, three speeds

| Channel | Carries | Where | Speed |
|---|---|---|---|
| Rhythm | the beat itself | local (WebAudio/haptics) | jitter ≈ 0 |
| Phase | each participant's movement phase (0–359°) | network, 2–4 Hz | lag is fine |
| Meaning | tags → circle composition → trajectory | AI choreography | slowest |

Phase is the **only** thing that leaves the device (constitution, art. 1). Each client computes the circle's *r* itself from the phase feed — no server-side scoring.

## MVP stack

PWA at 137lab.xyz/sync. Realtime phase fan-out via a managed realtime channel (circle sizes small enough that every client can hold the full phase set). No accounts, no database of people.

## Platform constraints (known)

- **iOS Safari has no Vibration API** → sound + light-through-closed-eyelids (screen flash) as the fallback channels; deep haptics would need a native app — later phase, if ever.
- **DeviceMotion needs an explicit permission tap** on iOS — folded into the pre-wave ritual.
- A wave in a moving vehicle is noise; the game asks for a still body (also the point).
