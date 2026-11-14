# Requirements

> Upstream: `intent-statement.md` (core fantasy, MVP boundary, success metrics), `scope-document.md` (core loop, in/out scope), `team-practices.md` (TDD, 80% coverage, WCAG-driven style). Grounded in the confirmed answers in `requirements-analysis-questions.md`.

## Intent Analysis

The user wants to build the MVP of a browser-based aquarium breeding/management tycoon. The goal is a playable core loop — buy fish, feed and care for them, grow and breed them, sell them, reinvest — that validates the concept before further investment. Success is measured by reaching Level 3 in 2 hours ± 30 minutes with no crashes, no single-species strategy beating a mixed one by more than ~25%, and a 100-fish save running at ≥ 50 fps on a Meizu Lucky 08.

## Functional Requirements

### FR1 — Tank & environment

- **FR1.1** — The game presents one tank as a living diorama: fish swim continuously, with a day/night cycle, lighting, bubbles, and plant sway. *(Pass: a new save opens on a rendered tank with visible day/night lighting.)*
- **FR1.2** — The tank runs a simplified nitrogen cycle: fish bioload and uneaten food produce waste; the filter converts waste; water changes reduce it; a new filter must "cycle" before it is effective. *(Pass: overfeeding raises waste, a mature filter lowers it.)*
- **FR1.3** — Tank tiers and equipment (filter, heater, light) can be purchased and upgraded, and affect capacity, temperature, and water quality. *(Pass: upgrading a filter increases its conversion rate.)*

### FR2 — Fish store

- **FR2.1** — The player can buy juvenile fish of all 30 species, data-complete with procedural art, from the store. *(Pass: every one of the 30 species is purchasable.)*
- **FR2.2** — Purchased fish have a sex assigned at birth (50/50). *(Pass: a batch of purchases shows both sexes.)*

### FR3 — Feeding & care

- **FR3.1** — Food is a limited-stock inventory item; each unit has quality and, for live food, a shelf life. *(Pass: running out of food stops growth and breeding.)*
- **FR3.2** — The player can feed fish manually (precise portions) or via an auto-feeder with a fixed schedule. *(Pass: an uneaten portion becomes visible waste that raises ammonia.)*

### FR4 — Growth, health & death

- **FR4.1** — Fish grow on a saturating curve toward adult size, driven by food quality, water quality, temperature fit, and crowding. *(Pass: a well-fed fish grows faster than a starved one.)*
- **FR4.2** — Each fish has a 0–100 health that rises when fed and clean, and falls with hunger, poor water, temperature/pH mismatch, or crowding. *(Pass: health drops below 40 with sustained poor water.)*
- **FR4.3** — Fish die of starvation or an unsuitable environment (health reaches 0); losses are explained with a visible "why". *(Pass: a fish with no food for long enough dies with a named cause.)*

### FR5 — Breeding

- **FR5.1** — Breeding works for three archetypes: livebearer, scatter spawner, and plant/substrate depositor, each with its own trigger (gestation vs. eggs). *(Pass: a livebearer pair with good conditions produces a brood.)*
- **FR5.2** — Eggs hatch and fry are tracked as cohorts (count + age + shared state) until they mature into individual fish at grading. *(Pass: a spawn produces a fry cohort that matures.)*
- **FR5.3** — Fry need first foods; neglected fry stunt (a permanent size penalty) rather than vanish. *(Pass: fry without first food grow to a smaller adult size.)*

### FR6 — Selling & market

- **FR6.1** — The player can sell fish singly or in bulk, from the fish panel or the management roster. *(Pass: selling one fish and selling a bulk selection both work.)*
- **FR6.2** — Sale price follows the price formula (base × size × age × colour × rarity × health × genetics × market), with sick fish unsellable. *(Pass: a healthy adult sells for more than a sick juvenile.)*
- **FR6.3** — Each sale lowers that species' market demand (saturation), which recovers slowly over game days. *(Pass: selling many guppies in a row drops the guppy price.)*

