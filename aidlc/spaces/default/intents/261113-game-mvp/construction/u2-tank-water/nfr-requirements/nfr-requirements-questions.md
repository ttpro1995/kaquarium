# NFR Requirements — Questions (u2-tank-water)

> Unit U2 owns Tank behaviour and water chemistry (BR8–BR9). Inception NFRs: NFR1 (100-fish ≥ 50 fps), NFR2 (WCAG AA — UI-owned, U7), NFR3 (seeded determinism), NFR4 (versioned saves + migrations), NFR5 (TDD, 80% line floor, CI). Most targets are settled upstream; these questions pin the U2-specific numbers.

## Q1. [Model] Per-tick compute budget (NFR1)

The water phase runs every game-hour tick: bioload scan over fish + cohorts, waste/nitrate math, filter conversion, latch updates. Frame budget at 50 fps is 20 ms shared with rendering.

A. Water phase ≤ 1 ms per tick at 100 fish on the reference device (Meizu Lucky 08); bioload scan is O(fish + cohorts) with cached per-fish terms, no allocation in the hot loop
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Determinism surface (NFR3)

U2 draws randomness only through `ctx.rng` (no Math.random/Date.now in systems); the 10-day filter cycle, water-change dilution, and latch transitions are pure functions of state + tick.

A. Confirm: no ambient nondeterminism in U2; replay of seed + command sequence reproduces water state exactly
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q3. [Model] Save migration for Tank latch fields (NFR4)

`prevQualityBand` / `overcrowdLatch` / `tempPoorLatch` derive deterministically from current numbers on load (U2 entities load rule), so no migration is needed for pre-latch saves; future Tank field additions ship with a forward migration + round-trip test per C6.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q4. [Model] Tech stack for U2 (tech-stack-decisions)

TypeScript (strict), Vitest + coverage 80% floor in CI (NFR5), ESLint + Prettier per team Code Style; no new dependencies — U2 is pure logic over U1 types.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A
