# Security Design — u5-breeding

> Upstream: `nfr-requirements/security-requirements.md` (NFR3.1, NFR4.1, NFR4.2, NFR5.1), `tech-stack-decisions.md` (NFR1.1 ≤ 0.125 ms/tick, 50-pair/10-cohort fixture), `functional-design/functional-spec.md` (W21–W25), `functional-design/rules.md` (BR14–BR15), `contract-summary.md` (C2 no-rollback, C6). Answers from `nfr-design-questions.md` (Q1–Q3 all A).

## Design inputs

- `functional-spec.md` W22 (spawn attempts), W24 (fry life), W25 (grading with nursery-adjusted batch formula) define the operations this design hardens.
- `tech-stack-decisions.md` NFR1.1 (≤ 0.125 ms/tick, 50-pair/10-cohort fixture) is enforced by the single-pass layout below.

## Compute layout (NFR1.1)

One pass per tick over pairs then cohorts in stable key order: pair gate checks (eligibility + condition, closed-form) → per-eligible-pair attempt roll each tick (inside the 0.125 ms budget) → per-cohort midnight decay (day-boundary application, newborn grace). No cross-tick caches kept by U5 (readyDay/hatchDay/ageDays live on the records; cooling→paired promotion reads live state). No per-tick allocation means no scratch buffers — a successful spawn still creates its cohort record (W23a/W23b). Clutch, fertility, and genome rolls happen at spawn/grade time via the passed `rng` parameter (supplied as `ctx.rng`).

## Failure domain (NFR4.2)

U5's failure domain is the breeding phase: a throw aborts the tick with NO rollback per C2 (earlier-phase writes persist un-versioned; recovery = last autosave). Silent cleanup (dissolved pairs, zeroed cohorts, no events) mutates only U5-owned records, so a partial tick never orphans cross-unit references.

## Test design (NFR5.1)

TDD, 80% line floor, CI gate. Boundary suites: re-pair guard, gate matrix, seeded clutch scaling, fertility range, day-boundary decay + grace, grading capacity (nursery-adjusted batch), stunt flag, silent cleanup; golden replay pairing → spawn → hatch → grade; benchmark probes per NFR1.1 (50-pair/10-cohort fixture, p95 of 300 ≤ 0.125 ms).

## What's explicitly not built

No auth, no encryption, no PII (genome pools are gameplay data), no network surface. No culling commands, no inbreeding tracking (deferred per functional scope).
