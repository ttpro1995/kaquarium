# Rules — u4-feeding

> Upstream: `unit-of-work.md`, `unit-of-work-story-map.md` (US3.1, US3.2 → U4), `stories.md` (AC3.1.1–AC3.2.2), `requirements.md` (FR3.1, FR3.2), `components.md` (Feeding), `contract-summary.md` (C1–C4, amended C2 exception), U2 design (waste deposit path, WASTE_PER_PORTION = 2.0), U3 design (satiety/health semantics). Answers from `functional-design-questions.md` (Q1–Q6, summary `Looks correct`).
> Rule-group convention: U1 BR1–BR7, U2 BR8–BR9, U3 BR10–BR11. U4 owns BR12 (stock) and BR13 (feeding); later units continue at BR14.

```yaml
rules:
  - id: BR12.1
    statement: The MVP catalogue is three fixed kinds with fixed quality, target, and expiry.
    category: policy
    applies_to: FoodItem
    trigger: Purchase, feeding, expiry checks.
    logic: IF kind is flakes THEN quality 0.7, target fish, never expires; IF pellets THEN 0.9, fish, never expires; IF liveFirst THEN 1.0, target fry, 7-day shelf life (Q1-A).
    violation: A stack whose quality/target/expiry disagrees with its kind is a bug.
    source: FR3.1

  - id: BR12.2
    statement: Buying food checks funds and lands a fresh dated stack, atomically.
    category: validation
    applies_to: FoodItem
    trigger: Dispatch of `feeding.buyFood { kind, qty }` (Q6-A).
    logic: IF kind unknown THEN reject UNKNOWN_ENTITY; IF qty < 1 THEN reject INVALID_QUANTITY; total = qty × pricePerUnit; IF money < total THEN reject INSUFFICIENT_FUNDS; ELSE deduct total, append one stack { kind, qty, acquiredDay: today }, emit moneyChanged { delta: −total, balance }, result price = total, bus bumps version once.
    violation: A rejection that mutates, or stock without a deduct, is a bug.
    source: FR3.1

  - id: BR12.3
    statement: Expiry is by game day; expired stacks are visible but never dispense.
    category: constraint
    applies_to: FoodItem
    trigger: Every feed path; U7 stock display.
    logic: IF shelfLifeDays > 0 AND acquiredDay + shelfLifeDays < today THEN the stack is expired; schedule-driven dispensing draws oldest-acquired non-expired first and skips expired stacks; named-stack commands (feedFish/feedFry) use only the named stack and reject NOT_AVAILABLE on its expiry/dryness regardless of other stock; a feed with zero usable portions rejects NOT_AVAILABLE; every feeding phase, each stack whose last usable day was yesterday (acquiredDay + shelfLifeDays == today − 1) emits foodOut { foodId } once (Q4-A).
    violation: Dispensing from an expired stack, or consuming newest-first, is a bug.
    source: FR3.1

  - id: BR12.4
    statement: New saves start with food in the cupboard.
    category: policy
    applies_to: FoodItem
    trigger: New-save bootstrap (U1 implements, U4 specifies).
    logic: IF a new save bootstraps THEN stock one flakes stack of 10 with acquiredDay = day 1 (Q6-A).
    violation: A new save with no usable food is a bug.
    source: FR3.1

  - id: BR13.1
    statement: Manual fish feeding restores satiety by appetite in roster order; quality scales the restoration.
    category: validation
    applies_to: Fish.satiety
    trigger: Dispatch of `feeding.feedFish { foodId, portions }` (Q2-A).
    logic: IF the stack is missing or expired THEN reject NOT_AVAILABLE; IF portions < 1 THEN reject INVALID_QUANTITY; IF kind target is fry THEN reject INVALID_SETTING; dispense d = min(portions, usable qty); each portion restores round(25 × quality) satiety in strict order — ascending satiety, ties by roster (insertion) order, filling one fish to 100 before moving on; emit fed { foodId, portion: eaten }; leftover = d − eaten.
    violation: Feeding the wrong target, skipping the expiry check, or restoring beyond 100 is a bug.
    source: FR3.2

  - id: BR13.2
    statement: Uneaten food becomes visible waste, never a hidden penalty.
    category: calculation
    applies_to: Tank.water.waste
    trigger: Same feed, after BR13.1.
    logic: IF leftover > 0 THEN waste = min(100, waste + leftover × WASTE_PER_PORTION) AND emit overfed { wasteDelta: leftover × 2.0 }; IF a stack hits 0 THEN remove it AND emit foodOut { foodId } (Q2-A).
    violation: Uneaten food that vanishes without waste, or a depleted stack with no foodOut, is a bug.
    source: FR3.2

  - id: BR13.3
    statement: Fry feeding runs through U4 into U5's cohort counters under the documented exception.
    category: validation
    applies_to: FryCohort
    trigger: Dispatch of `feeding.feedFry { foodId, cohortId, portions }` (Q5-A).
    logic: IF kind target is not fry THEN reject INVALID_SETTING; IF cohort missing THEN reject UNKNOWN_ENTITY; IF cohort stage is eggs THEN reject INVALID_SETTING (eggs don't eat — feeding them would accrue stunt-test days for nothing); portion/expiry/stock checks mirror BR13.1–BR13.2 (fed/overfed/foodOut behave the same) with fry eaten defined as min(portions, ceil(cohort.count / 10)) — 10 fry per portion (U5 pin); on success U4 writes the cohort's firstFoodDays/lastFryFedDay with day idempotency — IF today ≠ lastFryFedDay THEN firstFoodDays += 1 AND lastFryFedDay = today, ELSE counters unchanged (three feeds in one day count once) — the third named C2 exception.
    violation: Fish food dispensed to fry, or a successful fry feed that leaves the counters untouched, is a bug.
    source: FR3.2

  - id: BR13.4
    statement: The auto-feeder replays the manual path on a schedule, silently skipping when it cannot run.
    category: policy
    applies_to: FeedingSchedule
    trigger: U4's feeding-phase system, every tick.
    logic: IF no device installed OR no schedule set THEN do nothing; scheduled runs execute on catch-up ticks exactly as live (same pipeline — stock drains and waste may spike while U3 holds the protected floor; intended, the return is a rescue); IF now − lastRunHour ≥ intervalHours THEN run one BR13.1–BR13.2 feed with the scheduled kind/portions from oldest usable stacks and set lastRunHour = now; IF no usable stock THEN skip silently (the foodOut warning already fired when stock hit 0).
    violation: A scheduled run that rejects, emits differently from a manual feed, or runs without the device is a bug.
    source: FR3.2
```

| ID | Rule | Source |
|---|---|---|
| BR12.1 | Three fixed kinds: quality/target/expiry | FR3.1, AC3.1.1 |
| BR12.2 | Atomic buyFood with dated stacks | FR3.1, AC3.1.1 |
| BR12.3 | Game-day expiry + sweep foodOut; oldest-first scheduled draw; named-stack commands use the named stack | FR3.1, AC3.1.2 |
| BR12.4 | New saves start with 10 flakes | FR3.1, AC3.1.1 |
| BR13.1 | Ascending-satiety fill order; quality-scaled restore | FR3.2, AC3.2.1 |
| BR13.2 | Leftovers to waste + overfed; depletion emits foodOut | FR3.2, AC3.2.2 |
| BR13.3 | feedFry into U5 counters under C2 exception | FR3.2, AC3.2.1 |
| BR13.4 | Scheduled replay of the manual path; silent skips | FR3.2, AC3.2.1 |
