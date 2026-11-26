# Functional Design — Questions (u5-breeding)

> Unit U5 owns Breeding behaviour and the FryCohort entity. Implements US5.1 (AC5.1.1, AC5.1.2), US5.2 (AC5.2.1, AC5.2.2), US5.3 (AC5.3.1). Reads Fish/Genome (U3 factories), water/temp (U2), food stock + first-food counters (U4). Grounded in GDD §6.4–6.6 (archetype table, breeding score, gestation/clutch/fertility/hatch, cohorts-until-grading, stunt-not-vanish) and FR5.1–FR5.3 + FR2.2 (sex). Rule groups BR14 (pairing/spawning) + BR15 (cohorts/grading); U6+ continue at BR16.

## Q1. [Model] Pairing initiation

GDD assumes pair bonds; U7 has a breeding screen. Who forms the pair?

A. Player pairs via `breeding.pair { femaleId, maleId }`; U5's system attempts spawning each tick while gates pass (condition-scaled chance, female cooldown)
B. Fully automatic pairing when conditions are right
X. Other (please specify)

[Answer]: A

## Q2. [Model] breedingCondition weights

GDD factors: nutrition, water, temperature fit, light, shelter, live-food bonus, stress, sex ratio. MVP has no light/shelter sim, pairing fixes sex ratio, and feeding history is unreadable post-hoc — live food still matters through quality-scaled satiety.

A. condition = 0.3 nutrition + 0.3 water + 0.25 tempFit + 0.15 calm (1 − stress/100); poor care yields no spawn, never punishment
B. Tune the weights — say how
X. Other (please specify)

[Answer]: A

## Q3. [Data] Clutch and timing numbers

GDD appendix drives these per species (clutch range, gestationDays, cycleDays). The C5 catalogue has no breeding-timing fields yet.

A. Data-driven: U1 adds `clutch: [min, max]`, `gestationDays`, `hatchDays`, `cycleDays` per breeding species; clutchSize scales with mother size × condition inside the range
B. Fixed MVP constants for all species
X. Other (please specify)

[Answer]: A

## Q4. [Model] Fry survival and stunting (FR5.3)

Neglected fry stunt (permanent size penalty) rather than vanish; survival should still bite.

A. Per-tick keep calibrated to ~5% daily loss in ideal water, ~30% when neglected; at grading, firstFoodDays < juvenileDays/2 → stunted (sizeMult × 0.8, permanent, recorded)
B. Tune the numbers — say how
X. Other (please specify)

[Answer]: A

## Q5. [Commands] Grading initiation (AC5.2.2)

Fry become individuals at juvenile age; capacity must be checked (U3 requires `projectedBioload`).

A. Player-initiated `breeding.grade { cohortId }` (TANK_FULL rejects; applies stunting; creates Fish via U3 field rules with parents + inheritGenome); readiness is panel-pull (U7 reads ageDays), no new event
B. Automatic grading at juvenileDays
X. Other (please specify)

[Answer]: A

## Q6. [Model] Eggs representation (AC5.1.2, AC5.2.1)

Scatter/plant layers produce eggs (fertility roll, hatch timer) before fry; livebearers birth free-swimming fry directly.

A. Eggs are a FryCohort stage (`eggs` → `fry` at hatchDay, 60–90% fertility roll at laying, eggs don't eat); no separate Egg entity
B. Separate Egg entity
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
