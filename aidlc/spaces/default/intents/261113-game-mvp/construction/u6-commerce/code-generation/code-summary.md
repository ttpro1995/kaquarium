# Code Summary — u6-commerce

> Unit `u6-commerce` (U6 Commerce & Progression library: pricing/market/
> order/progression data model, commerce + notify systems, buy/sell/bulk/
> fulfil/dismiss commands, notification mapper, selectors, events).
> TDD red-green-refactor throughout (Steps 3–12); Standard volume + mvp
> 80% line floor. Consumes the U2 v2 shape (market/order/progression/
> notification fields) + U2 `projectedBioload` + U3 `spawnFish`/selectors;
> no U1 changes (Fish.value refresh is the ratified C2 cross-entity
> exception; money moves only under the C2 purchase-path exception).

## Files

Created (`packages/u6-commerce/`):

- `package.json` — `@aquarium/u6-commerce`, ESM, depends on
  `@aquarium/u1-sim-foundation` + `@aquarium/u2-tank-water` +
  `@aquarium/u3-fish`. No new runtime dependencies (pure logic over U1
  types + `ctx.rng`).
- `tsconfig.json` — extends the root config, scoped to this package's `src`/`tests`.
- `src/pricing.ts` — BR16.1 eight-factor formula (W27):
  `sizeFactor` (clamp 0.3–1.2; stunting carries through sizeCm),
  `ageFactor` (0.6/1.0/0.7), `colourFactor` (0.8–1.2 from hue sum),
  `rarityFactor` (1 + 0.1 per premium allele), `healthFactor`
  (1.0 ≥ 70, 0.7 below), `geneticsFactor` (0.8 + 0.2 quality),
  `marketFactor` (clamp 0.4–1.5); `formulaPrice` (floor, min 1);
  `SELL_HEALTH_GATE` (40) + `isSellableHealth`; `priceForFish` (full
  formula; undefined on unknown species so callers reject UNKNOWN_ENTITY).
- `src/market.ts` — BR16.3/BR16.4 (W29): `demandFor`/`trendFor` (default
  1/0), `ensureMarketEntry`/`ensureMarketEntries` (lazy seed at demand 1),
  `applySaleSaturation` (×0.97 per fish, bulk sequential), `recoverDemand`
  (+8% of the gap to 1), `rollTrend` (P(−1) 0.25 / 0 / 1, weighted to 0),
  `maybeRollTrends` (3-day cycle).
- `src/orders.ts` — BR17.1–BR17.3 (W30–W32): `CUSTOMER_PARAMS`
  (hobbyist 1–2/40+/1.2, petShop 3–6/50+/1.05, collector 1–2/70+/1.5),
  `customerPool` (collector at L3), `estimateReward` (board display),
  `fulfilReward` (floor Σ × multiplier × rep bonus capped +20%),
  `generateOrder` (uniform over buyable species, deadline today+3..+7),
  `upkeepBoard` (top up to 3, then one 25% roll below 6; single open
  count, no re-filtering), `expireOrders` (rep −2 floor 0, one
  orderExpired each), `pruneBoard` (non-open leave the same boundary).
- `src/progression.ts` — BR18.1/BR18.2 (W33): `SALE_XP_DIVISOR` (5),
  `HATCH_XP` (10), `FULFIL_XP_DIVISOR` (4), `LEVEL_XP` (L2 200, L3 600),
  `MAX_LEVEL` (3), `UNLOCKS` (L2 tier/equipment, L3 tier/equipment/light),
  `xpForSale`/`xpForReward`, `addXp` (grant-then-check cascade, one
  levelUp per level ascending; XP never decreases).
- `src/commerce.ts` — registered `u6.commerce` + `u6.notify` systems
  (commerce/notify phases, W29–W35). Commerce: day-boundary order
  recovery → costs (emits moneyChanged for the deduction; U7 reads the
  balance from state.money) → expiry/prune → hatch-XP + checks → upkeep →
  value-cache refresh; every tick sights hatch events (C4 exception) and
  refreshes the display-only cache (unknown-species entries fall back to
  0, never stale). Hot loop is fully inline (plain-object
  per-species cache, memoized genome factor per Fish via WeakMap —
  genomes are immutable after spawn) for the NFR1.1 budget; the canonical
  `priceForFish` stays the readable form and the suite asserts the tick
  values equal it across a genome sweep. Notify: exactly one warn per
  sick tick (singleton with subjectId, else `fishSickBatch`), then the
  queue cap. `ELECTRICITY_COST` (5/12/25, clamp 0), `refreshFishValues`,
  `fastPriceForFish`, `hatchEventsSeen`, `boardOrders` exported.
