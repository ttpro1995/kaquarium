# Security Design — u4-feeding

> Upstream: `nfr-requirements/security-requirements.md` (NFR3.1, NFR4.1, NFR4.2, NFR5.1), `tech-stack-decisions.md` (NFR1.1 ≤ 0.25 ms/tick, 4-stack fixture), `functional-design/functional-spec.md` (W16–W20), `functional-design/rules.md` (BR12–BR13), `contract-summary.md` (C2 purchase-path exception + no-rollback, C6). Answers from `nfr-design-questions.md` (Q1–Q3 all A).

## Design inputs

- `functional-spec.md` W16 (buy/append-one-stack) W17–W19 (feed paths with day idempotency) W18 (auto-feeder schedule) define the operations this design hardens.
- `tech-stack-decisions.md` NFR1.1 (≤ 0.25 ms/tick, 4-stack + 24-stack import-cap runs) is enforced by the single-pass O(stacks) layout below.

## Compute layout (NFR1.1)

Single pass per tick: auto-feeder due check (absolute-hour compare, no backlog run) → expiry sweep over all stacks — O(stacks), unbounded by construction since BR12.2 appends one stack per buy, with a nanosecond-scale constant per stack (one integer compare), so even 10× the 24-stack import cap fits the 0.25 ms budget. No cross-tick caches kept by U4 (counters live in `GameState`, recomputed reads each tick). No per-tick allocation in the sweep loop. Day-boundary counter updates are NOT per-tick work: `firstFoodDays`/`lastFryFedDay` update on the `feedFry` command path (BR13.3/W19) only.

## Money atomicity + failure domain (NFR4.2)

`feeding.buyFood` deducts under the C2 purchase-path exception: validate-first (known kind, qty, funds), deduct-or-reject atomic, one `moneyChanged` per accepted call; a rejection changes nothing. U4 is the FIRST phase, but a feeding-phase throw still aborts with NO rollback per C2: partial feeding writes (lastRunHour, satiety, waste, stock) persist in memory un-versioned with no version bump, and recovery is reload from the last autosave — only later-phase writes are absent (they never ran). Committed state (last version-bumped tick, saved slots) is untouched.

## Test design (NFR5.1)

TDD, 80% line floor, CI gate. Boundary suites: portion/expiry math, day idempotency (same-day repeats), schedule first-run + interval + null-clear, 24-stack import cap, import fixtures (zero intervalHours, negative qty, acquiredDay 0, unknown kind, 25th stack); golden replay with scheduled program + expiry crossing; benchmark probes per NFR1.1 (50 warmup, p95 of 300 ≤ 0.25 ms on the 4-stack fixture and at the 24-stack import cap, heap < 64 KB/100 ticks).

## What's explicitly not built

No auth, no encryption, no PII (food data is gameplay inventory), no network surface. The auto-feeder never dispenses while unaffordable logic runs elsewhere — funds are checked at buy time, not per dispense (W18).
