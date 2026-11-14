# Architecture Decision Records

> Upstream: `components.md`, `requirements.md`. Durable decisions for the domain decomposition.

## ADR-001: Fine-grained 14-component decomposition

- **Context** — The MVP is a simulation game with many distinct, independently-tuned systems (water, growth, breeding, market, orders, progression). The confirmed decomposition choice (Q1) was one component per simulation system.
- **Decision** — Decompose the domain into 14 components: 12 simulation components (Clock, SpeciesCatalog, FishPopulation, TankEnvironment, Feeding, Breeding, Market, Orders, Progression, Economy, Persistence, Notifications) plus 2 presentation components (TankRenderer, UI).
- **Consequences** — (+) Each system owns one concern, so balancing and testing are isolated; (+) components map directly to the architecture doc's system list. (−) More boundaries to keep coherent; the tick pipeline must be orchestrated carefully.
- **Alternatives Rejected** — A coarse grouping (e.g. merging fish+breeding+feeding into one "Livestock" component) would simplify the graph but couple biology, genetics, and inventory, making each balance change riskier.

## ADR-002: Economy is a separate component

- **Context** — Money is touched by the store, sales, orders, and daily operating costs; the confirmed choice (Q2) was a separate Economy component.
- **Decision** — Money and operating costs live in a dedicated Economy component; Market and Orders produce revenue, TankEnvironment scales costs.
- **Consequences** — (+) Non-negative money is enforced in one place; (+) cost/revenue balancing is centralized. (−) Economy is a small component with no entities of its own (it owns the money scalar).
- **Alternatives Rejected** — Folding money into Market would conflate "demand" with "balance"; folding it into Progression would couple cash to unlocks.

## ADR-003: Renderer and UI are domain components

- **Context** — The default domain catalogue covers the simulation core only; the confirmed choice (Q3) was to include rendering and UI.
- **Decision** — TankRenderer and UI are recorded as components, both read-only over the simulation, with no entities (their state is transient render state or derived UI state).
- **Consequences** — (+) The full system is visible in one catalogue; (+) the read-only boundary is explicit. (−) Two components without entities sit alongside entity-owning components, which the Rationale table explains.
- **Alternatives Rejected** — Excluding them keeps the catalogue to pure domain logic but hides the two layers the "tank worth watching" and accessibility pillars depend on.

## ADR-004: Fry are cohorts owned by Breeding, not individual Fish

- **Context** — Hundreds of fry would burden the simulation and renderer; the "every fish matters" pillar only needs individuality once a fish is sellable or breedable.
- **Decision** — Fry are tracked as FryCohort entities owned by Breeding (count + sampled genome pool + shared age) until they mature into individual Fish owned by FishPopulation at grading.
- **Consequences** — (+) Sim and render cost are bounded; (+) individuality is restored at exactly the moment it matters. (−) Two representations of "fish" (cohort vs individual) must be reconciled at the grading boundary.
- **Alternatives Rejected** — Modeling every fry as an individual Fish would honor "every fish matters" literally but blow up the 100-fish/5000-fish performance budget (NFR1).