- `src/commands.ts` — W26/W28/W31/W35: `commerce.buyFish` (UNKNOWN_ENTITY
  > NOT_AVAILABLE (tier/archetype) > TANK_FULL (projectedBioload) >
  INSUFFICIENT_FUNDS; spawnFish → deduct → trio fishBought + fishSpawned
  + moneyChanged), `commerce.sellFish`/`commerce.sellBulk` (dedupe, strict
  unknown, catalogue-missing species → UNKNOWN_ENTITY without throwing,
  skip sick, empty-eligible FISH_UNSELLABLE; remove/pay/saturate/
  XP per fish + one moneyChanged), `orders.fulfil` (precedence
  UNKNOWN_ENTITY > FISH_UNSELLABLE > INVALID_SETTING incl. past-deadline
  (grace runs to end of deadlineDay, same boundary as midnight expiry);
  premium, no saturation, no fishSold, rep +1, XP reward/4),
  `notifications.dismiss` (UNKNOWN_ENTITY else remove). Rejections mutate nothing by construction.
- `src/notifications.ts` — BR19.2/BR19.3 mapper + cap (W35):
  fishDied → critical; tankOvercrowded/orderExpired/foodOut → warn;
  economy/progress events → info; fishSpawned/fishSick/moneyChanged →
  null (trio collapses to fishBought; notify system owns fishSick);
  `whileYouWereAway` → its single info summary here because U1's
  catch-up pushes that event after the last system run — the drain is the
  only delivery path, so exactly-once still holds by C4.
  `enforceQueueCap` (drop oldest info, then warn; criticals never
  auto-drop, so an all-critical queue may transiently exceed 100).
  `syncNotificationSeq` lifts the mapper id counter above the persisted
  queue at every U6 entry point (both systems, all five commands), so
  post-reload ids never collide; steady-state ticks skip the scan
  (NFR1.1).
- `src/selectors.ts` — `sellPrice`, `bulkPreview` (exact sellBulk mirror:
  sick + unknown skipped, sequential ×0.97 totals equal), `orderRewardPreview`, `buyableSpecies` (tier + egg-layer
  gates), `levelProgress` (xpToNext derived), `notificationQueue`. Pure,
  never mutate.
- `src/events.ts` — U6 SimEvent variants (fishBought, fishSold,
  orderFulfilled, orderExpired, levelUp, canonical moneyChanged shape).
- `src/index.ts` — `register` (commerce + notify systems, five commands,
  single notification mapper); full re-export surface.

## Tests (40)

- `tests/pricing.test.ts` (17): eight-factor bands, floor 1, gate 40,
  demand ×0.97/recovery/3-day trend, board params/deadlines, XP
  sources/thresholds/unlocks, electricity clamp, fulfil rep bonus,
  tick-vs-canonical genome sweep (both fast paths agree; unknown-species
  cache falls back to 0), midnight moneyChanged emission.
- `tests/commerce.test.ts` (10): atomic sell, bulk rules (incl.
  catalogue-missing atomic UNKNOWN_ENTITY), fulfil
  precedence (incl. past-deadline INVALID_SETTING) + expiry + cascade L1→L3,
  mapper table (incl. reload-safe id resync), sick-batch
  collapse, queue cap + dismiss.
- `tests/commands.test.ts` (7): buy trio + four gates, sell
  rejections (incl. catalogue-missing UNKNOWN_ENTITY, never throws),
  bulk atomicity, fulfil mismatch, preview purity + bulkPreview/sellBulk
  mirror (sick skipped, sequential totals equal).
- `tests/integration.test.ts` (2): buy→sell→saturation→fulfil→level-up;
  catch-up away summary.
- `tests/unlocks-crosscheck.test.ts` (2): U2-gated unlock ids ⊆ U6 awards;
  equipmentUpgraded `<kind>:<level>` format.
- `tests/benchmark.test.ts` (2): p95 0.037–0.095 ms ≤ 0.125 ms
  (full board, 100-notification queue); heap 0.00–0.05 KB/100 ticks.

## Verification

- `npx tsc --noEmit` — clean.
- `npx eslint packages/u6-commerce/src packages/u6-commerce/tests` — clean.
- `npx vitest run packages/u6-commerce` — 40 passed.
- `npx vitest run --coverage packages/u6-commerce` — u6-commerce/src
  93.16% lines (floor 80%); benchmark p95 ≤ 0.125 ms with coverage.
- Full `npx vitest run` — 33 files / 229 tests passed (incl. u6-commerce
  probe under parallel contention). Full-coverage run: u6-commerce green;
  the pre-existing u5-breeding probe flakes under full-suite coverage
  contention (0.177 ms; untouched by this unit, landed earlier).

## Deviations

- `whileYouWereAway` maps to info in the mapper rather than null: the
  drain is the only post-catch-up delivery path, so the single summary
  still fires exactly once by C4 (documented in `src/notifications.ts`).
  `fishSpawned` → null stands as specified (buy trio collapses to
  `fishBought`; U5 births ride `cohortGraded`).
