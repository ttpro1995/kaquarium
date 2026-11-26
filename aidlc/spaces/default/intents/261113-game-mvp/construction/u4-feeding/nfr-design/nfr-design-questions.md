# NFR Design — Questions (u4-feeding)

> Unit U4 NFR requirements: NFR1.1 (≤ 0.25 ms/tick), NFR3.1 (absolute-hour schedule, no RNG), NFR4.1–NFR4.2 (migration-owned feeding state, C6 pipeline + feeding import bounds), NFR5.1 (TDD/80%/CI). Produces: security-design.md, logical-components.md, traceability.json.

## Q1. [Model] Feeding compute layout (NFR1.1)

Per-tick work: auto-feeder due check (absolute-hour compare), expiry sweep over all stacks — O(stacks), unbounded by construction (BR12.2 append-per-buy) with a nanosecond per-stack constant. No cross-tick caches kept by U4; benchmarks pin 4-stack and 24-stack runs. Counters update on the feedFry command path, not per tick.

A. As stated: single pass, O(stacks) sweep, no allocation in the loop
B. Tune — say how
X. Other (please specify)

[Answer]: A + review amendments R-03/R-04: sweep restated unbounded, counters moved to command path, fixtures + 24-stack run.

## Q2. [Model] Failure domain and money atomicity (NFR4.2)

U4's failure domain is the feeding phase: a throw aborts the tick with NO rollback per C2 — partial feeding writes persist in memory un-versioned, recovery is reload from the last autosave. BuyFood deducts money under the C2 purchase-path exception: validate-first, deduct-or-reject atomic, one moneyChanged per accepted call.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A + review amendment R-02: no-rollback restatement (partial writes persist, autosave recovery).

## Q3. [Model] Test layout (NFR5.1)

Boundary suites: portion/expiry math, idempotency (same-day repeats), schedule first-run/backoff rules, 24-stack import cap, import fixtures (zero interval, negative qty, acquiredDay 0, unknown kind, 25th stack); golden replay with scheduled program + expiry crossing; benchmark probes per NFR1.1 (4-stack + 24-stack runs).

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A + review amendments R-03/R-05: no buy-merge (append-per-buy per BR12.2); acquiredDay 0 fixture.
