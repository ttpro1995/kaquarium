# NFR Design — Questions (u6-commerce)

> Unit U6 NFR requirements: NFR1.1 (≤ 0.125 ms/tick commerce+notify, frame closes 8 ms), NFR3.1 (ascending-speciesId catalogue order), NFR4.1–NFR4.2 (migration conversion, explicit commerce import bounds), NFR5.1 (TDD/80%/CI). Produces: security-design.md, logical-components.md, traceability.json.

## Q1. [Model] Commerce compute layout (NFR1.1)

Per tick: price-cache refresh over fish (closed-form, display-only), demand/trend reads, day-boundary upkeep only on wrap. `Fish.value` is the only cross-unit write (C2-allowlisted) and never drives state — readers (U7 panels) tolerate one tick of staleness.

A. As stated: single pass, display-only cache, no cross-tick caches kept by U6
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Money integrity + queue bound (NFR4.2)

Money scalar: integer, always ≥ 0; every deduction clamps (midnight costs) or rejects (INSUFFICIENT_FUNDS) — validate-first, deduct-or-reject atomic, one moneyChanged per accepted call. Queue cap 100 (drop oldest info, then warn, criticals may overflow).

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q3. [Model] Test layout (NFR5.1)

Boundary suites: price-factor bands, saturation ×0.97 + recovery, fulfil premium vs market sum, rep floor/cap, level thresholds + cascade, midnight clamp, queue cap + dismiss, migration conversion (deadline/minQuality→health, market size, day-1 floor); golden replay sales→saturation→order cycle; benchmark probes per NFR1.1.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A
