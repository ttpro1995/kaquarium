# Tech Stack Decisions — u4-feeding

> Upstream: team Code Style (ESLint, language-idiomatic naming; no formatter configured in this repo), `requirements.md` constraints (TS + Vite; NFR1, NFR5), workspace-wide coverage/scripts (extended in the U2 NFR pass). Answers from `nfr-requirements-questions.md` (Q4 A).

| Choice | Decision | Rationale |
|---|---|---|
| Language | TypeScript (strict, same tsconfig as U1) | Shared types with U1; `FoodItem`/`FeedingSchedule` shapes from `types.ts` once the v1 → v2 migration lands them. |
| Test runner | Vitest + `--coverage` 80% line floor, run in CI before merge | Workspace-wide config already covers `packages/*/src`; no new setup. |
| Lint/format | ESLint per repo `eslint.config.js` (CI-blocking); no formatter configured yet | Same tracking note as U2/U3 — follows ESLint until the team configures one. |
| Dependencies | None new — pure logic over U1 types + read-only catalogue; no RNG in U4 (expiry is pure game-day arithmetic; any future draw uses `ctx.rng` per NFR3.1). | No I/O, no render code in U4. |

## Performance budget implication

| ID | Requirement | Source | Verification |
|---|---|---|---|
| NFR1.1 | Feeding share of the sim budget: the feeding phase costs ≤ 0.25 ms per game-hour tick (schedule check + expiry sweep — O(stacks), unbounded by construction per BR12.2 append-per-buy, with a nanosecond-scale per-stack constant), i.e. ≤ 1 ms/frame worst case at x4 — leaving the remainder for breeding + commerce + notify, which combined must fit ≤ 1 ms/frame (4 + 2 + 1 + 1 = 8 ms total; zero margin, so the U5/U6 passes hold the remainder as a cap, not a floor). | NFR1 | Benchmark scene (100-fish save, 4-stack food stock: one stack per kind including one expired liveFirst, plus a 24-stack import-cap run): 50 warmup ticks, p95 of 300 timed feeding-phase ticks ≤ 0.25 ms on the calibrated proxy (on-device validation at milestones); heap growth < 64 KB over 100 consecutive ticks. |

NFR2 (accessibility) has no U4 surface — feeding controls reach the player through U7's keyboard-parity shell; marked N/A in traceability.
