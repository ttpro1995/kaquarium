# Rules — u6-commerce

> Upstream: `unit-of-work.md`, `unit-of-work-story-map.md` (US6.1–US8.1, US12.1 → U6; money side of US1.3/US2.1), `stories.md` (AC6.1.1–AC12.1.1), `requirements.md` (FR6.1–FR8.1, FR12.1), `components.md` (Market, Orders, Progression, Economy, Notifications), `contract-summary.md` (C1–C4, amended C2 + C3), U2 design (projectedBioload, tankOvercrowded/fishSick aggregation need, unlock ids), U3 design (spawnFish, genome/colour/rarity selectors, buyFish trio, sick threshold), U5 design (fryHatched XP source). Answers from `functional-design-questions.md` (Q1–Q6, summary `Looks correct`).
> Rule-group convention: U1 BR1–BR7, U2 BR8–BR9, U3 BR10–BR11, U4 BR12–BR13, U5 BR14–BR15. U6 owns BR16 (market/pricing/sales) + BR17 (orders) + BR18 (progression) + BR19 (economy/notifications); U7 continues at BR20.

```yaml
rules:
  - id: BR16.1
    statement: Every sale prices the same eight-factor formula with stated bands.
    category: calculation
    applies_to: Fish.value
    trigger: Any price read (sell preview, fulfil estimate, commerce-tick cache refresh).
    logic: IF priced THEN price = floor(sellBase × sizeF × ageF × colourF × rarityF × healthF × geneticsF × marketF) where sizeF = clamp(sizeCm/adultSizeCm, 0.3, 1.2), ageF = 0.6 juvenile / 1.0 adult / 0.7 senior, colourF = 0.8–1.2 from the hue locus (U3 selector), rarityF = 1 + 0.1 × premium alleles (U3 selector), healthF = 1.0 at health ≥ 70 / 0.7 at 40–69, geneticsF = 0.8 + 0.2 × genomeQuality (U3 selector), marketF = clamp(0.4 + 1.1 × demand + 0.1 × trend, 0.4, 1.5); stunting carries through sizeCm (no separate factor); minimum price 1 (Q1-A).
    violation: A price that ignores a factor, or a healthy adult pricing below an identical sick juvenile, is a bug.
    source: FR6.2

  - id: BR16.2
    statement: Sick fish cannot be sold at any price; bulk skips sick, fulfil rejects on any sick.
    category: validation
    applies_to: Fish
    trigger: Dispatch of `commerce.sellFish` / `commerce.sellBulk` / `orders.fulfil`.
    logic: IF a single-sale fish is missing THEN reject UNKNOWN_ENTITY; IF its health < 40 THEN reject FISH_UNSELLABLE; bulk with an empty list rejects INVALID_QUANTITY; bulk inputs are deduplicated to a set first, then unknown ids reject UNKNOWN_ENTITY (strict — typos never silently pass), sick entries are skipped and the eligible remainder proceeds (empty remainder rejects FISH_UNSELLABLE); fulfil validates the whole call and rejects on the first violation class in precedence UNKNOWN_ENTITY > FISH_UNSELLABLE > INVALID_SETTING (Q1-A, AC6.2.2).
    violation: Money paid for a fish with health < 40 is a bug.
    source: FR6.2

  - id: BR16.3
    statement: Selling removes the fish, pays the formula price, saturates demand, and grants XP — atomically.
    category: validation
    applies_to: Fish
    trigger: Dispatch of `commerce.sellFish { fishId }` / `commerce.sellBulk { fishIds }`.
    logic: IF eligible THEN remove each fish, money += Σ formula prices (fulfil-time demand), demand[species] ×= 0.97 per fish sold (bulk applies sequentially), emit one fishSold per fish + one moneyChanged with the total, XP += Σ floor(price/5); version bumps once; a rejected call changes nothing (Q2-A, Q4-A).
    violation: A sold fish still in the tank, money without removal, or a partial bulk commit is a bug.
    source: FR6.1

  - id: BR16.5
    statement: Buying is one atomic transaction: validate, deduct buyPrice, insert the fish, emit the trio.
    category: validation
    applies_to: Fish
    trigger: Dispatch of `commerce.buyFish { speciesId }` (U6-owned; C3 sketch as amended).
    logic: IF the species is unknown or unlisted THEN reject UNKNOWN_ENTITY; IF tier > level or a scatter/plant archetype at L1 THEN reject NOT_AVAILABLE (BR18.2 gates); IF U2 `projectedBioload(state, adultSizeCm)` breaches capacity THEN reject TANK_FULL (never head-count); IF money < buyPrice THEN reject INSUFFICIENT_FUNDS; ELSE build the juvenile via U3's pure spawnFish, deduct buyPrice, emit fishBought + fishSpawned + moneyChanged (U6 is the authorised emitter of U3's fishSpawned on this path; the mapper collapses the pair into one info notification). The same validate-first, deduct-or-reject atomicity covers the money side of U2's tank.upgradeTier and U4's food purchases (AC1.3.1/AC1.3.2 money side): one moneyChanged per accepted call, INSUFFICIENT_FUNDS leaves the store untouched.
    violation: A fish inserted without deduction, money deducted without insertion, or a partial buy is a bug.
    source: FR2.1
  - id: BR16.4
    statement: Demand recovers daily and trends re-roll on a fixed cycle; there are no event shocks in the MVP.
    category: policy
    applies_to: MarketState
    trigger: U6's commerce-phase system, every tick; day boundary for recovery, 3-day cycle for trends.
    logic: IF the day wraps THEN demand += (1 − demand) × 0.08 for every species; IF today − lastTrendDay ≥ 3 THEN trend = rng-weighted re-roll (−1/0/1, P(0) = 0.5) and lastTrendDay = today; activeEvent stays null (Q2-A).
    violation: Demand that never recovers, or a trend that changes mid-cycle, is a bug.
    source: FR6.3

  - id: BR17.1
    statement: The board stays stocked within 3–6 through a fixed day-boundary rule.
    category: policy
    applies_to: Order
    trigger: U6's commerce-phase system at each day boundary.
    logic: IF open orders < 3 THEN generate up to 3; ELSE IF open < 6 THEN 25% chance (ctx.rng) to add one; species drawn from buyable species (tier ≤ level) via ctx.rng; customer from the level pool (L1 {hobbyist, petShop}, L3 adds collector); qty/health/multiplier by customer (hobbyist 1–2/40+/1.2, petShop 3–6/50+/1.05, collector 1–2/70+/1.5); minSizeCm = species market size; deadlineDay = today + 3 + floor(rng × 5); reward estimate = floor(quantity × sellBase × multiplier) for board display (Q3-A).
    violation: A board with fewer than 3 open orders after a day boundary, or more than 6, is a bug.
    source: FR7.1

  - id: BR17.2
    statement: Fulfilment pays the fulfil-time market value above market and raises reputation.
    category: validation
    applies_to: Order
    trigger: Dispatch of `orders.fulfil { orderId, fishIds }`.
    logic: IF order missing THEN reject UNKNOWN_ENTITY; IF status ≠ open THEN reject INVALID_SETTING; deduplicate fishIds to a set, then check in precedence UNKNOWN_ENTITY (any id unknown) > FISH_UNSELLABLE (any health < 40) > INVALID_SETTING (count ≠ quantity after dedupe, species/health/size mismatch); on any rejection nothing changes; ELSE remove the fish, reward = floor(Σ formula prices at fulfil-time demand × multiplier × (1 + min(reputation,10) × 0.02)), money += reward, order.reward = reward, status = fulfilled, emit orderFulfilled + moneyChanged + per-fish fishSold? No — fulfil emits orderFulfilled + moneyChanged only (fish leave as order stock, not market sales, so no fishSold and no demand saturation); reputation += 1; XP += floor(reward/4) (Q3-A, Q4-A).
    violation: A premium at or below the same fish's market sum, or fulfilment that also saturates demand, is a bug.
    source: FR7.1

  - id: BR17.3
    statement: Deadlines pass silently into a small reputation cost.
    category: policy
    applies_to: Order
    trigger: U6's commerce-phase system at each day boundary.
    logic: IF an open order has today > deadlineDay THEN status = expired, reputation = max(0, reputation − 2), emit orderExpired; expired and fulfilled orders leave the board at the same boundary (Q3-A).
    violation: An expired order still fillable, or reputation below 0, is a bug.
    source: FR7.1

  - id: BR18.1
    statement: XP has three sources and two fixed thresholds.
    category: calculation
    applies_to: PlayerProgression
    trigger: Sale (BR16.3), fryHatched event sighting (U5 path), order fulfil (BR17.2).
    logic: IF a sale pays THEN XP += Σ floor(price/5); IF U5 emits fryHatched with count N THEN XP += 10 (once per event, sighted by the commerce phase under the C4 hatch-XP exception — the sole event-reading XP path; sales and fulfils grant directly in their handlers); IF an order fulfils THEN XP += floor(reward/4); threshold checks run wherever XP is added (command handlers grant-then-check atomically; the commerce phase checks after hatch sightings): levels cascade in one tick — an award jumping from below 200 to above 600 promotes L1 → L3 at once, emitting one levelUp per level gained in ascending order; XP never decreases (Q4-A).
    violation: XP from any other source, or a level that moves without crossing its threshold, is a bug.
    source: FR8.1

  - id: BR18.2
    statement: Levels gate what can be bought and who buys; unlocks accumulate.
    category: constraint
    applies_to: PlayerProgression
    trigger: Dispatch of `commerce.buyFish` / `tank.upgradeTier` (U2 checks money, U6 progression gates); order generation (BR17.1).
    logic: IF a species tier > level THEN buyFish rejects NOT_AVAILABLE; IF archetype is scatter/plant and level < 2 THEN buyFish rejects NOT_AVAILABLE (egg-layers need L2+); on level-up append the level's unlock ids (L2 {tier.2, equipment.filter2, equipment.heater, equipment.autofeeder}, L3 {tier.3, equipment.filter3, equipment.light2, equipment.light3}) and open the customer pool (collector at L3); unlocks never removed (Q4-A).
    violation: A tier-3 species bought at L1, or an egg-layer breeding at L1, is a bug.
    source: FR8.1

  - id: BR19.1
    statement: The tank costs money every midnight, but never drives debt.
    category: policy
    applies_to: GameState.money
    trigger: U6's commerce-phase system at each day boundary.
    logic: IF the day wraps THEN cost = tier electricity (5/12/25 for tiers 1/2/3), money = max(0, money − cost); a shortfall is ignored — no debt, no shutoff, no event in the MVP (Q5-A).
    violation: Negative money after midnight, or a shutoff/enforcement path, is a bug.
    source: FR6.1

  - id: BR19.2
    statement: The notify system owns all fishSick notifications; the mapper never emits for fishSick.
    category: policy
    applies_to: Notification
    trigger: C4 drain (mapper) and U6's notify-phase system.
    logic: Mapper table — fishDied → critical; tankOvercrowded / orderExpired / foodOut → warn; waterChanged / equipmentUpgraded / fishSpawned / fishMatured / breedingStarted / fryHatched / cohortGraded / fishBought / fishSold / orderFulfilled / levelUp → info; fishSpawned / fishSick / moneyChanged / whileYouWereAway → null (no mapper notification). fishSpawned is null because its only emission is the buy trio, which collapses to the fishBought info (BR16.5/W26), and U5 grading births are already covered by the cohortGraded info — so the promised single notification holds for the pure per-event mapper with no batch reading. fishSick aggregation lives entirely in U6's notify-phase system, which runs before the drain and appends directly to state.notifications: exactly one warn per tick that carried sick events — a singleton naming the fish (subjectId = fishId, click-to-focus per AC12.1.1) when one fired, a `fishSickBatch` summary with the count when several did — so a 100-fish band flip yields one notification and double-append is impossible by construction (the mapper has no fishSick branch to fire). whileYouWereAway is likewise notified once by the notify system (Q6-A, U2 R-07 input closed).
    violation: A mapper-emitted fishSick notification, or N notifications for one tick's sick burst, is a bug.
    source: FR12.1

  - id: BR19.3
    statement: The queue is bounded and player-dismissable.
    category: constraint
    applies_to: Notification
    trigger: Any notification append; dispatch of `notifications.dismiss { notificationId }`.
    logic: IF appending past 100 THEN drop the oldest info first; IF no info THEN the oldest warn; critical is never auto-dropped, so a queue already holding 100 criticals may transiently exceed 100 — overflow holds criticals only; dismiss removes by id (UNKNOWN_ENTITY when missing) and never touches anything else (Q6-A).
    violation: A dropped critical, a queue over 100 while any droppable (info/warn) entry remains, or a dismiss that mutates non-notification state, is a bug.
    source: FR12.1
```

