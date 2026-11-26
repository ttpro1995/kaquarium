# Code Summary — u2-tank-water

> Unit `u2-tank-water` (U2 Tank & Water library) plus the v1 → v2 breaking-change
> migration executing `tech-stack-decisions.md`. TDD red-green-refactor throughout;
> Standard volume + mvp 80% line floor.

## Files

Created (`packages/u2-tank-water/`):

- `package.json` — `@aquarium/u2-tank-water`, ESM, depends on
  `@aquarium/u1-sim-foundation`. No new runtime dependencies (pure logic over U1 types + `ctx.rng`).
- `tsconfig.json` — extends the root config, scoped to this package's `src`/`tests`.
- `src/water.ts` — registered `u2.water` system (water phase) + pure math
  (`qualityBandOf`, `activityOf`, `tempFit`, `tempTargetC`, `clampChem`,
  `recomputeBioload`) + U2-owned selectors (`tankWater`, `waterQuality`,
  `capacity`, `projectedBioload`, `bioloadOf`, `tempFitFor`).
- `src/commands.ts` — `tank.waterChange`, `tank.buyEquipment`,
  `tank.upgradeTier` handlers + `CommandMap` augmentation + shared gates
  (`checkFunds`, `checkUnlock`, `spend`) + shop tables (W10 prices/unlocks).
- `src/events.ts` — `SimEventMap` augmentation (`waterChanged`,
  `equipmentUpgraded`, `tierUpgraded`, `tankOvercrowded`, `fishSick`) plus the
  U6-owned `moneyChanged` shape reused under the C2 purchase-path exception.
- `src/index.ts` — `register(registry)` (system + 3 commands); re-exports.

Changed (`packages/u1-sim-foundation/`):

- `src/types.ts` — v2 Tank alignment (`TankWater` waste/nitrate/tempC,
  structured `Equipment`, tier-linked `volumeL`, latch fields), `Fish.stunted`,
  `FryCohort` stage/counters, `FoodItem` acquiredDay/target, `GameState.pairs`
  + `feeding`, `MarketState.lastTrendDay`, new `Order` fields,
  `Notification.subjectId?`, `Species.tempRangeC?`, `TIER_VOLUME_L` +
  `tierVolumeL`, `defaultTank`/`createInitialState` updated.
- `src/persistence/migration.ts` (new) — pure `migrateV1ToV2` + exported
  derivation helpers (`deriveQualityBand`, `deriveOvercrowdLatch`,
  `deriveTempPoorLatch`, `defaultFoodTarget`).
- `src/persistence/persistence.ts` — `CURRENT_SCHEMA_VERSION` 1 → 2, default
  migration `{ 1: migrateV1ToV2 }`, 2 MB pre-parse size gate, pre-migrate count
  gate (fish 1000 / cohorts 500 / orders 6 / notifications 100 / food 24),
  extended `validateStateShape` (tank pairing/chemistry/latches, genome
  is-record, U4/U5/U6 presence + bounds, pairs ≤ 500).
- `src/events.ts` — U1's own `whileYouWereAway` variant declared (ownership fix
  exposed by the narrowed union).
- `src/catchup.ts` — summary collector reads through `BaseSimEvent` (aggregates
  foreign kinds by design).
- `src/species.ts` — `tempRangeC` validated when present.
- `src/index.ts` — new types, `tierVolumeL`, `migrateV1ToV2` + helpers, barrier
  cap constants re-exported.
- `tests/persistence.test.ts` — version assertion 1 → 2 (registered bump).
- `tests/catchup.test.ts`, `tests/commands-drain.test.ts` — foreign-kind doubles
  via a local `foreign()` helper / `as never` + string-cast, so test doubles
  never enter production types.
- `tests/benchmark.test.ts`, `tests/types-store.test.ts` — fixtures gain
  `stunted: false` (v2 shape).

Repo:

- `eslint.config.js` — NFR3.2 banned-API rules generalized from
  `packages/u1-sim-foundation` to `packages/*/src|tests` (U2 covered from its
  first file).
- `vitest.config.ts` — `--expose-gc` for fork workers so allocation probes
  measure retained growth (deterministic heap probe).
- `contract-summary.md` — C1 Tank/Fish/FoodItem/FryCohort/MarketState/Order/
  Notification rows + GameState block (pairs, feeding); C4 `fishSick` cause
  widened to `waterQuality | temperature`; C6 `schema_version` 1 → 2.

## Decisions

- `tempFitFor(state, species)` takes the resolved species entry, not a species
  id: a selector cannot reach the catalogue from `GameState` alone, so the
  caller (system/handler with `ctx.species`) resolves it. Pure function of its
  inputs; U3/U6 call sites do the lookup.
- `moneyChanged` is declared in U2's augmentation with the exact U6 shape
  (`{ delta, balance }`) under the C2 purchase-path exception. U6's canonical
  declaration must use this identical shape; any divergence is a compile error
  by construction.
- Re-buying the installed level or downgrading rejects `INVALID_QUANTITY`
  (level 1 is the free starter kit; downgrades are not sold — no spec price
  exists for them). Tier requests outside 2..3 or at/below current likewise
  reject `INVALID_QUANTITY`.
- `migrateV1ToV2` cannot read the catalogue, so `tempPoorLatch` derives from
  the tolerant-default equivalence (fit < 0.5 ⟺ tempC < 15 or > 33), and
  `Order.minSizeCm` defaults to 0 (no size gate — never newly blocks an
  existing order). Old cohorts default to stage `fry` (eggs need a `hatchDay`
  no v1 save can supply).
- Feeding deep validation (schedule program shape) is U4's; the U2 barrier
  requires `feeding` present with a null-or-object schedule. Breeding deep
  validation is U5's; pairs get presence + cap (≤ 500) + field checks now.
- Heap probe forces a scavenge around each window: without it the reading
  measures uncollected float garbage (~7 KB/tick, inherent to float math),
  not retention. Steady-state `runWaterTick` allocates no objects (two-pass
  temp episode: count first, collect only on the opening tick).

## Test report

- `npx vitest run` — 12 files, 86 tests, all pass (U1 54, U2 32).
- U2 breakdown: migration 10, water 9, equipment 7, commands-integration 4,
  benchmark 2. TDD: each file failed first (missing module / rejected-shape
  assertions recorded), then passed with minimum implementation.
- `npx tsc --noEmit` — clean (includes repairing the intermediate
  open-map narrowing in U1 src/tests; full-program union regains every
  variant as units land).
- `npx eslint packages/u2-tank-water/src packages/u2-tank-water/tests` —
  clean (0 errors, 0 warnings; repo-wide U1 paths also clean).
- `npx vitest run --coverage` — overall 86.2% lines (floor 80 met);
  `u2-tank-water/src` 98% lines (water.ts 100%, commands.ts 95.8%,
  events.ts type-only). Benchmarks: water-phase p95 0.06 ms (budget 1.0 ms);
  retained heap growth ≈ 0 KB/100 ticks (bound 64 KB).
- Failing-output record (red phases): migration 8 failed/2 passed
  (`migrateV1ToV2 is not a function` + barrier assertions against v1
  behaviour); water/equipment failed on missing modules; heap probe failed
  at 1638 KB pre-GC (resolved by scavenge + zero-alloc refactor, −1.09 KB
  median after).
