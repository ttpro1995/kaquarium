# NFR Requirements — Questions (u3-fish)

> Unit U3 owns Fish lifecycle: growth, health/stressor model, death, sex/genetics (`spawnFish`, `inheritGenome`), maturity/senior transitions, neglect protection in catch-up. Inception NFRs: NFR1 (100-fish ≥ 50 fps), NFR2 (WCAG AA — UI-owned, U7), NFR3 (seeded determinism), NFR4 (versioned saves + migrations), NFR5 (TDD, 80% line floor, CI).

## Q1. [Model] Per-fish tick budget (NFR1)

The fish phase runs per fish + per transition check every game-hour tick. U2's pass budgets the total sim at ≤ 8 ms/frame with the water share ≤ 4 ms worst case; the remaining phases (fish, breeding, commerce, notify) must fit the remainder.

A. Fish phase ≤ 2 ms/tick at 100 fish on the reference device (median of 30 timed ticks after 5 warmup); growth/health math is closed-form per fish, no per-fish allocation; genome rolls only on spawn/grade events, never per tick
B. Tune — say how
X. Other (please specify)

[Answer]: A + review amendment R-01: re-budgeted to ≤ 0.5 ms/tick (≤ 2 ms/frame at x4) to compose with water ≤ 4 ms/frame within the ≤ 8 ms total; verification aligned to benchmark.test.ts protocol (50 warmup, p95 of 300, heap < 64 KB).

## Q2. [Model] Determinism of genetics and life events (NFR3)

Sex 50/50, juvenile size 50–70%, genome per-fish rolls, clutch draws, and death/maturity transitions all draw through `ctx.rng` in a fixed per-fish iteration order (sorted fish id), so replay reproduces every birth, death, and genome.

A. Confirm: fixed iteration order (sorted id) + ctx.rng only; golden replay test covers a birth-death-maturity script
B. Tune — say how
X. Other (please specify)

[Answer]: A + review amendments R-02/R-03: stable store key order, no per-tick sort (replay-pinned); scoped to RNG-driven events (sex/size/genome), BR10.6 age-driven transitions exempt, clutch draws move to U5's NFR pass.

## Q3. [Model] Save migration for Fish fields (NFR4)

`Fish.stunted` lands with U5's implementation (U3 data completion): pre-U5 saves load it as `false`; the v1 → v2 migration (U2 Tank register) also fills any absent Fish field with its documented default. Genome records are opaque maps — validated as records, never executed.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A + review amendment R-04: single owner — the v1 → v2 migration fills `stunted = false` (register row added); no load-defaulting path; `Fish.genome` is-record enforced post-migration (U2 NFR4.3) plus U3 consumer guards.

## Q4. [Model] Tech stack for U3 (tech-stack-decisions)

TypeScript strict, Vitest + 80% line floor in CI, ESLint per repo config (no formatter configured in this repo); no new dependencies — pure logic over U1 types + `ctx.rng` + species catalogue reads.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A