### FR7 — Orders

- **FR7.1** — A board shows 3–6 active orders, each with a deadline, minimum size/quality, and a reward above market; unfulfilled orders expire with a small reputation cost. *(Pass: fulfilling an order pays a premium over market price.)*

### FR8 — Progression

- **FR8.1** — XP from sales, breeding, and completed orders advances the player through levels 1–3, each unlocking species, equipment, and customers. *(Pass: a player reaches Level 3 in ~2 hours of normal play.)*

### FR9 — Save & load

- **FR9.1** — The game autosaves roughly every 30 seconds and on key events. *(Pass: closing and reopening restores the last autosave.)*
- **FR9.2** — Manual save slots are available. *(Pass: a player can save to a named slot and load it back.)*
- **FR9.3** — Saves can be exported/imported as JSON for backup; a corrupt import is rejected without clobbering the current save. *(Pass: an exported save round-trips back to the same state.)*

### FR10 — Time & simulation

- **FR10.1** — The game runs with pause and x1/x2/x4 speeds. *(Pass: each speed advances the game clock at the stated rate.)*
- **FR10.2** — The simulation advances on a fixed 1-game-hour tick, independent of frame rate. *(Pass: a save advanced by N ticks produces the same state regardless of speed.)*

### FR11 — Offline catch-up

- **FR11.1** — On return after being closed, the game simulates up to 8 game-days at coarse resolution and shows a "while you were away" summary; fish cannot die from neglect while away. *(Pass: after 8 game-days away, time stops and fish are in a protected critical state.)*

### FR12 — Notifications

- **FR12.1** — A prioritized notification queue surfaces hunger, illness, breeding, hatching, maturity, and order deadlines; each jumps to the relevant fish or tank. *(Pass: a sick fish raises a notification that focuses that fish.)*

## Non-Functional Requirements

- **NFR1 (Performance)** — A 100-fish save runs at ≥ 50 fps on a Meizu Lucky 08 (the reference mid-range phone). *(Pass: the benchmark scene meets the frame target.)*
- **NFR2 (Accessibility)** — The UI meets WCAG 2.1 AA: colour-blind-safe indicators (icon + text, never colour alone), keyboard and touch parity, and a reduced-motion option. *(Pass: every function works by keyboard; status is never conveyed by colour alone.)*
- **NFR3 (Determinism)** — The simulation uses a single seeded RNG; the same seed and command sequence reproduce the same state. *(Pass: a replay test with a fixed seed matches a golden state.)*
- **NFR4 (Save integrity)** — Saves use a versioned schema with migrations; a corrupt or unknown version is detected, never silently loaded. *(Pass: each schema version round-trips through its migration.)*
- **NFR5 (Testing)** — Development is test-first (TDD); the MVP keeps an 80% line-coverage floor and tests run in CI before merge. *(Pass: the coverage report meets 80% and CI blocks a merge that fails tests.)*

## Constraints

- Browser-only (HTML5), desktop and mobile; offline-first PWA; no backend.
- Stack: PixiJS v8 + Svelte 5 + TypeScript + Vite.
- Currency is an abstract unit ($FISH); the MVP is English-only.
- Solo developer; no hard budget or deadline.

## Assumptions

- "Mid-range phone" means a Meizu Lucky 08 (confirmed).
- The 30 species ship data-complete; the three breeding archetypes (livebearer, scatter, plant/substrate) are implemented first, with the remaining archetypes data-flagged for later. *(Assumption: the store sells all 30 species while only three archetypes breed in the MVP.)*

## Out of Scope

- Advanced genetics and bloodlines.
- Remaining breeding archetypes (cave, bubble-nester, annual, hard-breed).
- Disease and medicine.
- Full aquascaping and decoration effects.
- Multi-tank farm.

## Open Questions

- The concrete formatter/linter tooling is unresolved until the stack is pinned (the affirmed Code Style practice is "defer to the language standard").
