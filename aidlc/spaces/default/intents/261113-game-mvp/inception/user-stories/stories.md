# User Stories

> Upstream: `requirements.md` (FR1–FR12, NFR1–NFR5), `team-practices.md` (TDD). Fine granularity, organized by feature area. All stories are Must Have (the MVP boundary); priorities were confirmed at scope definition.

## Tank & Environment

### US1.1 — See a living tank

As a cozy player, I want the tank to render as a living diorama with swimming fish, a day/night cycle, lighting, and plant sway, so that the game feels alive and worth watching.

- **AC1.1.1** — Given a new save, when I open the game, then the tank renders with visible fish, lighting, and a day/night cycle.
- **AC1.1.2** — Given the tank is displayed, when I leave it idle, then fish keep swimming and the scene stays animated.
- **Priority**: Must Have · **Persona**: P3 (cozy player), P1 (optimizer)

### US1.2 — Manage water quality

As an aquarium hobbyist, I want a simplified nitrogen cycle (bioload, waste, filter, water changes) where a new filter must "cycle" before it is effective, so that husbandry feels real and teachable.

- **AC1.2.1** — Given fish are present and fed, when waste accumulates, then the filter converts it; a mature filter converts faster than a brand-new one.
- **AC1.2.2** — Given high waste, when I perform a water change, then waste and nitrate drop.
- **Priority**: Must Have · **Persona**: P2 (hobbyist)

### US1.3 — Upgrade tank and equipment

As an optimizer, I want to buy and upgrade tank tiers and equipment (filter, heater, light), so that capacity, temperature, and water quality improve and my farm can grow.

- **AC1.3.1** — Given enough money, when I buy a better filter, then the tank's waste-conversion rate increases.
- **AC1.3.2** — Given a tropical species, when the tank has a heater, then the temperature stays in the species' range.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

## Fish Store

### US2.1 — Buy fish

As an optimizer, I want to buy juvenile fish of any of the 30 species from the store, so that I can stock my tank and start the loop.

- **AC2.1.1** — Given the store is open, when I buy a species, then a juvenile of that species appears in the tank and money decreases by the price.
- **AC2.1.2** — Given the store is open, when I browse, then all 30 species are listed.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

### US2.2 — Fish have a sex

As an optimizer, I want purchased fish to have a sex assigned at birth, so that I can plan breeding pairs.

- **AC2.2.1** — Given I buy several fish, when I inspect them, then each shows a sex and the split is roughly 50/50.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

## Feeding & Care

### US3.1 — Manage food stock

As a hobbyist, I want food to be a limited inventory with quality and (for live food) a shelf life, so that running out has real consequences.

- **AC3.1.1** — Given my food stock is depleted, when I try to feed, then the fish cannot be fed and growth/breeding stall.
- **AC3.1.2** — Given live food, when it passes its shelf life, then it is no longer usable.
- **Priority**: Must Have · **Persona**: P2 (hobbyist)

### US3.2 — Feed the fish

As a hobbyist, I want to feed fish manually or via an auto-feeder, so that overfeeding becomes visible waste rather than a hidden penalty.

- **AC3.2.1** — Given I feed the fish, when the food is eaten, then satiety rises.
- **AC3.2.2** — Given I overfeed, when food is uneaten, then it appears on the substrate and raises ammonia.
- **Priority**: Must Have · **Persona**: P2 (hobbyist)

## Growth, Health & Death

### US4.1 — Fish grow

As an optimizer, I want fish to grow on a saturating curve driven by food, water, temperature, and crowding, so that care visibly produces bigger, more valuable fish.

- **AC4.1.1** — Given a well-fed fish in good water, when time passes, then it grows toward adult size faster than a starved fish.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

### US4.2 — Fish have health

As a hobbyist, I want each fish to have a 0–100 health that responds to hunger, water, temperature/pH, and crowding, so that I can read why a fish is suffering.

- **AC4.2.1** — Given poor water, when I inspect a fish, then its health falls and a tooltip names the cause.
- **Priority**: Must Have · **Persona**: P2 (hobbyist)

### US4.3 — Fish can die

As a hobbyist, I want fish to die of starvation or an unsuitable environment with a visible cause, so that losses are learnable rather than random.

- **AC4.3.1** — Given a fish reaches 0 health, when the tick runs, then it dies and the cause is recorded.
- **Priority**: Must Have · **Persona**: P2 (hobbyist)

## Breeding

### US5.1 — Breed the core archetypes

As a hobbyist, I want breeding for the livebearer, scatter, and plant/substrate archetypes, each with its own trigger, so that I can produce the next generation.

- **AC5.1.1** — Given a mature livebearer pair in good conditions, when the cycle runs, then the female becomes gravid and later births a brood.
- **AC5.1.2** — Given a mature egg-layer pair with the right conditions, when the cycle runs, then eggs are laid and hatch.
- **Priority**: Must Have · **Persona**: P2 (hobbyist)

### US5.2 — Eggs and fry cohorts

