# Rules — u2-tank-water

> Upstream: `unit-of-work.md`, `unit-of-work-story-map.md` (US1.2, US1.3 → U2), `stories.md` (AC1.2.1–AC1.3.2), `requirements.md` (FR1.2, FR1.3, FR4.1, FR4.2), `components.md` (TankEnvironment), `contract-summary.md` (C1–C4, C6). Answers from `functional-design-questions.md` (Q1–Q6, summary `Looks correct`).
> Rule-group convention: U1 owns BR1–BR7 (kernel). U2 owns BR8 (water cycle) and BR9 (equipment/tier commerce); later units continue at BR10 so group numbers never collide.

```yaml
rules:
  - id: BR8.1
    statement: Every water tick adds waste from fish bioload and feeding, so a fed tank always drifts dirty without filtration.
    category: calculation
    applies_to: Tank.water.waste
    trigger: U2's water system runs in its phase (after feeding, before fish).
    logic: IF the water phase runs THEN waste += bioload × WASTE_RATE (bioload is the recomputed cache) AND feeding deposits already added by U4 count in full; IF nothing removes waste THEN waste climbs toward 100.
    violation: Waste that falls without a filter, water change, or migration is a bug.
    source: FR1.2

  - id: BR8.2
    statement: The filter converts waste into nitrate at capacity × maturity, so a mature filter cleans faster than a brand-new one at the same level.
    category: calculation
    applies_to: Tank.water
    trigger: Same water tick, after BR8.1.
    logic: IF maturity is m and level capacity is c THEN converted = min(waste, c × m); waste -= converted AND nitrate = min(100, nitrate + converted × NITRATE_RATIO) with NITRATE_RATIO = 0.5; IF m is higher THEN converted is higher at equal c (AC1.2.1).
    violation: Conversion above c × m, or nitrate falling without a water change, is a bug.
    source: FR1.2

  - id: BR8.3
    statement: A new or replaced filter cycles over about 10 game-days; maturity only rises, never jumps.
    category: policy
    applies_to: Tank.biofilterMaturity
    trigger: Every water tick while maturity < 1; filter purchase (BR9.1).
    logic: IF the filter level changed this tick THEN maturity = 0; ELSE maturity = min(1, maturity + 1/240); IF maturity is 0 THEN conversion is 0 (a new filter does nothing yet).
    violation: Maturity above 1, below 0, or preserved across a filter-level change is a bug.
    source: FR1.2

  - id: BR8.4
    statement: A water change dilutes waste and nitrate for a volume-proportional fee, within a 10–50% portion.
    category: validation
    applies_to: Tank.water
    trigger: Dispatch of `tank.waterChange { portionPct }` (Q5-A).
    logic: IF portionPct is outside 10–50 THEN reject INVALID_QUANTITY; IF money < fee THEN reject INSUFFICIENT_FUNDS (fee = ceil(volumeL × portionPct/100 / 2) $FISH); ELSE waste ×= (1 − p) AND nitrate ×= (1 − p) AND deduct the fee AND emit waterChanged + moneyChanged.
    violation: A water change that alters stock without deducting, or dilutes outside the portion, is a bug.
    source: FR1.2

  - id: BR8.5
    statement: Temperature drifts toward ambient without a heater and holds warm with one; species fit comes from the catalogue range with a stated falloff.
    category: calculation
    applies_to: Tank.water.tempC
    trigger: Every water tick.
    logic: IF heater installed THEN target = 26 ELSE target = 22 (ambient); tempC += (target − tempC) × 0.2, clamped 10–35; fit is 1 inside tempRangeC (or inside 20–28 when absent) and 1 − 0.1 × degrees-outside otherwise, floored at 0; IF any fish in tank has fit < 0.5 while tempPoorLatch is false THEN emit fishSick { cause: 'temperature' } for those fish and set the latch; IF all fish fit ≥ 0.5 or the tank is empty THEN clear the latch (Q6-A).
    violation: A heater that leaves tropical water cold, or tempC outside 10–35, is a bug.
    source: FR1.3

  - id: BR8.6
    statement: Capacity is bioload against volume; overcrowding warns before it crashes, and buying past capacity is refused.
    category: constraint
    applies_to: Tank
    trigger: Every water tick (recompute + bands + latches); any stocking command (U6 buyFish, U5 cohort graduation); `tank.upgradeTier`.
    logic: IF tick THEN bioload = Σ fish adultSizeCm × activity + Σ cohorts count × 0.05 AND capacity = volumeL AND waste accumulates at 2× while overcrowded; IF bioload newly exceeds capacity (overcrowdLatch false) THEN emit tankOvercrowded once and set the latch; IF bioload falls back within capacity THEN clear the latch; IF band newly poor THEN emit fishSick cause waterQuality per fish, THEN set prevQualityBand to the current band every tick; late arrivals into a poor band or open episode emit nothing; stocking past capacity refuses TANK_FULL via projectedBioload (bioload + adultSizeCm × 1.0 default activity), which U6 and all later stocking paths must call (Q3-A).
    violation: A sale or stocking that breaches capacity, a crash with no prior warning event, or a head-count TANK_FULL check is a bug.
    source: FR1.3

  - id: BR9.1
    statement: Equipment purchase checks funds and level unlocks, then deducts atomically in the same handler.
    category: validation
    applies_to: Tank.equipment
    trigger: Dispatch of `tank.buyEquipment { kind, level }` (Q4-A).
    logic: IF kind/level unknown THEN reject UNKNOWN_ENTITY; IF the matching unlock id (e.g. `equipment.filter2`) is absent from progression.unlocks THEN reject NOT_AVAILABLE; IF money < price THEN reject INSUFFICIENT_FUNDS; ELSE install, deduct, emit equipmentUpgraded + moneyChanged, bump version once; IF kind is filter AND level changed THEN maturity = 0 (BR8.3).
    violation: A rejection that mutates, deducts without installing, or emits without draining is a bug.
    source: FR1.3

  - id: BR9.2
    statement: Tier upgrade moves the tank to a bigger volume, carrying equipment over and keeping a still-valid filter mature.
    category: validation
    applies_to: Tank.tier
    trigger: Dispatch of `tank.upgradeTier { tier }`.
    logic: IF tier ≤ current THEN reject INVALID_QUANTITY; IF `tier.N` unlock absent THEN reject NOT_AVAILABLE; IF money < price THEN reject INSUFFICIENT_FUNDS; ELSE set tier + volumeL (20/60/150), keep equipment and maturity, emit tierUpgraded + moneyChanged (Q4-A).
    violation: A tier change that alters volumeL without the tier, or keeps the old volume, is a bug.
    source: FR1.3

  - id: BR9.3
    statement: U2's integration surface is selectors out and one documented waste write in; U2 never writes another unit's entities.
    category: policy
    applies_to: Tank
    trigger: U3/U4/U6/U7 reads; U4 feeding writes.
    logic: IF another unit needs water THEN it reads the U2 selectors (tankWater, waterQuality, capacity, tempFitFor) and never the raw fields directly for decisions; IF U4 feeds (feed command or auto-feeder system) THEN it may add waste to tank.water.waste as the feeding transaction (the single named exception to C2's system-ownership sentence, allowlisted in C2); IF any other unit writes Tank THEN that is a bug.
    violation: An undocumented write to Tank from outside U2's systems/commands or the U4 feeding path is a bug.
    source: FR1.2
```

| ID | Rule | Source |
|---|---|---|
| BR8.1 | Waste accumulates from bioload + feeding every water tick | FR1.2 |
| BR8.2 | Filter converts waste → nitrate at capacity × maturity | FR1.2, AC1.2.1 |
| BR8.3 | New filter cycles ~10 game-days; replacement resets to 0 | FR1.2, AC1.2.1 |
| BR8.4 | Water change dilutes 10–50% for a volume fee | FR1.2, AC1.2.2 |
| BR8.5 | Heater holds 26°C, ambient drifts to 22°C; catalogue ranges drive fit | FR1.3, AC1.3.2 |
| BR8.6 | Bioload-vs-volume capacity; warn-then-crash; TANK_FULL on breach | FR1.3 |
| BR9.1 | Equipment purchase: funds + unlocks, atomic deduct | FR1.3, AC1.3.1 |
| BR9.2 | Tier upgrade carries equipment, keeps valid maturity | FR1.3 |
| BR9.3 | Selectors out; only U4 feeding may write waste in | FR1.2 |
