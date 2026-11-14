# Team Allocation

> Upstream: `unit-of-work.md` (U1–U7), `unit-of-work-dependency.md`, `requirements.md`, `stories.md`, `mockups.md`, `components.md`, `contract-summary.md`, `team-practices.md`. Ideation team-formation (stage 1.5) was SKIP for `mvp`, so there are no pre-formed teams to reference.

A **Bolt**, one build pass over a piece of the work ending in something that runs, is assigned below to the **mob**, the group planned to build that Bolt (here a single AI agent since the team is solo + AI). When more than one team exists this file is the **Program Board** analog, the cross-team view of who builds what when; with one builder it is a simple assignment table.

## Assignment (solo + AI)

Team-formation did not run (`mvp` scope skips it), so every Bolt plans **aidlc-developer-agent (AI)** as builder, per the stage rule for skipped 1.5. The human is reviewer/approver at each checkpoint (summary confirmation on, guard policy off, learnings on).

| Bolt | Units | Builder |
|---|---|---|
| Bolt 1 — Kernel | U1 | aidlc-developer-agent (AI) |
| Bolt 2 — Care loop | U2, U3, U4, U6-money | aidlc-developer-agent (AI) |
| Bolt 3 — Care-loop depth | U2, U3, U4 depth | aidlc-developer-agent (AI) |
| Bolt 4 — Breeding | U5 + U3 handoff | aidlc-developer-agent (AI) |
| Bolt 5 — Commerce depth + main UI | U6 depth, U7 main | aidlc-developer-agent (AI) |
| Bolt 6 — Persistence + interface finish | U1 finish, U7 finish | aidlc-developer-agent (AI) |

## Why one builder works

- **No code contention:** after U1, U2–U6 import U1 types only and never each other's code (`unit-of-work-dependency.md`), so swarm parallel builds do not collide; U7's composition-root edges are wiring only.
- **No handoffs:** single bundle, offline-first PWA (PixiJS v8 + Svelte 5 + TypeScript + Vite); `external-dependency-map.md` records zero external blockers.
- **Review model:** feature branches into `main`, review before merge; staging on merge, manual production approval (`team-practices.md` Way of Working + Deployment).
