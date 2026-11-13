# Intent Backlog (Proto-Units)

> Upstream: `intent-statement.md` (MVP boundary), `scope-document.md` (in/out scope).

## Prioritized Proto-Units

MoSCoW. Every MVP capability is Must Have; deferred items are Won't Have this time.

| ID | Proto-Unit (capability) | Priority | Depends on |
|---|---|---|---|
| PU-01 | Tank & environment (one tank, water, day/night) | Must Have | — |
| PU-02 | Fish store (data-driven species; buy juveniles) | Must Have | PU-01 |
| PU-03 | Feeding & care (food, satiety) | Must Have | PU-02 |
| PU-04 | Growth, health & death | Must Have | PU-03 |
| PU-05 | Breeding (livebearer, scatter, plant/substrate; eggs, fry cohorts) | Must Have | PU-04 |
| PU-06 | Selling & market (price formula, saturation) | Must Have | PU-04 |
| PU-07 | Orders (3–6 simple) | Must Have | PU-06 |
| PU-08 | Progression (levels 1–3) | Must Have | PU-05, PU-06 |
| PU-09 | Save/load + autosave | Must Have | (cross-cutting) |

## Won't Have (this time)

- Advanced genetics & bloodlines
- Remaining breeding archetypes (cave, bubble-nester, annual, hard-breed)
- Disease & medicine
- Full aquascaping
- Multi-tank farm

## Sequencing

Value-first: build the core loop end-to-end first (PU-01 → PU-02 → PU-03 → PU-04 → PU-06 — the buy → feed → grow → sell → reinvest slice), then layer breeding (PU-05), orders (PU-07), and progression (PU-08). Rendering performance is validated alongside the core loop, per the feasibility assessment.
