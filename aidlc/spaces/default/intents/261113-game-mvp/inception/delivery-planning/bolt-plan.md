# Bolt Plan

> Upstream: `requirements.md` (FR1–FR12, NFR1–NFR5), `stories.md` (US1.1–US12.1), `mockups.md`, `components.md` (14 components), `unit-of-work.md` (U1–U7), `unit-of-work-dependency.md` (11-edge DAG), `unit-of-work-story-map.md`, `contract-summary.md` (C1–C6), `team-practices.md` (TDD, 80% coverage, feature branches into `main`, skeleton on). Answers from `delivery-planning-questions.md` (Q1–Q10, summary confirmation `Looks correct`).

A **Bolt**, one build pass over a piece of the work ending in something that runs, is the planned Construction delivery slice from this stage. A **Batch** is the group of Units that build concurrently at runtime (from `unit-of-work-dependency.md`). A **walking skeleton** (Cockburn), the smallest working end-to-end slice through the relevant integration points, is Bolt 1's headless kernel proof plus the rendered care-loop demo once the presentation unit lands (Q5-A split).

Construction runs **stage-major + swarm** (Q10-B): each Construction stage runs across the bundled Units together where the DAG permits, rather than one Unit at a time. Way of Working: feature branches into `main`, review before merge; TDD with 80% line-coverage floor, CI before merge.

## Bolt order (6 Bolts, Q6 confirmed, Q9 resolves Q2)

### Bolt 1 — Kernel (skeleton marker, headless)

- **Units:** U1 `u1-sim-foundation` in full: entity types, sim-event union, seeded RNG, tick loop, system registry (`Registry`, `System`, `Phase`, `TickContext`), 30-species data, save/load + autosave (3 rotating slots). Migrations, JSON export/import and offline catch-up arrive in Bolt 6.
- **Walking skeleton:** yes — first half of the split skeleton. Proves the kernel end to end headlessly (Q5-A).
- **Definition of Done:** store boots from factory; `register()` + fixed 1-game-hour tick runs feeding → water → fish → breeding → commerce → notify in phase order regardless of registration order; commands dispatch between ticks with `CommandOutcome` rejections leaving state untouched; version bumps once per tick/command; autosave round-trips; TDD suite green, coverage ≥ 80%.
- **Confidence hypothesis:** "The shared kernel (store, tick, command bus, event buffer + single drain) supports all five sim units without U1 importing any of them."
- **Expected demo:** headless script: boot → dispatch `commerce.buyFish` → advance N ticks → save → reload → identical state; plus 100-fish tick-time benchmark as the early performance leading indicator (NFR1 sim side).

### Bolt 2 — Care loop (core playable sim, headless)

- **Units:** U2 `u2-tank-water` (tank, nitrogen cycle: bioload/waste/filter/water changes) + U3 `u3-fish` (growth/health/death/sex core) + U4 `u4-feeding` (one food type + manual feeding; overfeeding → waste) + U6 `u6-commerce` money logic only (money scalar, buy/sell deduction).
- **Definition of Done:** buy a juvenile → money decreases; feed → growth advances on saturating curve; overfeed → waste rises; poor water → health drops; starvation → death with named cause; sick fish unsellable; all via command bus + tick pipeline; TDD green, coverage ≥ 80%.
- **Confidence hypothesis:** "The core loop (buy → feed → grow → sell) balances and the tick order feeding → water → fish → commerce produces observable cause-effect in one tick."
- **Expected demo:** headless scenario: buy 5 fish, feed 10 ticks, overfeed 3 ticks, check waste/health/money trajectories; covers FR1.2, FR2, FR3.1 (core), FR4, FR6.1/FR6.2 (core), FR10.

### Bolt 3 — Care-loop depth

