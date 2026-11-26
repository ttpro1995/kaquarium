# Functional Design — Questions (u4-feeding)

> Unit U4 owns FoodItem behaviour: limited-stock inventory with quality and live-food shelf life (US3.1), manual tank-wide feeding plus auto-feeder schedule (US3.2). Writes across the boundary under the C2 exception: Fish.satiety + tank.water.waste; emits `fed` / `overfed` / `foodOut` (C4). U3 reads satiety (growth/health); U2 reads waste; U5 needs fry first-foods; U6 needs the money touchpoint. Grounded in GDD §6.6 (inventory, manual vs auto-feeder equipment, first foods) and FR3.1/FR3.2. Rule groups BR12 (stock) + BR13 (feeding); later units continue at BR14.

## Q1. [Model] MVP food catalogue

FR3.1: every food has quality; live food has a shelf life.

A. Three kinds: staple flakes (quality 0.7, no expiry), premium pellets (0.9, no expiry), live first-food (1.0, 7-day shelf life, flagged for fry)
B. Different line-up — say what
X. Other (please specify)

[Answer]: A

## Q2. [Model] Portion and eaten-vs-uneaten rule (AC3.2.1, AC3.2.2)

How a feeding splits into satiety vs waste must be deterministic and testable.

A. Tank-wide portions: 1 portion restores 25 satiety to one fish; fish eat up to their deficit in roster order; remainder is uneaten → waste (WASTE_PER_PORTION each) + `overfed`
B. Per-fish targeting (U7 picks fish, precise micro control)
X. Other (please specify)

[Answer]: A

## Q3. [Model] Auto-feeder device vs schedule

GDD calls the auto-feeder an equipment purchase; Tank.equipment is U2's type, feeding logic is U4's.

A. U2 sells/installs the `autoFeeder` device (new `tank.buyEquipment` kind + `equipment.autofeeder` unlock); U4 owns the schedule (`feeding.setAutoFeeder { foodId, portions, intervalHours }`) and the dispensing system
B. U4 owns device purchase too
X. Other (please specify)

[Answer]: A

## Q4. [Model] Shelf-life tracking (AC3.1.2)

Expiry needs a date origin. C1's FoodItem cross-boundary fields are id/kind/qty/quality/shelfLifeDays; owning units may add fields.

A. Add `acquiredDay` (game day of purchase) on FoodItem; expired = acquiredDay + shelfLifeDays < today → feed rejects that stack with NOT_AVAILABLE
B. Different tracking — say what
X. Other (please specify)

[Answer]: A

## Q5. [Commands] Fry feeding (U5 coordination)

Fry cohorts (U5) need first foods or stunt (FR5.3). Some unit must turn fry-food stock into cohort feeding.

A. U4 owns `feeding.feedFry { foodId, cohortId, portions }` (fry-food kinds only) and writes the cohort's shared feeding state under a documented C2 exception, mirroring the fish path
B. U5 handles fry feeding entirely (reads/consumes U4 stock itself)
X. Other (please specify)

[Answer]: A

## Q6. [Commands] Food purchase and starting stock

Restocking costs money (GDD money sinks). Same atomicity argument as U2's Q4-A.

A. U4 owns `feeding.buyFood { kind, qty }`: checks funds, deducts atomically, emits `moneyChanged`, adds stock (new stack per purchase, carrying its own acquiredDay); new saves start with 10 staple flakes
B. U6 owns food sales
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
