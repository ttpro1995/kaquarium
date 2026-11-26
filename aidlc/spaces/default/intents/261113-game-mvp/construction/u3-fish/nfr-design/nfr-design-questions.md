# NFR Design — Questions (u3-fish)

> Unit U3 NFR requirements: NFR1.1 (≤ 0.5 ms/tick fish phase), NFR3.1 (key-order determinism, scoped RNG rule), NFR4.1–NFR4.2 (migration-owned stunted/genome, C6 pipeline), NFR5.1 (TDD/80%/CI). Produces: security-design.md, logical-components.md, traceability.json.

## Q1. [Model] Per-fish compute layout (NFR1.1)

Closed-form growth/health math per fish in stable key order; no per-tick allocation; genome rolls only on spawn/grade events. The fish-phase probe (50 warmup, p95 of 300 ≤ 0.5 ms) runs against the 100-fish benchmark save.

A. As stated: single pass, no caches shared across ticks (each tick recomputes from live state — caching would risk stale reads across phases)
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Failure domain and genome guard (NFR3.1, NFR4.1)

U3's failure domain is the fish phase: a throw aborts the tick with no rollback (earlier-phase writes persist un-versioned per the U2 design). Genome validation is defense-in-depth: post-migration barrier check plus consumer guards in `spawnFish`/`inheritGenome` (reject non-record at use).

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q3. [Model] Test layout (NFR5.1)

Boundary suites: growth-curve calibration (95% size at maturityDays), stressor matrix (hunger/water/temp/crowding), death causes incl. protected-critical catch-up behavior, sex/split distribution, genome roll shape, stunted factor, maturity/senior transitions; golden replay; benchmark probes.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A
