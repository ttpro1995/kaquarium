# NFR Design — Questions (u5-breeding)

> Unit U5 NFR requirements: NFR1.1 (≤ 0.125 ms/tick, 50-pair/10-cohort fixture), NFR3.1 (passed-rng, stable key order), NFR4.1–NFR4.2 (pairs migration, explicit breeding bounds), NFR5.1 (TDD/80%/CI). Produces: security-design.md, logical-components.md, traceability.json.

## Q1. [Model] Breeding compute layout (NFR1.1)

One pass per tick: pair gate checks (eligibility + condition) then per-cohort decay (day-boundary midnight application). No cross-tick caches kept by U5 (readyDay/birthDay/hatchDay live on the pair/cohort; the cooling→paired promotion reads live state). No per-tick allocation.

A. As stated: single pass over pairs + cohorts in stable key order
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Failure domain and silent cleanup (NFR4.2)

U5's failure domain is the breeding phase: a throw aborts the tick with NO rollback (earlier-phase writes persist un-versioned; recovery = last autosave). Silent cleanup (dissolved pairs, zeroed cohorts) mutates only U5-owned records.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q3. [Model] Test layout (NFR5.1)

Boundary suites: re-pair guard (no cooldown reset), gate matrix (health/satiety/temp/quality), seeded clutch scaling, fertility range, day-boundary decay with newborn grace, grading capacity (nursery-adjusted batch formula), stunt flag, silent cleanup; golden replay pairing → spawn → hatch → grade; benchmark probes per NFR1.1 (50-pair/10-cohort fixture).

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A
