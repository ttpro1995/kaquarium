# Tech Stack Decisions — u6-commerce

> Upstream: team Code Style (ESLint, language-idiomatic naming; no formatter configured in this repo), `requirements.md` constraints (TS + Vite; NFR1, NFR5), workspace-wide coverage/scripts (extended in the U2 NFR pass). Answers from `nfr-requirements-questions.md` (Q4 A).

| Choice | Decision | Rationale |
|---|---|---|
| Language | TypeScript (strict, same tsconfig as U1) | Shared types with U1; `MarketState`/`Order`/`PlayerProgression`/`Notification` shapes land via the v1 → v2 migration per the register. |
| Test runner | Vitest + `--coverage` 80% line floor, run in CI before merge | Workspace-wide config already covers `packages/*/src`; no new setup. |
| Lint/format | ESLint per repo `eslint.config.js` (CI-blocking); no formatter configured yet | Same tracking note as U2–U5 — follows ESLint until the team configures one. |
| Dependencies | None new — pure logic over U1 types + `ctx.rng` + read-only catalogue. | No I/O, no render code in U6. |

## Performance budget implication

| ID | Requirement | Source | Verification |
|---|---|---|---|
| NFR1.1 | Commerce + notify share of the sim budget: ≤ 0.125 ms per game-hour tick at 100 fish (price-cache refresh closed-form per fish, demand/trend over 30 species, day-boundary upkeep only), i.e. ≤ 0.5 ms/frame worst case at x4. Frame split closes the ≤ 8 ms total: water 4 + fish 2 + feeding 1 + breeding 0.5 + commerce/notify 0.5 = 8 ms (zero margin; holds only if every phase meets its cap — the full-tick p95 ≤ 8 ms gate is the enforcer). | NFR1 | Full-tick benchmark (100-fish save, full board, 100-notification queue): 50 warmup, p95 of 300 ≤ 8.0 ms on the calibrated proxy (on-device validation at milestones); commerce + notify probes ≤ 0.125 ms/tick recorded alongside. |

NFR2 (accessibility) has no U6 surface — the queue, bell, and panels render in U7's keyboard-parity shell; marked N/A in traceability.
