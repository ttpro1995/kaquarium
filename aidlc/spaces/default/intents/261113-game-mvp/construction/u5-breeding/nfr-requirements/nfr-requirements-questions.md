# NFR Requirements — Questions (u5-breeding)

> Unit U5 owns Breeding: pair bonds, spawn attempts, gestation/incubation, fry survival, grading (BR14–BR15). Inception NFRs: NFR1 (100-fish ≥ 50 fps), NFR2 (WCAG AA — UI-owned, U7), NFR3 (seeded determinism), NFR4 (versioned saves + migrations), NFR5 (TDD, 80% line floor, CI).

## Q1. [Model] Breeding phase budget (NFR1)

Frame composition so far: water 4 + fish 2 + feeding 1 = 7 of the ≤ 8 ms/frame total at x4. Breeding work per tick is per-pair gate checks + per-cohort decay (pairs ≤ fish/2, cohorts few).

A. Breeding ≤ 0.25 ms/tick; the combined remainder (breeding + commerce + notify) is verified by the full-tick p95 ≤ 8 ms gate rather than per-phase probes, since breeding is the smallest phase
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Spawn and clutch determinism (NFR3)

Clutch/cohort draws (deferred to U5 from the U3 pass) plus per-pair attempt rolls draw through `ctx.rng` while iterating pairs/cohorts in the store's stable key order — no per-tick sort; replay reproduces every conception, brood size, and hatch.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q3. [Model] Save migration for breeding state (NFR4)

`GameState.pairs` does not exist in the built types (U5 data completion): the v1 → v2 migration adds it as an empty record; `BreedingPair` and cohort counter defaults ride the same migration (register rows amended; no load-defaulting path).

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q4. [Model] Tech stack for U5 (tech-stack-decisions)

TypeScript strict, Vitest + 80% line floor in CI, ESLint per repo config (no formatter configured in this repo); no new dependencies — pure logic over U1 types + `ctx.rng` + catalogue reads.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A
