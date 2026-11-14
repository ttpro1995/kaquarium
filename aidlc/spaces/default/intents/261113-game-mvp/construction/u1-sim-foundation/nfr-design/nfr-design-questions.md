# NFR Design — Questions (u1-sim-foundation)

> Unit U1 is a pure-TypeScript library kernel (store, tick pipeline, command bus, event drain, species data, persistence). NFR requirements fixed: NFR1.1 tick ≤ 8 ms p95 (300 ticks/50 warmup), NFR1.3 linear scaling R² ≥ 0.90, NFR1.4 autosave ≤ 50 ms, NFR4.3 sync bundled SHA-256, NFR4.2 halt/discard/reload containment, NFR3.2 banned-API lint rule. This stage designs the patterns, not the code.

## Q1. [Design] SHA-256 supply for the save digest (NFR4.3)

The digest must be synchronous (C6 signatures stay sync) and cost inside the NFR1.4 autosave budget. This decides what the Code Generation stage will build against.

A. Bundled zero-dependency sync SHA-256 utility inside U1 (audited once, no supply-chain surface, offline-safe)
B. Third-party dependency (e.g. js-sha256) via npm
X. Other (please specify)

[Answer]: A

## Q2. [Design] Fault-halt handshake between kernel and UI (NFR4.2)

NFR4.2 requires the tick loop to halt, the half-mutated store discarded, and U7 to offer reload-last-autosave. The kernel owns the halt; U7 owns the UI. This decides the handoff both sides build against.

A. Kernel halts loop + records a memory-only fault descriptor (tick id, system id, error); U7 polls it on the next frame and offers reload-last-autosave (discarding memory state, which is never persisted)
B. Kernel halts the loop only; U7 detects the halt by missed-tick timeout and offers reload
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
