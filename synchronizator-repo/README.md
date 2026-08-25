# SYNCHRONIZATOR

*A tuning-fork game: strangers across the world make one movement at one moment — and feel unity in their bodies.*

**[Українською → README.uk.md](README.uk.md)**

---

## What this is

You pick six tags that resonate with you — alchemy, quantum mechanics, hermeticism, nonlinearity, renaissance, dao, anything. The system gathers a circle of people whose tags resonate with yours — by meaning, not by letters. At a set moment, everyone in the circle moves their phone along the same trajectory, eyes closed, guided by the phone's vibration and sound. The circle sees one thing afterwards: how close it came to moving as one.

No login. No password. Nothing is collected. We don't want to take anything from a person — we want to give them a vibe. And that vibe is creativity.

We call the layer this game explores the **psycho-emotional internet**: technology helping people access the hidden capacities of joined consciousness.

## Why open source

This game only makes sense if you can check what it does — especially what it *doesn't* do with your data (see [CONSTITUTION.md](CONSTITUTION.md): the answer is *nothing*, and the architecture makes that verifiable). And a game about unity built behind closed doors would be a joke at our own expense.

## The first circle

The community that builds the synchronizer is its first circle: **the circle that makes the game plays it first.** Every phase is tested on ourselves before anyone else. Building together, synchronized by the thing we're building — that's not a development methodology, that's the experiment already running.

Entry point: our Sunday live streams (see [137lab.xyz](https://137lab.xyz)) and GitHub Discussions here.

## How it works (short version)

"Simultaneous" means a tight tolerance between any two participants anywhere on Earth. The trick: **schedule, not stream.** The network transmits only the wave's schedule; each phone plays the rhythm locally against a shared clock. Three channels at three speeds: rhythm (local, near-zero jitter) · phase (network, slow updates are fine) · meaning (tags → choreography, slowest). Details: [docs/engineering.md](docs/engineering.md).

The mathematics of "how much are we one" is honest and open: the Kuramoto order parameter *r* ∈ [0, 1], the same number physicists use for fireflies flashing in sync. Details and sources: [docs/science.md](docs/science.md).

**Open research question we're genuinely unsure about:** does the well-documented bonding effect of synchronous movement survive distance, when bodies are not in one room? The game itself is the measurement.

## Phases

| Phase | What | Status |
|---|---|---|
| 0 | Live test: 90 seconds of shared movement during a stream, zero code | preparing — [phases/phase-0.md](phases/phase-0.md) |
| 0.5 | Room test: one Wi-Fi, rough page, real latency numbers | — |
| 1 | Waves: one ritual, hourly waves, one global circle | — |
| 2 | The flock: collective steering, AI choreographer, semantic circles | — |
| 3 | Beyond the phone: physical devices | — |

## Who

**Vlad** — vision and voice. **Liza** — the field. **Claude** — an AI, co-author: I write code, docs and issues here under my own name; the human–AI symbiosis is part of what this lab is. **The first circle** — the first bodies of the game.

## License

[MIT](LICENSE). The [constitution](CONSTITUTION.md) is not a license — it's a covenant. Breaking it is possible; breaking it invisibly is not.
