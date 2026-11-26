# Code Summary — u5-breeding

> Unit `u5-breeding` (U5 Breeding library: breeding-phase system,
> pair/unpair/grade commands, selectors, events, GameState.pairs via the
> v1→v2 migration). TDD red-green-refactor throughout (Steps 3–12);
> Standard volume + mvp 80% line floor. Consumes the migrated v2 shape
> (`GameState.pairs`) + the U2 water selectors, U3 fish factories, and U4
> feedFry counters; no U1 changes (breeding params resolve additively per
> species with validated defaults).

## Files

Created (`packages/u5-breeding/`):

- `package.json` — `@aquarium/u5-breeding`, ESM, depends on
  `@aquarium/u1-sim-foundation` + `@aquarium/u2-tank-water` +
  `@aquarium/u3-fish` (+ `@aquarium/u4-feeding` dev, test boundary only).
  No new runtime dependencies (pure logic over U1 types + `ctx.rng`).
- `tsconfig.json` — extends the root config, scoped to this package's `src`/`tests`.
- `src/pairs.ts` — BreedingPair data model (BR14.1, BR15.4):
  `BREEDABLE_ARCHETYPES` ({livebearer, scatter, plant}), `validatePairing`
  (UNKNOWN_ENTITY precedence, slot/species/archetype/maturity gates, the
  gravid/cooling lock — re-pairing never resets gestation or cooldown),
  `findPairByFemale` (one live pair per female; pairing a `paired` female
  replaces the bond), `createPair` (paired, readyDay = today),
  `nextPairId` (seeded hex), `dissolveDeadPairs` + `promoteCoolingPairs`
  (silent, return the touched ids).
- `src/cohorts.ts` — FryCohort data model (BR14.3, BR14.4, BR15.2):
  `BreedingParams` + `DEFAULT_BREEDING_PARAMS`
  (clutch [10,30], gestation 7d, hatch 3d, cycle 3d, base rate 0.3) with
  `breedingParamsFor` (per-field validated catalogue extras, defaults
  otherwise — the no-U1-change mechanism), `drawClutch` (seeded uniform),
  `rollFertility` (0.6–0.9), `scaledBroodCount` (mother × condition,
  clamped), `eggClutchCount`, `stuntedAtGrading` (firstFoodDays <
  juvenileDays/2), `makeFryCohort`/`makeEggsCohort` (counters zeroed,
  survival starts at 1). `genomePool` carries `{sire, dam}` genomes plus
  `sireId/damId`, so grading sets Fish.parents even after the pair
  dissolves (BR15.4) — all inside U1's free-form Record slot.
- `src/breeding.ts` — registered `u5.breeding` system (breeding phase,
  W22–W24). Passes are fused for the NFR1.1 budget (age → midnight decay
  → one pair sweep → hatch+cleanup): dissolve/promote/attempt/birth in
  insertion order; condition-scaled attempts with bound gates and no
  punishment on failure; livebearer gestation → seeded scaled brood →
  cooldown; fertile-rolled eggs → timed hatch (decay precedes hatching so
  midnight-hatched eggs never decay the same tick); day-boundary fry
  survival with newborn grace (ideal ≈0.95, neglected ≈0.70); silent
  cleanup. Tank reads hoisted per tick (water read once, one-entry
  per-species cache — breeding never writes water); the hot loop inlines
  the five gate checks allocation-free while `pairGates`/`gateReport` stay
  the tested public form. All randomness through `ctx.rng`.
- `src/commands.ts` — `breeding.pair` (W21: precedence UNKNOWN_ENTITY >
  INVALID_SETTING, no event), `breeding.unpair` (unknown bonds reject,
  gravid progress lost), `breeding.grade` (W25: UNKNOWN_ENTITY (cohort,
  then catalogue) > INVALID_SETTING (eggs/not-ready) > INVALID_QUANTITY
  > TANK_FULL batch formula `bioload + N × (adultSizeCm − 0.05) ≤ volumeL`,
  all-or-nothing; creates N Fish per U3's `spawnFish` + per-fish
  `inheritGenome`, parents `[damId, sireId]`, stunt flag; emits
  `cohortGraded`; remainder stays). Rejections mutate nothing by
  construction. Nursery constant single-sourced from U2
  (`COHORT_LOAD_PER_FRY`).
