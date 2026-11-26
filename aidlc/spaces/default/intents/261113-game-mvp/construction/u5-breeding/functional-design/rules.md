# Rules — u5-breeding

> Upstream: `unit-of-work.md`, `unit-of-work-story-map.md` (US5.1–US5.3 → U5), `stories.md` (AC5.1.1–AC5.3.1), `requirements.md` (FR5.1–FR5.3), `components.md` (Breeding), `contract-summary.md` (C1–C4), U3 design (spawnFish/inheritGenome field rules, projectedBioload), U4 design (feedFry counters). Answers from `functional-design-questions.md` (Q1–Q6, summary `Looks correct`).
> Rule-group convention: U1 BR1–BR7, U2 BR8–BR9, U3 BR10–BR11, U4 BR12–BR13. U5 owns BR14 (pairing/spawning) and BR15 (cohorts/grading); U6 continues at BR16.

```yaml
rules:
  - id: BR14.1
    statement: The player forms pairs; the pair command validates eligibility once, the system enforces conditions every tick.
    category: validation
    applies_to: BreedingPair
    trigger: Dispatch of `breeding.pair { femaleId, maleId }` / `breeding.unpair { pairId }`.
    logic: IF either fish is missing, immature, the wrong sex for its slot, a different species pair, an archetype outside {livebearer, scatter, plant} (catalogue field), or already dead THEN reject UNKNOWN_ENTITY / INVALID_SETTING (sex/species/archetype mismatch); IF the female has a live pair in gravid or cooling state THEN reject INVALID_SETTING (finish or unpair first — re-pairing never resets gestation or cooldown); pairing an already-paired female in paired state replaces the bond; unpair removes it (gravid progress lost); created state paired with readyDay = today (Q1-A).
    violation: A pair with mismatched species or sexes, or an immortal bond after a member dies (system must dissolve), is a bug.
    source: FR5.1

  - id: BR14.2
    statement: Spawning attempts scale with care and never punish poor care beyond no spawn.
    category: calculation
    applies_to: BreedingPair
    trigger: U5's breeding-phase system, every tick, for each paired pair past cooldown.
    logic: IF both members are alive, mature, health ≥ 40, satiety ≥ 30, tempFitFor(state, speciesId) ≥ 0.5, and waterQuality(state) ≥ 40 THEN condition = 0.3 × (satiety/100) + 0.3 × (waterQuality/100) + 0.25 × tempFitFor + 0.15 × (1 − stress/100); per-tick attempt probability = speciesBaseRate × condition / 24; the gate is the binary form of the scaled terms (tempFit ≥ 0.5, quality ≥ 40); IF gates fail THEN no attempt, no penalty, no event (Q2-A).
    violation: A spawn attempt while gates fail, or any care penalty beyond withholding the spawn, is a bug.
    source: FR5.1

  - id: BR14.3
    statement: Livebearers conceive, show gravid, and birth a scaled brood.
    category: policy
    applies_to: BreedingPair
    trigger: Successful attempt on a livebearer pair; birthDay arrival.
    logic: IF attempt succeeds THEN state = gravid, readyDay = today + gestationDays (the gravid due date — one field, readyDay, read by the birth transition), emit breedingStarted { fishIds }; at readyDay create one fry-stage cohort with count = round(clutch0 × (0.5 + motherSize/adultSize × 0.5) × (0.5 + condition × 0.5)) clamped to the catalogue [min, max], where clutch0 = floor(min + ctx.rng × (max − min + 1)) is the seeded uniform draw, motherSize = mother's sizeCm, adultSize = species.adultSizeCm, genomePool = parents, firstFoodDays = 0, lastFryFedDay = 0, emit fryHatched, state = cooling with readyDay = today + cycleDays (Q3-A).
    violation: A gravid pair that never births, or a brood outside the catalogue range, is a bug.
    source: FR5.1

  - id: BR14.4
    statement: Egg-layers lay fertile-rolled eggs that hatch on schedule.
    category: policy
    applies_to: FryCohort
    trigger: Successful attempt on a scatter/plant pair; hatchDay arrival.
    logic: IF attempt succeeds THEN create one eggs-stage cohort with count = round(clutch0 × fertility × (0.5 + condition × 0.5)) where clutch0 is the seeded catalogue draw as in BR14.3 and fertility = 0.6 + ctx.rng × 0.3, hatchDay = today + hatchDays, emit breedingStarted; eggs neither eat nor decay; at hatchDay stage = fry, emit fryHatched; pair enters cooling as in BR14.3 with readyDay = today + cycleDays — incubation and cooldown run independently: if readyDay arrives first the pair returns to paired and may lay again while eggs incubate (clutches overlap, allowed); hatch changes nothing on the pair (Q6-A).
    violation: Eggs that eat, decay, or hatch early, or fertility outside 0.6–0.9, is a bug.
    source: FR5.1

  - id: BR14.5
    statement: Females rest between cycles; cooldowns are data, not constants.
    category: constraint
    applies_to: BreedingPair
    trigger: Birth/hatch completion; every tick.
    logic: IF a spawn completes THEN no new attempts for that female until today ≥ readyDay (readyDay = today + cycleDays); attempts while cooling are skipped silently.
    violation: Back-to-back spawns inside cycleDays is a bug.
    source: FR5.1

  - id: BR15.1
    statement: Fry survival decays deterministically with care; the rate is calibrated, not guessed.
    category: calculation
    applies_to: FryCohort.count
    trigger: U5's system, every tick, for fry-stage cohorts.
    logic: IF stage is fry THEN dailyKeep = 0.70 + 0.25 × (waterQuality(state)/100) × foodOK (U5 breeding phase reads post-U2 water via the U2 selectors) where foodOK = 1 while ageDays < 1 (newborn grace) else 1 when firstFoodDays ≥ floor(ageDays) × 0.5 else 0.5 (ideal ≈ 0.95, neglected ≈ 0.70 for broods ≥ 10 — below 10, integer effects dominate, still deterministic); on the tick where gameHour wraps to 0 (once per game day) count = floor(count × dailyKeep); survivalFactor = dailyKeep for panels; count 0 removes the cohort silently (Q4-A).
    violation: Survival above the calibrated curve, or egg-stage decay, is a bug.
    source: FR5.2

  - id: BR15.2
    statement: Unfed youth stunts permanently instead of vanishing.
    category: policy
    applies_to: Fish
    trigger: Grading (BR15.3).
    logic: IF firstFoodDays < juvenileDays / 2 at grading THEN each created Fish carries stunted = true (adult size × 0.8 via U3's growth factor); ELSE stunted = false; the flag is permanent and recorded (Q4-A, AC5.3.1).
    violation: A stunted fish at full size, or stunt applied without the food test, is a bug.
    source: FR5.3

  - id: BR15.3
    statement: Grading is player-initiated, capacity-checked, and creates individuals by U3's rules.
    category: validation
    applies_to: FryCohort
    trigger: Dispatch of `breeding.grade { cohortId, count }`.
    logic: IF stage is eggs or ageDays < juvenileDays THEN reject INVALID_SETTING (not ready — eggs don't eat, so feedFry rejects them too); IF count < 1 or > cohort.count THEN reject INVALID_QUANTITY; batch check: effectiveLoad = bioload + N × (adultSizeCm − 0.05) must be ≤ volumeL for the N graded fish (only the leaving share of nursery load converts to full adult load; the remainder keeps its 0.05 each — conservative by construction, U3's over-estimate documented); IF breached THEN reject TANK_FULL (all-or-nothing per call); create N Fish (sex 50/50, juvenile 50–70% size, parents set, genome per fish via inheritGenome, stunted per BR15.2); emit cohortGraded { cohortId, count: N }; remainder (count − N) stays a fry cohort with ageDays continuing; empty cohort removed (Q5-A).
    violation: Grading eggs, over-capacity grading, or Fish missing parents/genome, is a bug.
    source: FR5.2

  - id: BR15.4
    statement: Dead references clean themselves; the player is never asked.
    category: policy
    applies_to: BreedingPair
    trigger: U5's system, every tick.
    logic: IF a pair member is missing (sold, died, never existed after load) THEN dissolve the pair silently; IF a cohort count hits 0 THEN remove it silently; neither emits.
    violation: A pair pointing at a missing fish past the tick that removed it is a bug.
    source: FR5.2
```

| ID | Rule | Source |
|---|---|---|
| BR14.1 | Player pairing with validation; gravid/cooling re-pair rejected; archetype-gated | FR5.1, AC5.1.1 |
| BR14.2 | Bound-gate condition-scaled attempts; no spawn without gates, no punishment | FR5.1, AC5.1.1 |
| BR14.3 | Livebearer gestation (readyDay due) → seeded scaled brood → cooldown | FR5.1, AC5.1.1 |
| BR14.4 | Seeded fertile-rolled eggs with timed hatch | FR5.1, AC5.1.2 |
| BR14.5 | cycleDays female cooldown | FR5.1, AC5.1.1 |
| BR15.1 | Day-boundary fry survival with newborn grace | FR5.2, AC5.2.1 |
| BR15.2 | Stunt flag from first-food test at grading | FR5.3, AC5.3.1 |
| BR15.3 | Batch player grading with nursery-adjusted capacity guard | FR5.2, AC5.2.2 |
| BR15.4 | Silent cleanup of dead references | FR5.2, AC5.2.2 |
