# Unit of Work — Dependency

> Upstream: `unit-of-work.md`. Topology only — this describes what can depend on what; Delivery Planning chooses the economic build order.

## Dependency DAG

- A unit depends on every unit whose code its own code or tests need to build or pass.
- The DAG models **code** dependencies (importing another unit's types or functions), not data flows. Data flows between units are mediated by the shared state store and the fixed tick pipeline, so they do not appear as edges.

Direct edges (11 total):

| Unit | Depends on |
|---|---|
| u1-sim-foundation | — |
| u2-tank-water | u1-sim-foundation |
| u3-fish | u1-sim-foundation |
| u4-feeding | u1-sim-foundation |
| u5-breeding | u1-sim-foundation |
| u6-commerce | u1-sim-foundation |
| u7-presentation | u1-sim-foundation, u2-tank-water, u3-fish, u4-feeding, u5-breeding, u6-commerce |

```yaml
units:
  - name: u1-sim-foundation
    kind: library
    depends_on: []
  - name: u2-tank-water
    kind: library
    depends_on: [u1-sim-foundation]
  - name: u3-fish
    kind: library
    depends_on: [u1-sim-foundation]
  - name: u4-feeding
    kind: library
    depends_on: [u1-sim-foundation]
  - name: u5-breeding
    kind: library
    depends_on: [u1-sim-foundation]
  - name: u6-commerce
    kind: library
    depends_on: [u1-sim-foundation]
  - name: u7-presentation
    kind: ui
    depends_on:
      - u1-sim-foundation
      - u2-tank-water
      - u3-fish
      - u4-feeding
      - u5-breeding
      - u6-commerce
```

## Integration Points

- **U1 is the shared kernel.** All entity TYPES (`GameClock`, `Species`, `Tank`, `Fish`, `FoodItem`, `FryCohort`, `MarketState`, `Order`, `PlayerProgression`, `Notification`) and the typed sim-event union are defined in the U1-owned shared schema. U1 also owns the shared state store, the command bus, the `System` interface and the tick registry — integration elements recorded in `unit-of-work.md` as additions beyond the domain component catalogue. A unit "owns" its entity's domain BEHAVIOUR (the logic), never another unit's type.
- Each sim unit (U2–U6) is a **store system**: a function that reads the shared store, updates it, and returns — it imports types from U1 only, and no sim unit calls another sim unit's code.
- Cross-unit data flows (water → fish health, fish mass → tank bioload, breeding → notifications, market → order rewards) are computed by the fixed tick pipeline, which runs the systems in a fixed order and writes derived values into the shared store. The tick ORDER is runtime orchestration in U1, not a code dependency, so it does not appear in the DAG.
- **Dependency inversion keeps U1 free of U2–U6 imports.** U1 exposes a `System` interface and a tick registry; each sim unit registers its own system with that registry. U1's tick loop invokes only the registry, so U1 never imports U2–U6 and the DAG stays acyclic — a developer must not make U1 import the sim units.
- **The tick order is declared, not implied by registration.** A system registers as `register({ id, phase, run })`, where `phase` is a value from a U1-owned enum. U1 sorts the registry by phase and runs the systems in that order, ties broken by registration order. The canonical order is **feeding → water → fish → breeding → commerce → notify**:
  - feeding runs before water, so uneaten food becomes waste in the same tick;
  - water runs before fish, so health and growth read this tick's chemistry;
  - bioload reads fish mass as it stood at the start of the tick — a deliberate one-tick lag that keeps U2 free of U3's growth logic;
  - breeding, then commerce (costs/prices/orders settle), then notifications report the tick's outcome.
  Because the order comes from declared phases, it is identical for live play, autosave and offline catch-up — the determinism the save format depends on — and it does not depend on the order U7 calls `register()`.
- **U7 is the composition root.** The app entry point lives in U7: it constructs the store from U1's factory, calls each sim unit's `register(registry)` entry point, and mounts the renderer, producing the single monolithic app artifact. That registration wiring is the only reason `u7-presentation` depends on U2–U6 — the edges are composition, not rendering or domain logic; U7's UI still reads the shared store read-only and emits commands through the command bus.
- The UI screens (Food, Breeding, Commerce, Statistics) display state that U4/U5/U6 write into the store, so they need no extra dependency beyond the composition-root edges already present.

## Parallel Development Opportunities

- After U1 lands, the five sim units (U2–U6) are code-independent and may be built in parallel, each in its own copy with U1.
- U7 integrates last: it depends on U1 for the store/registry and on U2–U6 for their `register()` entry points. Its rendering work can start against U1's types before those units land, but the composition root is completed once they do.
- The tick order is declared per system (each declares a `phase` from U1's enum, and U1 orders by it), so it does not serialize the builds.

## Skeleton

The walking-skeleton stance is on. The skeleton slice builds these units:

| Unit | What the skeleton builds | What it leaves for later |
|---|---|---|
| U1 — Simulation Foundation | The full shared kernel: entity types, sim-event union, seeded RNG, the tick loop and system registry, species data, save/load + autosave | Schema migrations, JSON export/import, offline catch-up |
| U2 — Tank & Water | One tank, the simplified nitrogen cycle (bioload, waste, filter) | Equipment upgrades, water-change UI |
| U3 — Fish Lifecycle | One fish's growth, health, death, sex | Genetics/bloodlines |
| U4 — Feeding | Food inventory (one food type) + manual feeding; overfeeding becomes waste | Auto-feeder, quality/shelf-life depth |
| U5 — Breeding | — (not in the skeleton) | The three archetypes, eggs, fry cohorts |
| U6 — Commerce & Progression | The money scalar and buy/sell price deduction only — enough for "buy a fish" to spend money | Market demand, orders, reputation, levels, operating costs, notifications |
| U7 — Rendering & UI | The composition root (store construction, registration of the U2/U3/U4/U6 systems, app mount), `TankRenderer` (tank + fish rendering, minimal procedural sprites), the `UI` HUD/toolbar with a Feed action, a minimal Fish Store screen with a Buy action, and the Fish Info panel — no other U7 screens | Food, Upgrades, Fish Management, Statistics, Customers, Breeding, Save/Load screens |

With the tick pipeline running U2, U3, U4, and U6's money logic, and U7's composition root wiring those systems into one runnable app, the skeleton demo is: open the Fish Store, buy a fish (money decreases), watch it swim in the tank, feed it, and see it grow over game time — the smallest core loop that runs end to end. Delivery Planning confirms the demo and the real integrated check.
