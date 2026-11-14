# Unit of Work — Story Map

> Upstream: `stories.md` (US1.1–US12.1), `unit-of-work.md`. Each row names the Unit that implements the story.

| Story | Unit ID | Directory |
|---|---|---|
| US1.1 | U7 | u7-presentation |
| US1.2 | U2 | u2-tank-water |
| US1.3 | U2; U6 | u2-tank-water; u6-commerce |
| US2.1 | U3; U6 | u3-fish; u6-commerce |
| US2.2 | U3 | u3-fish |
| US3.1 | U4 | u4-feeding |
| US3.2 | U4 | u4-feeding |
| US4.1 | U3 | u3-fish |
| US4.2 | U3 | u3-fish |
| US4.3 | U3 | u3-fish |
| US5.1 | U5 | u5-breeding |
| US5.2 | U5 | u5-breeding |
| US5.3 | U5 | u5-breeding |
| US6.1 | U6 | u6-commerce |
| US6.2 | U6 | u6-commerce |
| US6.3 | U6 | u6-commerce |
| US7.1 | U6 | u6-commerce |
| US8.1 | U6 | u6-commerce |
| US9.1 | U1 | u1-sim-foundation |
| US9.2 | U1 | u1-sim-foundation |
| US9.3 | U1 | u1-sim-foundation |
| US10.1 | U1 | u1-sim-foundation |
| US10.2 | U1 | u1-sim-foundation |
| US11.1 | U1; U3; U7 | u1-sim-foundation; u3-fish; u7-presentation |
| US12.1 | U6 | u6-commerce |

## Cross-Cutting Rows

- **US1.1 (living tank)** spans U7 (renderer) and U2 (tank state); U7 is the implementing unit, U2 supplies the state it renders.
- **US1.3 (upgrade tank/equipment)** spans U2 (the upgrade) and U6 (the money deduction); U2 is the implementing unit, U6 owns the money scalar.
- **US2.1 (buy fish)** spans U3 (creates the Fish), U6 (the money deduction), and U7 (the store UI); U3 is the implementing unit, U6 owns the money scalar.
- **US12.1 (notifications)** spans U6 (the queue) and U7 (the bell); U6 is the implementing unit.
- **US11.1 (offline catch-up)** spans U1 (the capped coarse-resolution advance), U3 (neglect protection — no death while away, and the protected critical state), and U7 (the "while you were away" summary); U1 is the implementing unit.

Money-bearing stories (US1.3, US2.1, US6.1, US7.1, US8.1) deduct or credit through the shared-store Economy owned by U6; a story that spends or earns money names U6 alongside its implementing unit.

## Coverage Verification

Every enumerated US row names at least one implementing Unit — a primary unit, plus U6 on money-bearing rows (US1.3, US2.1); every Unit (U1–U7) has at least one row.
