# Units of Work

> Upstream: `components.md` (14 components), `decisions.md` (ADR-001–004), `requirements.md`, `stories.md`. Grouped by domain per the confirmed plan; monolithic deployment, shared state store.
>
> **Ownership convention**: a unit "owns" its entity's domain behaviour (the logic). Every entity TYPE is defined in the U1 shared schema; no unit owns another unit's type. So "U2 owns the Tank entity" means U2 owns the water-chemistry logic over the shared `Tank` type.

| Unit ID | Directory | Name | Kind | Complexity | Deployment |
|---|---|---|---|---|---|
| U1 | u1-sim-foundation | Simulation Foundation | library | S | shared |
| U2 | u2-tank-water | Tank & Water | library | M | shared |
| U3 | u3-fish | Fish Lifecycle | library | M | shared |
| U4 | u4-feeding | Feeding | library | S | shared |
| U5 | u5-breeding | Breeding | library | L | shared |
| U6 | u6-commerce | Commerce & Progression | library | L | shared |
| U7 | u7-presentation | Rendering & UI | ui | XL | shared |

## U1 — Simulation Foundation

- **Components**: Clock, SpeciesCatalog, Persistence — plus the integration spine the other units build against (a deliberate addition beyond the domain component catalogue): the shared state store, the command bus, the typed sim-event union, and the `System` registry / tick loop.
- **Responsibilities**: the shared entity types and sim-event union; the shared state store and command bus; the `System` interface, the tick registry (the fixed 1-game-hour tick and speed controls) and the pipeline phase order (every system declares a `phase` from U1's enum and U1 sorts by it); **offline catch-up** — on return, advance up to 8 game-days at coarse resolution and stop, then hand off the elapsed-span summary; the 30-species data; save/load, schema migrations, autosave, JSON export/import.
- **Boundaries**: owns the clock, the species data, the save schema, the shared kernel (store, command bus, event union, tick registry), the pipeline order, and the catch-up cap. No simulation logic, and it never imports U2–U6 — the sim units register themselves with its registry.
- **Kind**: library (reusable code, no standalone runtime).
- **Implementation notes**: seeded RNG lives here; the save schema is versioned with migrations; the store schema is the single definition of every entity type the other units import; the canonical phase order is feeding → water → fish → breeding → commerce → notify; catch-up runs the same tick pipeline in the same phase order, so its result is identical to playing the elapsed time live up to the 8-game-day cap.

## U2 — Tank & Water

- **Components**: TankEnvironment.
- **Responsibilities**: the tank, equipment, and the simplified nitrogen cycle (bioload, waste, filter, water changes).
- **Boundaries**: owns the Tank entity and water chemistry.
- **Kind**: library.
- **Implementation notes**: a new filter must "cycle" before it is effective.

## U3 — Fish Lifecycle

- **Components**: FishPopulation.
- **Responsibilities**: individual fish — growth, health, death, sex, genetics; **neglect protection during offline catch-up** — while the game is closed, health is floored at the protected critical state and death is suppressed, so no fish dies from neglect while away.
- **Boundaries**: owns the Fish entity and its lifecycle, including the protected-critical-state and death-suppression rule that U1's catch-up advance depends on.
- **Kind**: library.
- **Implementation notes**: growth is a saturating curve; health is 0–100 with a stressor model; the `catchUp` flag on the tick context suppresses lethal health transitions (the fish lands in the protected critical state instead).

## U4 — Feeding

- **Components**: Feeding.
- **Responsibilities**: food inventory (stock, quality, shelf life) and feeding (manual + auto-feeder).
- **Boundaries**: owns the FoodItem entity.
- **Kind**: library.
- **Implementation notes**: overfeeding becomes waste.

## U5 — Breeding

- **Components**: Breeding.
- **Responsibilities**: the three core archetypes (livebearer, scatter, plant), eggs, and fry cohorts.
- **Boundaries**: owns the FryCohort entity.
- **Kind**: library.
- **Implementation notes**: fry are cohorts until grading; first foods are required or fry stunt.

## U6 — Commerce & Progression

- **Components**: Market, Orders, Progression, Economy, Notifications.
- **Responsibilities**: demand saturation and price formula; the order board and reputation; levels 1–3; money and operating costs; the notification queue.
- **Boundaries**: owns MarketState, Order, PlayerProgression, and Notification entities plus the money scalar.
- **Kind**: library.
- **Implementation notes**: money is non-negative; market demand recovers over game days.

## U7 — Rendering & UI

- **Components**: TankRenderer, UI — plus the app composition root (the entry point / bootstrap), an addition beyond the domain component catalogue.
- **Responsibilities**: the living-tank renderer (procedural sprites, steering, particles) and the UI shell (HUD, toolbar, panels, breeding screen, save/load menu, notifications, and the **"while you were away" summary** shown after offline catch-up); **and the app entry point**, which constructs the store from U1's factory, calls each sim unit's `register(registry)` entry point, and mounts the app. U7 therefore produces the single monolithic app artifact that the skeleton's end-to-end check runs.
- **Boundaries**: reads state read-only and emits commands through the command bus; the composition root holds wiring only — it constructs and registers, never applies simulation mutation. It imports U2–U6 solely for their `register(registry)` entry point, never for their domain logic. The sequence of its `register()` calls imposes no simulation order — U1 orders systems by their declared phase.
- **Kind**: ui.
- **Implementation notes**: render state is transient and never serialized; WCAG 2.1 AA applies; the composition root is the one place the sim units are imported, so a unit's `register()` call is added there when the unit lands.
