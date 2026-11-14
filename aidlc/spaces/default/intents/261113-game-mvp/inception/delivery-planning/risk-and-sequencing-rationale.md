# Risk and Sequencing Rationale

> Upstream: `requirements.md` (FR1–FR12, NFR1–NFR5), `stories.md`, `mockups.md`, `components.md`, `unit-of-work.md`, `unit-of-work-dependency.md`, `unit-of-work-story-map.md`, `contract-summary.md` (C1–C6, open per-unit catalogues), `team-practices.md`. Answers: Q1-A skeleton-then-risk-first, Q4-B WSJF, Q5-A split skeleton, Q6/Q9 six-Bolt breakdown, Q8-A performance worry, Q10-B swarm.

**WSJF** (Reinertsen / SAFe), Weighted Shortest Job First, ranks work by score = (user-business value + time criticality + risk-reduction value) ÷ job size; highest first. The **walking skeleton** (Cockburn), the smallest working end-to-end slice through the relevant integration points, goes first regardless of score. A **Bolt**, one build pass over a piece of the work ending in something that runs, is the scored item below.

## Heuristic

SAFe WSJF with risk weighted first (Q1-A + Q4-B read together): score = (value + urgency + 2 × risk-reduction) ÷ size. Risk carries double weight so the thing most likely to change our minds about the design ships earliest. Plain judgement was rejected as too vague for a 7-unit plan; pure risk-only was rejected because value (playable loop) still matters for checkpoint motivation.

## Scores (relative, 1–10 scales; size in Bolt-weeks for a solo + AI build)

| Bolt | Value | Urgency | Risk-reduction (×2) | Size | Score | Rank |
|---|---|---|---|---|---|---|
| Bolt 1 — Kernel (U1) | 6 | 9 | 9 (×2=18) | 2 | (6+9+18)/2 = 16.5 | 1 (skeleton + top score) |
| Bolt 2 — Care loop (U2,U3,U4,U6-money) | 10 | 8 | 8 (×2=16) | 3 | (10+8+16)/3 ≈ 11.3 | 2 |
| Bolt 4 — Breeding (U5+U3 handoff) | 7 | 5 | 8 (×2=16) | 2 | (7+5+16)/2 = 14.0 | 3 by risk (before commerce) |
| Bolt 3 — Care-loop depth | 6 | 4 | 4 (×2=8) | 2 | (6+4+8)/2 = 9.0 | 4 |
| Bolt 5 — Commerce depth + main UI | 9 | 7 | 7 (×2=14) | 4 | (9+7+14)/4 = 7.5 | 5 (large but unavoidable; U7 last per DAG) |
| Bolt 6 — Persistence finish | 5 | 6 | 6 (×2=12) | 2 | (5+6+12)/2 = 11.5 | 6 (score high but DAG/UI-last forces late; migrations need the full schema) |

Bolt 6 scores high but cannot move earlier: migrations and catch-up need the full entity set, and the Save/Load menu needs U7. Bolt 4 outranks Bolt 3 on risk (three-archetype cohort pipeline + U3 maturation handoff is the least-proven design) even though Bolt 3 is smaller — the explicit risk-first call.

## Why this order

- **Skeleton first (Q1-A, Q5-A):** Bolt 1 proves the kernel headlessly (boot, tick, command bus, save/reload) so every later Bolt builds on a verified spine. The rendered buy/feed/grow demo waits for Bolt 5's composition root — the honest consequence of U7 depending on all sim units.
- **Risk first after the skeleton (Q1-A, Q8-A):** performance (100 fish ≥ 50 fps, Meizu Lucky 08) is the top worry. Early mitigation: Bolt 1 headless 100-fish tick benchmark (sim-side frame budget), Bolt 2 cause-effect tuning (waste/health trajectories that drive entity counts), Bolt 5 full NFR1 proof on device. Render-side proof cannot precede U7, so the plan buys down what it can early (tick cost, sprite budget, object-pooling design in contracts C1/C4) and schedules the device check at the first rendered Bolt.
- **Breeding before polish:** Bolt 4's archetype × cohort × maturation interaction is the second-biggest design risk (open C3/C4 per-unit catalogues finalize there); it precedes Bolt 3's comfort depth so a pipeline rethink does not discard polish.
- **DAG respected:** U1 → (U2–U6 parallel) → U7; no topological violation; tick phase order is runtime, not build order.

## Residual risks (carried into Construction)

- Contract Design approved carrying R-09–R-15 (registration exhaustiveness, writer list, version-bump/drain order, `SaveLoadApi` semantics, fish↔tank membership, bootstrap factory, `speed`/`paused` + `seed` duplicates) — each unit's Functional Design must close its items.
- Balance (Level 3 in ~2 h, no dominant single-species strategy > ~25%) is tuned in Bolt 5 with live economy data, not modelled earlier.
- Scope creep (Q8-D second worry): MVP boundary (one tank, 3 archetypes, levels 1–3) enforced at each Bolt gate.