- **Units:** U2 equipment upgrades (filter/heater/light, filter cycling) + U3 growth/health/death depth (temperature/pH fit, crowding, stressors) + U4 food stock/quality/shelf-life + auto-feeder schedule.
- **Definition of Done:** filter upgrade increases conversion rate; new filter ineffective until cycled; auto-feeder feeds on schedule; food stock depletes and blocks growth/breeding when empty; TDD green, coverage ≥ 80%.
- **Confidence hypothesis:** "Depth systems (upgrades, auto-feeder, quality/shelf-life) add management texture without breaking the Bolt 2 loop or determinism (seed + command sequence replays)."
- **Expected demo:** headless scenario: upgrade filter, run auto-feeder 20 ticks, exhaust food stock, verify growth stall; covers FR1.3, FR3.

### Bolt 4 — Breeding

- **Units:** U5 `u5-breeding` (livebearer / scatter / plant archetypes, eggs, fry cohorts, first-food + stunting) + U3 cohort-to-fish maturation handoff (grading cohorts into `Fish` records).
- **Definition of Done:** each of the 3 archetypes produces a cohort under good conditions; fry hatch, require first food, stunt (permanent size penalty) when neglected rather than vanish; cohorts grade into individuals; TDD green, coverage ≥ 80%.
- **Confidence hypothesis:** "Three archetypes run through one cohort pipeline with the U3 maturation handoff without special-casing per species."
- **Expected demo:** headless scenario: one pair per archetype → spawn → hatch → grade; neglected cohort stunts; covers FR5.

### Bolt 5 — Commerce depth + main UI

- **Units:** U6 market demand/saturation, order board (3–6, deadlines, premium rewards, expiry + reputation cost), reputation, levels 1–3, operating costs, notification queue + mapper; U7 `u7-presentation` composition root (store construction, `register()` wiring, app mount), `TankRenderer` (procedural sprites, day/night, bubbles, plants), HUD/toolbar, Fish Store, Fish Info, Food, Upgrades, Fish Management, Statistics, Customers, Breeding screens.
- **Walking skeleton:** yes — second half of the split. First rendered demo of the full core loop (Q5-A).
- **Definition of Done:** saturation drops price on repeat sales and recovers over game days; order fulfil pays premium; XP → Level 3 unlocks species/equipment/customers; notification bell jumps to subject; living diorama renders with day/night; buy → swim → feed → grow playable in browser; WCAG 2.1 AA (icon+text, keyboard/touch parity, reduced motion); 100-fish save ≥ 50 fps on Meizu Lucky 08 (NFR1 full proof); TDD green, coverage ≥ 80%.
- **Confidence hypothesis:** "The game is playable and sellable in the browser: economy balances to Level 3 in ~2 h and rendering holds the frame budget."
- **Expected demo:** rendered demo: open store → buy fish → watch swim → feed → grow; market chip shows saturation; order fulfilled at premium; level-up unlocks; covers FR1.1, FR2, FR4 (UI), FR6.3, FR7, FR8, FR12, NFR1, NFR2.

### Bolt 6 — Persistence + interface finish

- **Units:** U1 schema migrations, JSON export/import, offline catch-up (up to 8 game-days coarse, protected critical state, `whileYouWereAway` summary); U7 Save/Load menu (gear overlay: save now, load, autosave indicator, export/import), "while you were away" summary view.
- **Definition of Done:** manual named slots + 3 autoslots list/load/delete; export round-trips; corrupt import rejected with named `SaveErrorCode` leaving current save intact; checksum + `STALE_SAVE` rollback check; offline 8-day return shows summary and no neglect deaths; TDD green, coverage ≥ 80%.
- **Confidence hypothesis:** "Saves survive updates (forward migrations), corruption, and an 8-day absence."
- **Expected demo:** export → import same state; corrupt file rejected cleanly; close 8 game-days → reopen to summary; covers FR9, FR11.

## Sequencing vs DAG

Respects `unit-of-work-dependency.md`: U1 first; U2–U6 code-independent after U1 (parallel under swarm); U7 composition root last (split across Bolts 5–6 for review size). Tick-order coupling (feeding → water → fish → breeding → commerce → notify) is runtime orchestration, not a build dependency, and does not serialize the builds.
