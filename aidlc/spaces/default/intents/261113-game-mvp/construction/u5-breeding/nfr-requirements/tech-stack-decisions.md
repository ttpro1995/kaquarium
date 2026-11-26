# Tech Stack Decisions — u5-breeding

> Upstream: team Code Style (ESLint, language-idiomatic naming; no formatter configured in this repo), `requirements.md` constraints (TS + Vite; NFR1, NFR5), workspace-wide coverage/scripts (extended in the U2 NFR pass). Answers from `nfr-requirements-questions.md` (Q4 A).

| Choice | Decision | Rationale |
|---|---|---|
| Language | TypeScript (strict, same tsconfig as U1) | Shared types with U1; `BreedingPair`/`FryCohort` shapes land with U5 implementation per the migration register. |
| Test runner | Vitest + `--coverage` 80% line floor, run in CI before merge | Workspace-wide config already covers `packages/*/src`; no new setup. |
| Lint/format | ESLint per repo `eslint.config.js` (CI-blocking); no formatter configured yet | Same tracking note as U2–U4 — follows ESLint until the team configures one. |
| Dependencies | None new — pure logic over U1 types + `ctx.rng` + read-only catalogue. | No I/O, no render code in U5. |

## Performance budget implication

| ID | Requirement | Source | Verification |
|---|---|---|---|
| NFR1.1 | Breeding share of the sim budget: the breeding phase costs ≤ 0.125 ms per game-hour tick at 100 fish (per-pair gate checks + per-cohort decay; pairs ≤ fish/2, cohorts ≤ 10 — see verification), i.e. ≤ 0.5 ms/frame worst case at x4. Frame split within the ≤ 8 ms total: water 4 + fish 2 + feeding 1 + breeding 0.5 + commerce/notify 0.5 = 8 ms (zero margin; the U6 pass holds commerce + notify ≤ 0.5 ms/frame combined). | NFR1 | Full-tick benchmark (100-fish save with 50 active pairs + 10 active cohorts — the pinned fixture; "few" means ≤ 10 cohorts): 50 warmup ticks, p95 of 300 full ticks ≤ 8.0 ms on the calibrated proxy (on-device validation at milestones); breeding-phase probe ≤ 0.125 ms/tick recorded alongside. |

NFR2 (accessibility) has no U5 surface — breeding screens reach the player through U7's keyboard-parity shell; marked N/A in traceability.
