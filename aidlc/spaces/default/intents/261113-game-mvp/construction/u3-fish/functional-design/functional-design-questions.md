# Functional Design — Questions (u3-fish)

> Unit U3 owns Fish behaviour over U1's shared `Fish` type (`id`, `speciesId`, `tankId`, `sex`, `stage`, `ageDays`, `sizeCm`, `health`, `satiety`, `stress`, `genome`, `value`, `mature`). Implements US2.1 (AC2.1.1 — U3 creates the Fish, U6 deducts), US2.2 (AC2.2.1), US4.1–US4.3 (AC4.1.1, AC4.2.1, AC4.3.1), and the U3 side of US11.1 (neglect protection). Grounded in GDD §6 (health thresholds 40/15/0, regen-minus-stressors, seniors die of old age, store juveniles at 50–70% maturity with 50/50 sex) and FR2.2/FR4.1–FR4.3. Rule groups BR10 (lifecycle) + BR11 (spawn/buy integration); later units continue at BR12.

## Q1. [Model] Growth calibration (AC4.1.1)

GDD growth multiplier = food quality × water quality × temperature fit × (1 − overcrowding). The per-tick rate still needs a scale.

A. Calibrated per species: under ideal care a juvenile reaches 95% adult size at `maturityDays` (rate derived from species data, no new constants)
B. One fixed global growth rate for all species
X. Other (please specify)

[Answer]: A

## Q2. [Model] Health regen and stressor weights (AC4.2.1)

GDD: ΔH = regen (if fed & clean) − Σ stressors; colour/breeding suffer below 40, death risk below 15, death at 0; C4 death causes are `oldAge | starvation | waterQuality`.

A. Regen +2/tick when fed and clean; stressors hunger −2, poor water −3, temperature mismatch −2, crowding −1; cause recorded from the dominant stressor (cold maps to `waterQuality` only via the fishSick episode cause, death cause stays in the C4 set)
B. Tune the numbers — say how
X. Other (please specify)

[Answer]: A

## Q3. [Model] Satiety pace and starvation (FR4.2, FR4.3)

Satiety 0–100, restored by U4 feeding, decays each tick; at 0 the hunger stressor applies and growth stalls.

A. Decay −100/48 per tick (empty in ~2 days unfed)
B. Slower decay (empty in ~3 days, kinder opening)
X. Other (please specify)

[Answer]: A

## Q4. [Model] Neglect protection while away (US11.1)

Unit-of-work: while `catchUp` is true, health floors at the protected critical state and death is suppressed.

A. Full simulation minus lethal outcomes: ticks run normally, but health never drops below 10 and `fishDied` never emits while `catchUp` is true (fish land in the protected critical state)
B. Freeze health decline entirely while away (kinder, less consistent with live play)
X. Other (please specify)

[Answer]: A

## Q5. [Commands] Buy-flow ownership (US2.1, AC2.1.1)

Buying spans U3 (creates the Fish) and U6 (money). C3 already sketches `commerce.buyFish` in U6.

A. U6 owns `commerce.buyFish` (funds, TANK_FULL via U2's `projectedBioload`, deduct) and calls U3's pure `spawnFish(state, species, rng)` factory to build the juvenile (sex 50/50 via seeded RNG, size 50–70% of adult, genome rolled)
B. U3 owns a `fish.buy` command doing everything including the deduct (mirrors U2's purchase pattern, rewrites the C3 sketch)
X. Other (please specify)

[Answer]: A

## Q6. [Model] Senior stage and old age (FR4.3)

GDD: stage thresholds per species; seniors lose breeding and die of old age (gentle, expected).

A. Senior at 70% of `lifespanDays` (emits `fishMatured { stage: 'senior' }`, infertile, value depreciates); old-age death exactly at `lifespanDays` (deterministic, emits `fishDied { cause: 'oldAge' }`)
B. RNG variance around lifespan (less predictable, harder to test)
X. Other (please specify)

[Answer]: A

## Q7. [Model] MVP genome (FR2.2, U5/U6 coordination)

GDD genomes are allele pairs per locus; the MVP needs something U5 can mix and U6 can price.

A. Minimal genome `{ quality: 0–1, patternSeed: number }`: store-bought rolls quality 0.4–0.8 via seeded RNG; breeding averages parents ± variance (U5 detail); U6 prices `genetics` from quality; patternSeed drives U7 rendering
B. Full multi-locus genome now
X. Other (please specify)

[Answer]: B

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
