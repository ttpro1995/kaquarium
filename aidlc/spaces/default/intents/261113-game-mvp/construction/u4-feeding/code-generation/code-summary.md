# Code Summary — u4-feeding

> Unit `u4-feeding` (U4 Feeding library: food stock, feeding-phase system,
> buyFood/feedFish/feedFry/setAutoFeeder commands, selectors, events).
> TDD red-green-refactor throughout (Steps 3–12); Standard volume + mvp
> 80% line floor. Consumes the migrated v2 shape; builds on the landed
> U2 migration + U3 fish lifecycle. No U1 changes (U4 owns behaviour over
> U1's shared FoodItem/FeedingState types).

## Files

Created (`packages/u4-feeding/`):

- `package.json` — `@aquarium/u4-feeding`, ESM, depends on
  `@aquarium/u1-sim-foundation` + `@aquarium/u2-tank-water`. No new runtime
  dependencies (pure logic over U1 types + `ctx.rng` + U2 band reads in tests).
- `tsconfig.json` — extends the root config, scoped to this package's `src`/`tests`.
- `src/food.ts` — stock data model (BR12): `FOOD_CATALOG` (flakes 2/0.7/fish/never,
  pellets 4/0.9/fish/never, liveFirst 6/1.0/fry/7-day), `WASTE_PER_PORTION = 2.0`,
  `SATIETY_PER_PORTION = 25`; `isFoodKind`, `isExpired` (game-day rule),
  `restorePerPortion` (round(25 x quality)), `usableFoodStacks` (non-expired,
  oldest-acquired first), `makeStack` (one dated stack per buy), `nextFoodId`
  (seeded hex, U3 pattern).
- `src/schedule.ts` — program state (BR13.4): `absoluteHour`
  (gameDay x 24 + gameHour, deterministic), `emptySchedule`, `makeSchedule`
  (lastRunHour pinned at creation), `isScheduleDue`, `validateScheduleInput`
  (numbers >= 1, fish-target kinds only).
- `src/feeding.ts` — registered `u4.feeding` system (feeding phase, W17–W20)
  plus the shared dispensing core the handlers call. `dispenseToFish`
  (ascending-satiety, roster-tiebreak, fill-to-100 order; leftover to waste;
  depletion removes + foodOut; expired/dry returns null, nothing mutated).
  `dispenseToFry` (same event shape; fry eat 10 per portion
  min(portions, ceil(count/10)); U5 counters with day idempotency).
  `expirySweep` (foodOut for stacks whose last usable day was yesterday;
  the system gates it to the hour-0 tick so it fires exactly once per day).
  `runFeedingTick` (sweep + one scheduled run per tick, never a backlog;
  silent skip on dry shelves). C2-allowlisted writes only: food records,
  Fish.satiety, tank.water.waste, cohort firstFoodDays/lastFryFedDay,
  schedule.lastRunHour.
- `src/commands.ts` — `feeding.buyFood` (W16: UNKNOWN_ENTITY / INVALID_QUANTITY /
  INSUFFICIENT_FUNDS, atomic, one dated stack + moneyChanged),
  `feeding.feedFish` (W17: stack -> portions -> target, then the shared core),
  `feeding.feedFry` (W19: stack -> portions -> target -> cohort, eggs rejected,
  unknown cohorts UNKNOWN_ENTITY), `feeding.setAutoFeeder` (W18: null clears;
  setting needs the U2-installed device, fish-target kinds, positive numbers;
  creation pins lastRunHour). Shared `checkStack`/`checkPortions`/`spend`/
  `feedResult` helpers. Rejections mutate nothing by construction.
- `src/selectors.ts` — U4-owned pure readers for U7 panels: `foodStock`
  (every stack, expiry-flagged, optional kind filter), `usableFood`
  (non-expired oldest-first), `feedingProgram` (device + schedule).
- `src/events.ts` — `fed { foodId, portion }`, `overfed { wasteDelta }`,
  `foodOut { foodId }`, plus the U6-shape `moneyChanged` under the C2
  purchase-path exception (identical shape to U2's declaration).
- `src/index.ts` — `register` (system + 4 commands) and the full public surface.

## Tests (36, all green)

- `tests/stock.test.ts` (8) — catalogue pins, buyFood deduct/append/moneyChanged,
  the validation trio, game-day expiry, oldest-first usable order, schedule shape.
- `tests/feeding.test.ts` (11) — quality-scaled ascending-satiety restore,
  fill-to-100 roster order, waste clamp + overfed, depletion + foodOut,
  expired-never-dispenses, fry 10-per-portion + day idempotency, interval run,
  backlog-never, silent skip, sweep once-per-day.
- `tests/commands.test.ts` (7) — bus-level buy/feed/fry/programmer flows, event
  pairs through the drain, NOT_AVAILABLE paths (device, expiry, dryness),
  INVALID_SETTING paths (targets, eggs), UNKNOWN_ENTITY (cohorts), atomicity.
- `tests/selectors.test.ts` (4) — panel readers + the non-string gate pin.
- `tests/integration.test.ts` (3) — feed -> satiety -> U3 growth resumes
  (starving twin stalls); overfeed waste flips the U2 band fair -> poor;
  30 live ticks equal a 30-hour catch-up tick-for-tick.
- `tests/benchmark.test.ts` (3) — feeding-phase p95 0.0029 ms (4-stack) /
  0.0045 ms (24-stack) vs the 0.25 ms budget; heap -0.05 KB/100 ticks.

## Verification

- `npx vitest run packages/u4-feeding` — 6 files, 36 tests, all pass.
- `npx vitest run --coverage packages/u4-feeding` (scoped to U4 src) —
  98.39% lines (floor 80%); selectors/food/schedule/index/feeding at ~100%.
- `npx tsc --noEmit` — clean. (One U4-authored lesson: `src/events.ts`
  ships `export {};` — without it the file is a script, its
  `declare module` goes ambient, and every unit's SimEvent augmentation
  silently drops out of the program.)
- `npx eslint packages/u4-feeding/src packages/u4-feeding/tests` — clean.
- Not committed, per the dispatch brief.

## Notes / deviations

- Plan Steps 1–13 followed; one additive file beyond the plan's five test
  files (`tests/selectors.test.ts`, 4 tests) to pin the U7 panel contract —
  takes the suite from ~30 to 36 tests.
- `usablePortions` was specified nowhere and used nowhere; removed instead
  of tested.
- Catch-up stops the clock by contract (speed 0 + paused); the
  catch-up-identity test snapshots sim slices + day/hour only.