| ID | Rule | Source |
|---|---|---|
| BR16.1 | Eight-factor price formula with stated bands, floor 1 | FR6.2, AC6.2.1 |
| BR16.2 | Sick (health < 40) unsellable; bulk skips sick, fulfil rejects all; dedupe + precedence | FR6.2, AC6.2.2 |
| BR16.3 | Atomic sell: remove, pay, saturate ×0.97, XP sale/5, trio events | FR6.1, AC6.1.1, AC6.1.2 |
| BR16.4 | Daily +8% recovery, 3-day trend cycle, no events | FR6.3, AC6.3.1 |
| BR16.5 | Atomic buy: validate, deduct buyPrice, insert, trio; shared purchase atomicity | FR2.1, AC2.1.1, AC1.3.1, AC1.3.2 |
| BR17.1 | Day-boundary board top-up with customer params | FR7.1, AC7.1.1 |
| BR17.2 | Fulfil-time premium reward, rep +1, XP reward/4, no saturation | FR7.1, AC7.1.1 |
| BR17.3 | Expiry → rep −2 floor 0, leaves board | FR7.1, AC7.1.2 |
| BR18.1 | XP sale/5 + hatch 10 + reward/4; L2 200, L3 600 | FR8.1, AC8.1.1 |
| BR18.2 | Tier + egg-layer gates; accumulating equipment/customer unlocks | FR8.1, AC8.1.1 |
| BR19.1 | Midnight tier electricity 5/12/25, clamp at 0 | FR6.1 |
| BR19.2 | Notify system owns fishSick (singleton/batch); mapper table for the rest | FR12.1, AC12.1.1 |
| BR19.3 | Queue cap 100 (info → warn; criticals may overflow) + dismiss | FR12.1, AC12.1.1 |
