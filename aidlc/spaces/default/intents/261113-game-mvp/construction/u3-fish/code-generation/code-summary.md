# Code Summary — u3-fish

> Unit `u3-fish` (U3 Fish Lifecycle library: fish-phase tick pass in W12
> order, pure spawnFish/inheritGenome factories, selectors, events).
> TDD red-green-refactor throughout; Standard volume + mvp 80% line floor.
> Consumes the migrated v2 Tank shape; depends on the U2 codegen migration
> (landed in tree). No U1 changes; U3 never writes the Tank (BR11.3).

## Files

Created (`packages/u3-fish/`):

- `package.json` — `@aquarium/u3-fish`, ESM, depends on
  `@aquarium/u1-sim-foundation` + `@aquarium/u2-tank-water`. No new runtime
  dependencies (pure logic over U1 types + `ctx.rng` + U2 selectors).
- `tsconfig.json` — extends the root config, scoped to this package's `src`/`tests`.
- `src/factories.ts` — pure `spawnFish(state, species, rng)` (BR11.1: sex
  50/50, size 50–70% of adult, five-locus genome rolled 1 with p = 0.3,
  parents null, value = buyPrice; stable key order; rejects
  catalogue-invalid species as UNKNOWN_ENTITY per BR11.4) and pure
  `inheritGenome(rng, sire, dam)` (W15: per locus one allele from each
  parent, no MVP mutation). Draw order (sex, size, loci in GENOME_LOCI
  order, then id) is contractual so seed plus call order replays exactly.
  `Genome` carries an index signature so it stays assignable to U1's
  `Record<string, unknown>` genome slot. No state writes, no events.
- `src/selectors.ts` — U3-owned pure readers (BR11.3): `healthOf`,
  `healthBand` (sick < 40, critical < 15), `overcrowded`/`crowdFactor`
  (shared bioload > volumeL predicate), `growthCondition` (W12 product
  for U7 tooltips), `alleleSum` (tolerant of partial genomes),
  `sizeMultiplier` (0.95/1.0/1.05), `vigorBonus` (+0/+0.5/+1),
  `genomeQuality` (premium/10), `colourFactor`/`rarityFactor` (U6 price
  inputs; U6 owns the final formula).
- `src/fish.ts` — registered `u3.fish` system (fish phase, W12 steps 2–7):
  age accrual; saturating growth (`rate = 1 − 0.05^(1/(maturityDays·24))`,
  95% at maturityDays under ideal care) scaled by condition × stunting;
  satiety decay 100/48; regen-minus-weighted-stressors health
  (hunger −2 / water −3 / temp −2 / crowding −1, regen only fed-and-clean)
  with the 25×-worst stress display; pure `nextStage`/`neglectCause`/
  `deathCause` transition functions (juvenile→adult at maturityDays,
  adult→senior at 70% lifespanDays; starvation iff hunger else
  waterQuality; exact old age); BR10.7 catch-up floor 10 with neglect
  death skipped while old age proceeds. Reads water via U2 selectors,
  mutates only Fish records, draws no rng.
- `src/events.ts` — `SimEventMap` augmentation (`fishSpawned`,
  `fishDied` with `oldAge | starvation | waterQuality`, `fishMatured`
  with `adult | senior`). `fishSick` stays U2's; temperature deaths map
  to the environmental cause. No mapper (U6 notifies on U3 events).
- `src/index.ts` — `register(registry)` (fish system only; U3 owns no
  commands — asserted by test) plus full re-exports.

Changed outside `packages/u3-fish/`: only `package-lock.json` (workspace
link for the new package, via `npm install`). No U1/U2 source changes.

## Decisions

- `spawnFish` takes `(state, species, rng)` per the functional spec: state
  supplies only `tank.id`; the id itself derives from the rng stream, so
  the factory stays pure (the advancing cursor is BR2.1 entropy, not a
  state mutation — the fields test pins everything-but-cursor identical).
- `growthCondition(state, fish, species?)` takes the resolved species
  entry (optional; unknown species fall back to the tolerant range),
  mirroring U2's `tempFitFor` convention — a selector cannot reach the
  catalogue from `GameState` alone.
- `SpawnedFish extends Fish` with `parents: null | readonly [FishId,
  FishId]` satisfies the entities.md load rule (null store-bought, set by
  U5 at birth) without touching U1's shared type.
- U3 stressors start at tempFit < 0.7 and quality < 40 while U2 episodes
  open at 0.5 / poor-band: decline is visible before any notification,
  by design (W12 §19). Temperature kills map to `waterQuality`.
- Unknown-species fallbacks (adultSize → body size, maturity 90,
  lifespan 365) mirror U2's tolerant reads so foreign fixtures never
  crash the tick.
- `nextStage` advances at most one stage per tick by design (review-01
  Minor): a pre-aged juvenile whose `ageDays` already clears the senior
  line — reachable only via a hand-built or migrated save, since spawn
  sets `ageDays` to 0 and live ticks accrue 1/24 — converges over two
  ticks (`fishMatured { adult }` then `{ senior }`). Safe in live play,
  which can never produce the state; no behaviour change, documented so
  a later U5/U6 reader does not treat the double event as a bug.

## Test report

- `npx vitest run packages/u3-fish` — 5 files, 34 tests, all pass
  (fields 9, tick 11, lifecycle 8, integration 4, benchmark 2). Full repo
  `npx vitest run` — 17 files, 120 tests, all pass (no U1/U2 regressions).
- TDD red phases recorded: fields failed on `Cannot find module
  '../src/factories.js'`; tick failed on missing `@aquarium/u2-tank-water`
  link (resolved by `npm install`) then on missing `../src/fish.js`;
  lifecycle failed on missing `../src/index.js`. One post-green fixture
  fix (cold-death test underestimated fed-and-clean regen) and one golden
  expectation fix (scripted B fish legitimately matures before dying).
- `npx tsc --noEmit` — clean (includes repairing the `Genome` index
  signature and the tolerant `alleleSum` accumulator typing).
- `npx eslint packages/u3-fish/src packages/u3-fish/tests` — clean
  (0 errors, 0 warnings; NFR3.2 bans respected — `ctx.rng` only).
- `npx vitest run --coverage packages/u3-fish` — `u3-fish/src`:
  factories.ts 100% lines, fish.ts 100% lines (85% branch), selectors.ts
  96.3% lines, index.ts 100% (events.ts type-only). Floor 80 met; the
  global-threshold ERROR on unit-scoped runs is the whole-repo gate
  seeing unrun packages at 0% (full-suite coverage is Build and Test's).
- Benchmarks: fish-phase p95 0.1179 ms at 100 fish (budget 0.5 ms);
  retained heap growth −1.08 KB/100 ticks median (bound 64 KB).
