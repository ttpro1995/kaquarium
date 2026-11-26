# Tech Stack Decisions — u2-tank-water

> Upstream: team Code Style (ESLint, language-idiomatic naming; no formatter configured in this repo), `requirements.md` constraints (TS + Vite; NFR1, NFR5), U1 built source (`packages/u1-sim-foundation/`: TS strict, Vitest, bundled SHA-256). Answers from `nfr-requirements-questions.md` (Q4 A).

| Choice | Decision | Rationale |
|---|---|---|
| Language | TypeScript (strict, same tsconfig as U1) | Shared types with U1 — with one qualified exception: the built `Tank` predates U2 (see Breaking change register below). Until U2 codegen aligns it, U2 codes to `functional-design/entities.md`, not to `types.ts` as built. |
| Test runner | Vitest + `--coverage` 80% line floor, run in CI before merge | Matches U1's verified pipeline; coverage `include` and npm scripts are workspace-wide (`packages/*/src`, `packages/*/tests`) so U2 is covered from its first test — extended in this pass (repo change, verified green). |
| Lint/format | ESLint per repo `eslint.config.js` (CI-blocking); no formatter is configured in this repo yet | Team Code Style names Prettier for TS, but no Prettier dependency or config exists here — U2 follows ESLint + language-idiomatic naming until the team configures one (tracked, not silently assumed). |
| Dependencies | None new — pure logic over U1 types + `ctx.rng` | No serialization, no I/O, no render code in U2. |

## Breaking change register — Tank alignment (input to U2 code-generation, R-01)

U1's built `Tank` (`types.ts` as of the skeleton checkpoint) does not match U2's `entities.md`. One explicit breaking change, executed at U2 codegen before any U2 system is coded:

| Built shape | U2 spec shape | Migration (v1 → v2) |
|---|---|---|
| `water: { waste, temperature, ph }` | `water: { waste, nitrate, tempC }` | `tempC = temperature`; `nitrate = 0` (new cycle starts unconverted); drop `ph` (deferred post-MVP) |
| `equipment: string[]` | `equipment: { filter, heater, autoFeeder, light }` | defaults: filter { level 1, conversionRate 2 }, heater { installed false }, autoFeeder { installed false }, light { level 1 }; starter kit stays free |
| `volumeL: 50` default, no tier link | `volumeL` 20 / 60 / 150 by tier; tier↔volume pairing validated on load | `volumeL = tierVolume(tier)`; pre-tier saves (only tier 1 exists) → 20 |
| no latch fields | `prevQualityBand`, `overcrowdLatch`, `tempPoorLatch` (all required) | derive per NFR4.1 (migration owns it): band from `max(waste, nitrate)` (good initial), overcrowd from `bioload > volumeL`, tempPoor from catalogue `tempFit < 0.5` for any fish |
| no `Fish.stunted` (U5 data completion, U3 NFR4.1) | `Fish.stunted: boolean` required, `false` default | fill `false` for records lacking it — same migration, one owner for all absent-field filling |
| no `state.feeding` section (U4 data completion, U4 NFR4.1) | `GameState.feeding` schedule section with empty program | create empty schedule section (no device, no program — first feed path unaffected) |
| `FoodItem` without `acquiredDay`/`target` (U4 NFR4.1) | `acquiredDay: integer`, `target` fields required | `acquiredDay` = save's game day at migration (conservative: nothing instantly expires); `target` = kind default |
| `FryCohort` without `firstFoodDays`/`lastFryFedDay` (U4/U5 NFR4.1) | counters required, `0` default | fill `0` (never-fed — the stunt test treats the cohort as unfed, the safe direction) |
| no `GameState.pairs` (U5 data completion, U5 NFR4.1) | `pairs: Record<PairId, BreedingPair>` required, `{}` default | create empty record — pre-U5 saves load with no pairs, no phantom pregnancies |
| `MarketState` without `lastTrendDay` (U6 NFR4.1) | `lastTrendDay: integer` required, min 1 | fill with max(1, game day at migration) — game day counts from 1 (`START_DAY`); trend cycle restarts cleanly, no immediate re-roll storm |
| `Order` without `customer/multiplier/minHealth/minSizeCm/deadlineDay` (U6 NFR4.1) | all required | convert, don't discard: `deadline` → `deadlineDay` (fallback game day + 3 when below current day), `minQuality` → `minHealth`, `minSizeCm` from the catalogue market size; defaults only for what has no built equivalent: customer `hobbyist`, multiplier `1.2` |
| `Notification.subjectId` required string (U6 NFR4.1) | optional string | fill absent with `''` (summaries carry no subject) |
| `bioload`, `biofilterMaturity` | unchanged | carried over untouched |

Mechanics: bump C6 `schemaVersion` 1 → 2 with a forward `migrateV1ToV2` pure function + round-trip test (v1 fixture → migrated → equals a fresh v2 save at equal numbers; covers Tank shape, `Fish.stunted`, feeding-state filling, `GameState.pairs` creation, and commerce-state filling); update C1 Tank/FoodItem/FryCohort/GameState/MarketState/Order/Notification rows and C5 if a field meaning changes; keep `Fish.tankId` scan-based capacity untouched. Until codegen executes this register, no U2/U3/U4/U5/U6 code is written against the built shape.

## Performance budget implication

| ID | Requirement | Source | Verification |
|---|---|---|---|
| NFR1.1 | Tick-to-frame mapping and water share. One tick = one game-hour (C2); the composition root caps live ticks at 4 per rendered frame (x4 worst case, recorded in C2 — excess ticks accumulate, never dropped, with backlog surfaced through the loading state), so the water phase costs ≤ 4 ms/frame worst case at 1 ms/tick. Total sim budget is ≤ 8 ms/frame at 50 fps on the Meizu Lucky 08 (12 ms left for PixiJS rendering); other phases' shares land with their NFR passes (U3–U6) and must sum within the remainder. Catch-up (up to 192 ticks) runs behind a loading state, not against the frame budget. Water-phase tick cost: ≤ 1 ms at 100 fish + active cohorts — O(fish + cohorts) scan with cached per-fish terms, no allocation in the bioload loop. | NFR1 | Benchmark scene (100-fish save): 50 warmup ticks, then p95 of 300 timed water-phase ticks ≤ 1.0 ms on a calibrated proxy of the reference device — amended from 5-warmup/median-of-30 at NFR Design R-03 for protocol unity with the U3+ passes and `benchmark.test.ts` (on-device validation at milestones); heap growth < 64 KB over 100 consecutive ticks (allocation check); frame test at x4 asserts ≤ 4 water ticks applied per frame. Extends the existing `benchmark.test.ts` protocol (full-tick p95 ≤ 8 ms device gate) with a water-phase probe at U2 codegen. |

NFR2 (accessibility) has no U2 surface — water state reaches the player through U7's icon+text rendering; marked N/A in traceability.
