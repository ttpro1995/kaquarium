# Functional Design — Questions (u2-tank-water)

> Unit U2 owns Tank behaviour and water chemistry over U1's shared `Tank` type (`id`, `tier`, `volumeL`, `water`, `equipment`, `bioload`, `biofilterMaturity`). Implements US1.2 (AC1.2.1, AC1.2.2) and US1.3 (AC1.3.1, AC1.3.2); spans U6 for money deduction (US1.3). Grounded in GDD §6.7 (tiers Mini 20L / Standard 60L / Large 150L; filter cycles over ~10 game-days; water changes reduce waste+nitrate; overcrowding crash warnings) and FR1.2/FR1.3/FR4.1/FR4.2.

## Q1. [Model] Water parameters in the MVP

FR1.2 names waste + nitrate; FR4.2 also names temperature/pH mismatch. The GDD lists oxygen and pH too, but the MVP scope is a simplified cycle.

A. Model waste (0–100) + nitrate (0–100) + temperature (°C) only; pH and oxygen deferred post-MVP
B. Add a simple pH drift (0–14, decorations/conditioner shift it) in the MVP as well
X. Other (please specify)

[Answer]: A

## Q2. [Model] Filter cycling (AC1.2.1)

Per GDD §6.7, a new filter starts at maturity 0 and cycles over ~10 game-days; conversion rate = filter capacity × maturity.

A. ~10 game-days to full maturity; buying/installing a better filter resets `biofilterMaturity` to 0
B. Keep partial maturity on upgrade (e.g. carry over 50%) — kinder, less teachable
X. Other (please specify)

[Answer]: A

## Q3. [Model] Tank capacity rule (overcrowding)

The `commerce.buyFish` example rejects with TANK_FULL at `capacity(state.tank)`, and GDD §6.7 says bioload > capacity crashes the tank with warnings first. U2 defines the `capacity` selector every unit uses.

A. Bioload-based: each fish contributes bioload from adult size × feeding activity; capacity scales with `volumeL`; TANK_FULL when bioload exceeds capacity (recommended — matches the crash model)
B. Head-count slots per tier (simpler, ignores species size)
X. Other (please specify)

[Answer]: A

## Q4. [Commands] Equipment/tier purchase and money (US1.3)

US1.3 spans U2 (the upgrade) and U6 (money). Commands run a single handler atomically between ticks, so the funds check and the deduction must live in one handler.

A. U2 owns `tank.buyEquipment` / `tank.upgradeTier`: handler checks funds + level unlocks, deducts atomically, emits `moneyChanged` (U6's variant, same drain path)
B. Two-step: U7 calls a U6 `commerce.spend` command first, then the U2 command (non-atomic, two failure points)
X. Other (please specify)

[Answer]: A

## Q5. [Commands] Water-change cost (AC1.2.2)

Water changes must cost something or waste is trivially spammable. GDD conditioners are post-MVP consumables.

A. Fee proportional to volume changed (money is the limiter, no cooldown)
B. Free but capped at once per game-day
X. Other (please specify)

[Answer]: A

## Q6. [Data] Species temperature needs + heater behaviour (AC1.3.2)

The species catalogue (C5, U1-owned) has no temperature fields, but AC1.3.2 needs "the species' range" and FR4.2 needs temperature fit. Additive catalogue fields are safe (readers ignore unknowns).

A. Add optional `tempRangeC: [min, max]` per species (U1 data completion); heater installed holds tank at 26°C, otherwise temperature drifts toward ambient 22°C
B. Hardcode one tropical range per archetype in U2 logic, no catalogue change
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