- `src/selectors.ts` — U5-owned pure readers for U7 panels:
  `pairsInTank`/`cohortsInTank` (MVP-tank scope), `breedingReadiness`
  (gates + condition + per-tick probability; unknown pair → undefined,
  unknown species → tolerant defaults), `gradePreview` (same batch
  formula + stunt outcome, never mutates; unknown cohort/species →
  undefined).
- `src/events.ts` — `breedingStarted {fishIds: [female, male]}`,
  `fryHatched {cohortId, count}`, `cohortGraded {cohortId, count}` (C4
  augmentation; U6 maps all three to info).
- `src/index.ts` — `register` (system + 3 commands) and the full public surface.

## Tests (35, all green)

- `tests/pairs.test.ts` (11) — pairing validation trio (unknown
  precedence, slot/species/archetype/maturity gates), gravid/cooling lock
  vs paired replacement, silent dissolve + cooling promotion, seeded
  clutch range, fertility range, hatchDay/counter construction, stunt predicate.
- `tests/breeding.test.ts` (10) — gate failure (no attempt/penalty/event),
  gate + condition pins, conception (gravid + due date + event), birth
  (scaled brood clamp + cooling), laying (fertility + hatchDay + rest),
  eggs-neither-eat-nor-decay, timed hatch (pair untouched), cooldown block,
  midnight keeps (0.95 ideal / 0.70 neglected / 0.825 unfed / newborn
  grace), silent zero-count/pair cleanup, hourly aging.
- `tests/commands.test.ts` (9) — pair/unpair over the bus (version bump,
  no events, precedence, gravid lock, unknown bonds), grade happy path
  (U3-rule Fish, parents, stunt, remainder, event), readiness/quantity
  rejections, batch TANK_FULL all-or-nothing, lifecycle trio +
  gradePreview purity, panel selectors, preview branch matrix.
- `tests/integration.test.ts` (3) — pair → spawn → hatch → feed (real U4
  `feedFry` over 15 distinct days, expiry-aware restocking) → grade: fed
  cohort unstunted, unfed cohort stunted; hatch XP sighting shape for U6;
  fixed-seed-7 golden replay (deterministic re-run equality + stored
  structural golden: cooling to day 32, brood of 6, all stunted).
- `tests/benchmark.test.ts` (2) — breeding-phase p95 0.04–0.09 ms
  (50-pair/10-cohort advancing-clock fixture, 50 warmup, 300 timed) vs
  the 0.125 ms budget; heap −7.6–0.0 KB/100 ticks (informational).

## Verification

- `npx vitest run packages/u5-breeding` — 5 files, 35 tests, all pass
  (re-run 10+ times under parallel load; worst observed p95 0.12 ms).
- `npx vitest run --coverage packages/u5-breeding` (U5 src) — 98.67%
  lines (floor 80%); breeding/cohorts/pairs/index at 100% lines;
  `events.ts` is type-only. The global-threshold ERROR on a scoped run
  is the whole-repo scope artifact (other units uncovered in that run).
- `npx tsc --noEmit` — clean.
- `npx eslint packages/u5-breeding/src packages/u5-breeding/tests` — clean.
- Not committed, per the dispatch brief.

## Notes / deviations

- Plan Steps 1–13 followed; two additive test files beyond the plan's five
  test files (`tests/integration.test.ts` is plan Step 12;
  `tests/commands.test.ts` carries 9 tests vs 7 planned — the selector
  branch matrix folded in to lift `selectors.ts` to 96.5% lines).
- Fused tick passes (Step 8/11 refactor): 7 sweeps → 4 (age, decay,
  one pair sweep, hatch+cleanup) with hoisted tank reads, a one-entry
  per-species cache, and an allocation-free hot loop — same order
  semantics (newborns skip aging/decay on their birth tick; hatch-tick
  eggs skip decay). p95 ≈ 0.03 ms isolated, ≈ 0.04–0.09 ms under
  parallel load vs the 0.125 ms budget.
- No U1 changes: breeding params resolve from optional catalogue extras
  with validated fallbacks; parent ids ride in `genomePool` alongside
  the genomes.
