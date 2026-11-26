# NFR Requirements — Questions (u4-feeding)

> Unit U4 owns Feeding: food inventory (stock, quality, shelf life), manual feeding, auto-feeder schedule, fry feeding with day-idempotent counters. Inception NFRs: NFR1 (100-fish ≥ 50 fps), NFR2 (WCAG AA — UI-owned, U7), NFR3 (seeded determinism), NFR4 (versioned saves + migrations), NFR5 (TDD, 80% line floor, CI).

## Q1. [Model] Feeding phase budget (NFR1)

Frame composition so far: water ≤ 4 ms + fish ≤ 2 ms of the ≤ 8 ms/frame total sim budget at x4. Feeding work per tick is a schedule check plus a few counter writes.

A. Feeding phase ≤ 0.25 ms/tick (≤ 1 ms/frame worst case), leaving ≥ 1 ms/frame for breeding + commerce + notify combined; same benchmark protocol (50 warmup, p95 of 300, heap < 64 KB)
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Schedule determinism (NFR3)

The auto-feeder keys off the absolute game hour (`gameDay × 24 + gameHour`) with `lastRunHour` init at program creation; first run fires after one full interval, never as a backlog run. Day-idempotency counters (`lastFryFedDay`) key off `gameDay`.

A. Confirm: no wall-clock reads, no RNG in the feeding path; replay reproduces every feed, expiry sweep, and auto-feed event
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q3. [Model] Save migration for feeding state (NFR4)

`FeedingSchedule`, `FoodItem.acquiredDay/target`, cohort `firstFoodDays/lastFryFedDay` are plain data filled by the v1 → v2 migration with documented defaults when absent (same single-owner migration; register row amended if a field needs more than its default).

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q4. [Model] Tech stack for U4 (tech-stack-decisions)

TypeScript strict, Vitest + 80% line floor in CI, ESLint per repo config (no formatter configured in this repo); no new dependencies — pure logic over U1 types + read-only catalogue (no RNG in U4; expiry is game-day arithmetic).

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A + review note: Q4's original "plus ctx.rng (expiry sweeps)" corrected — expiry takes no RNG; ctx.rng reserved for future draws per NFR3.1.
