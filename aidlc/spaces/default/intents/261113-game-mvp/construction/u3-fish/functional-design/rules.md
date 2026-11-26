# Rules — u3-fish

> Upstream: `unit-of-work.md`, `unit-of-work-story-map.md` (US2.1, US2.2, US4.1–US4.3 → U3; US11.1 neglect protection), `stories.md` (AC2.1.1, AC2.2.1, AC4.1.1, AC4.2.1, AC4.3.1), `requirements.md` (FR2.2, FR4.1–FR4.3), `components.md` (FishPopulation), `contract-summary.md` (C1–C4, amended C2 exception + C3 projectedBioload), U2 design (waterQuality, tempFitFor, episode causes). Answers from `functional-design-questions.md` (Q1–Q7, summary `Looks correct`).
> Rule-group convention: U1 owns BR1–BR7, U2 owns BR8–BR9. U3 owns BR10 (lifecycle) and BR11 (spawn/integration); later units continue at BR12.

```yaml
rules:
  - id: BR10.1
    statement: Fish grow on a saturating curve toward adult size, calibrated per species and scaled by care.
    category: calculation
    applies_to: Fish.sizeCm
    trigger: U3's fish system runs in its phase (after water, before breeding).
    logic: IF the tick runs THEN sizeCm += (adultSize × sizeMult × (stunted ? 0.8 : 1) − sizeCm) × rate × condition, where rate = 1 − 0.05^(1/(maturityDays × 24)) so ideal care reaches 95% at maturityDays, sizeMult = 0.95/1.0/1.05 from the size locus, and condition = (satiety/100) × (waterQuality/100) × tempFitFor × crowdFactor (crowdFactor 0.5 when overcrowded else 1); IF satiety is 0 THEN condition is 0 and growth stalls (Q1-A).
    violation: Growth above adultSize × sizeMult, or growth while starving, is a bug.
    source: FR4.1

  - id: BR10.2
    statement: Satiety decays steadily and only feeding restores it.
    category: calculation
    applies_to: Fish.satiety
    trigger: Every fish tick; U4 feeding writes.
    logic: IF the tick runs THEN satiety = max(0, satiety − 100/48) (empty in ~2 days unfed); IF U4 feeds THEN it sets satiety per its own portion rules — the only writer besides this decay (BR11.3, Q3-A).
    violation: Satiety outside 0–100, or a non-U4 writer changing it, is a bug.
    source: FR4.2

  - id: BR10.3
    statement: Health is regen minus stressors with named thresholds; stress mirrors the worst active stressor for display.
    category: calculation
    applies_to: Fish.health
    trigger: Same fish tick, after BR10.1–BR10.2.
    logic: IF satiety ≥ 30 AND waterQuality ≥ 60 THEN regen = 2 + vigor ELSE regen = 0; stressors: hunger (satiety < 30) −2, poor water (quality < 40) −3, temperature (tempFit < 0.7) −2, crowding (overcrowded) −1; health = clamp(health + regen − Σactive, 0, 100); stress = 25 × largest active magnitude else 0; below 40 the fish reads sick (U6 unsellable line, U5 breeding gate), below 15 critical (Q2-A).
    violation: Regen while starving or in poor water, or a stressor weight outside this table, is a bug.
    source: FR4.2

  - id: BR10.4
    statement: Death at zero health removes the fish with a recorded C4 cause from the dominant stressor.
    category: policy
    applies_to: Fish
    trigger: Health reaches 0 (and catchUp is false — see BR10.7).
    logic: IF health is 0 THEN remove the Fish AND emit fishDied with cause starvation when the hunger stressor is active, else waterQuality (poor water, temperature, crowding are all environmental); IF health is above 0 THEN nothing dies (Q2-A).
    violation: A death with no cause, a surviving 0-health fish, or a cause outside the C4 set is a bug.
    source: FR4.3

  - id: BR10.5
    statement: Stage follows age deterministically with maturation events.
    category: policy
    applies_to: Fish.stage
    trigger: Same fish tick (ageDays += 1/24 per tick).
    logic: IF ageDays reaches maturityDays THEN stage = adult, mature = true, emit fishMatured { stage: 'adult' }; IF ageDays reaches 70% of lifespanDays THEN stage = senior, emit fishMatured { stage: 'senior' } (seniors are infertile for U5 and depreciate for U6).
    violation: A skipped stage, a mature juvenile, or a fertile senior is a bug.
    source: FR4.1

  - id: BR10.6
    statement: Old age ends every fish exactly on schedule.
    category: policy
    applies_to: Fish
    trigger: ageDays reaches lifespanDays.
    logic: IF ageDays ≥ lifespanDays THEN remove the Fish AND emit fishDied { cause: 'oldAge' } — deterministic, no RNG (Q6-A).
    violation: A fish older than its lifespanDays, or an oldAge death with another cause, is a bug.
    source: FR4.3

  - id: BR10.7
    statement: While the game catches up after absence, fish never die of neglect — but old age still takes them.
    category: policy
    applies_to: Fish.health
    trigger: ctx.catchUp is true (U1's capped offline advance).
    logic: IF catchUp THEN run the tick normally AND clamp health to a floor of 10 AND skip health-driven death removals AND never emit fishDied for starvation or waterQuality; ageDays at or past lifespanDays removals still proceed AND count into whileYouWereAway diedOfOldAge with no per-event notify; returning neglected fish land in the protected critical state for the player to rescue (Q4-A, GDD neglect-only protection).
    violation: A neglect death, a starvation/waterQuality fishDied, or health below 10 produced while catchUp is true is a bug; so is skipping an due old-age removal.
    source: FR11.1

  - id: BR11.1
    statement: U3's pure spawnFish factory builds a store-bought juvenile deterministically from seed plus call order.
    category: validation
    applies_to: Fish
    trigger: U6's commerce.buyFish handler calls it (BR11.2); U5 never calls it (births go through cohorts).
    logic: IF called THEN sex = 50/50 via rng AND sizeCm = adultSize × (0.5 + rng × 0.2) AND ageDays = 0 AND stage = juvenile AND health = 100 AND satiety = 80 AND genome alleles rolled 1 with p = 0.3 each AND parents = null AND value = species.buyPrice (U6 refreshes after); the factory mutates nothing and emits nothing — the caller appends events (Q5-A, Q7-B).
    violation: A spawned fish with an out-of-range field, or a factory that writes state or emits, is a bug.
    source: FR2.1, FR2.2

  - id: BR11.2
    statement: Buying is U6's atomic command over U3's factory, guarded by the bioload capacity check.
    category: validation
    applies_to: Fish
    trigger: Dispatch of `commerce.buyFish { speciesId }` (U6-owned; C3 sketch as amended).
    logic: IF U2 projectedBioload(state, adultSizeCm) > capacity THEN reject TANK_FULL AND change nothing; ELSE U6 checks funds, deducts, calls spawnFish, emits fishBought + fishSpawned + moneyChanged { delta, balance }, and the bus bumps version once (Q5-A).
    violation: A bought fish that skipped the capacity check, or a buy that emits without deducting, is a bug.
    source: FR2.1

  - id: BR11.3
    statement: U3's integration surface is selectors and pure factories out, two documented writes in; U3 never writes another unit's entities.
    category: policy
    applies_to: Fish
    trigger: U2/U4/U5/U6/U7 reads; U4/U6 writes.
    logic: IF another unit needs fish THEN it reads U3 selectors (fishById, fishInTank, healthOf, growthCondition, genomeQuality) or calls the pure factories (spawnFish for U6, inheritGenome for U5: per locus one allele from each parent via rng); IF U4 feeds THEN it may write Fish.satiety — a named C2 exception alongside the waste write; IF U6's commerce system ticks THEN it refreshes Fish.value from the price formula — a named C2 exception, allowlisted now (U6's design covers formula and cadence only); IF any other cross-unit write occurs THEN that is a bug.
    violation: An undocumented write to Fish from outside U3's system or the two named paths is a bug.
    source: FR4.2

  - id: BR11.4
    statement: The sale listing is exactly the valid catalogue, so browsing and spawning can never disagree.
    category: validation
    applies_to: Fish
    trigger: U7 renders the store; any spawn call.
    logic: IF a species entry passes U1 validation THEN it is listed with its buy price; IF an entry is excluded in production THEN it is not offered AND spawnFish (and hence buyFish) rejects it as UNKNOWN_ENTITY.
    violation: A listed species that cannot be spawned, or a spawned species that was not listed, is a bug.
    source: FR2.1
```

| ID | Rule | Source |
|---|---|---|
| BR10.1 | Saturating growth calibrated to maturityDays, scaled by care | FR4.1, AC4.1.1 |
| BR10.2 | Satiety decays over ~2 days; only feeding restores | FR4.2 |
| BR10.3 | Regen +2+fed/clean; weighted stressors; sick below 40 | FR4.2, AC4.2.1 |
| BR10.4 | Death at 0 with dominant-stressor cause | FR4.3, AC4.3.1 |
| BR10.5 | juvenile→adult→senior on age with events | FR4.1 |
| BR10.6 | Old-age death exactly at lifespanDays | FR4.3, AC4.3.1 |
| BR10.7 | catchUp: neglect floor 10, no neglect death; old age proceeds | FR11.1, AC11.1.1 |
| BR11.1 | Pure spawnFish factory (sex/size/genome/parents/value) | FR2.1, FR2.2; AC2.1.1/AC2.2.1 |
| BR11.2 | U6 buy flow over the factory with TANK_FULL guard | FR2.1, AC2.1.1 |
| BR11.3 | Selectors + factories out; satiety/value writes in | FR4.2 |
| BR11.4 | Sale listing equals the valid catalogue | FR2.2, AC2.1.2 |