As an optimizer, I want eggs to hatch into fry tracked as cohorts until they mature into individual fish at grading, so that hundreds of fry stay readable and performant.

- **AC5.2.1** — Given a spawn, when eggs hatch, then a fry cohort appears with a count and age.
- **AC5.2.2** — Given a fry cohort matures, when it reaches juvenile age, then it becomes individual fish I can grade.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

### US5.3 — Fry need first foods

As a hobbyist, I want fry to require first foods or else stunt, so that fry care is a real, learnable mechanic.

- **AC5.3.1** — Given fry are not fed first foods, when they mature, then their adult size is permanently reduced.
- **Priority**: Must Have · **Persona**: P2 (hobbyist)

## Selling & Market

### US6.1 — Sell fish

As an optimizer, I want to sell fish singly or in bulk from the fish panel or roster, so that I can convert fish into money.

- **AC6.1.1** — Given a sellable fish, when I sell it, then it leaves the tank and money increases.
- **AC6.1.2** — Given a bulk selection, when I bulk-sell, then all selected fish are sold together.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

### US6.2 — Price reflects condition

As an optimizer, I want the sale price to follow the price formula (size, age, colour, rarity, health, genetics, market), so that quality care pays off and sick fish are unsellable.

- **AC6.2.1** — Given a healthy adult and a sick juvenile of the same species, when I compare prices, then the healthy adult sells for more.
- **AC6.2.2** — Given a sick fish, when I try to sell it, then it is refused.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

### US6.3 — Market saturation

As an optimizer, I want each sale to lower that species' demand (recovering slowly), so that no single-species spam dominates.

- **AC6.3.1** — Given I sell many guppies in a row, when I check the price, then the guppy price drops with each sale.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

## Orders

### US7.1 — Fulfil orders

As an optimizer, I want a board of 3–6 orders with deadlines and premium rewards, so that orders are the best-margin channel.

- **AC7.1.1** — Given a matching fish, when I fulfil an order, then I earn a reward above the market price and reputation rises.
- **AC7.1.2** — Given an order expires unfulfilled, when its deadline passes, then it is removed with a small reputation cost.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

## Progression

### US8.1 — Level up

As an optimizer, I want XP from sales, breeding, and orders to advance me through levels 1–3, so that progress unlocks species, equipment, and customers.

- **AC8.1.1** — Given enough XP, when I level up, then new species/equipment/customers unlock.
- **AC8.1.2** — Given normal play, when I reach Level 3, then it takes about 2 hours ± 30 minutes.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

## Save & Load

### US9.1 — Autosave

As a cozy player, I want the game to autosave roughly every 30 seconds, so that I never lose meaningful progress.

- **AC9.1.1** — Given I close the game, when I reopen it, then the last autosave is restored.
- **Priority**: Must Have · **Persona**: P3 (cozy player)

### US9.2 — Manual save slots

As an optimizer, I want manual save slots, so that I can branch my strategy and return to a known state.

- **AC9.2.1** — Given I save to a slot, when I load it, then the state matches that save.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

### US9.3 — Export/import backup

As an optimizer, I want to export and import the save as JSON, so that I can back up or move my game.

- **AC9.3.1** — Given I export a save, when I import it, then the game round-trips to the same state.
- **AC9.3.2** — Given a corrupt import, when I import it, then it is rejected without clobbering my current save.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

## Time & Simulation

### US10.1 — Control time

As a cozy player, I want pause and x1/x2/x4 speed controls, so that I can set my own pace.

- **AC10.1.1** — Given the game is running, when I change the speed, then the game clock advances at the chosen rate (or pauses).
- **Priority**: Must Have · **Persona**: P3 (cozy player)

### US10.2 — Deterministic tick

As an optimizer, I want the simulation to advance on a fixed 1-game-hour tick independent of frame rate, so that the game is fair and reproducible.

- **AC10.2.1** — Given a save advanced by N ticks, when I run it at any speed, then it reaches the same state.
- **Priority**: Must Have · **Persona**: P1 (optimizer)

## Offline Catch-up

### US11.1 — While you were away

As a cozy player, I want up to 8 game-days simulated on return with a "while you were away" summary and no neglect deaths, so that stepping away is safe.

- **AC11.1.1** — Given I return after 8 game-days away, when the game catches up, then time stops at the cap and fish are in a protected critical state.
- **Priority**: Must Have · **Persona**: P3 (cozy player)

## Notifications

### US12.1 — Get notified

As a hobbyist, I want a prioritized notification queue for hunger, illness, breeding, hatching, maturity, and deadlines, so that I can act on what matters.

- **AC12.1.1** — Given a sick fish, when the notification fires, then clicking it focuses that fish.
- **Priority**: Must Have · **Persona**: P2 (hobbyist)

## INVEST Notes

Stories are Independent (each maps to one requirement area), Negotiable (details resolve at functional design), Valuable (each has a "so that"), Estimable and Small (each is one behavior), and Testable (Given/When/Then acceptance criteria). The five NFRs (performance, accessibility, determinism, save integrity, testing) are non-functional and are traced to later stages rather than expressed as persona stories.
