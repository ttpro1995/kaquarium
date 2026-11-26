# Tech Stack Decisions — u3-fish

> Upstream: team Code Style (ESLint, language-idiomatic naming; no formatter configured in this repo), `requirements.md` constraints (TS + Vite; NFR1, NFR5), workspace-wide coverage/scripts (extended in the U2 NFR pass). Answers from `nfr-requirements-questions.md` (Q4 A).

| Choice | Decision | Rationale |
|---|---|---|
| Language | TypeScript (strict, same tsconfig as U1) | Shared types with U1; `Fish`/`Genome` shapes from `types.ts`. |
| Test runner | Vitest + `--coverage` 80% line floor, run in CI before merge | Workspace-wide config already covers `packages/*/src`; no new setup. |
| Lint/format | ESLint per repo `eslint.config.js` (CI-blocking); no formatter configured yet | Same tracking note as U2 — follows ESLint until the team configures one. |
| Dependencies | None new — pure logic over U1 types + `ctx.rng` + read-only species catalogue. | No I/O, no render code in U3. |

## Performance budget implication

| ID | Requirement | Source | Verification |
|---|---|---|---|
| NFR1.1 | Fish share of the sim budget, composed per frame. One tick = one game-hour (C2) with up to 4 live ticks per rendered frame at x4 (C2 cap): the fish phase costs ≤ 0.5 ms per tick at 100 fish, i.e. ≤ 2 ms/frame worst case — closed-form growth/health math per fish, no per-tick allocation (no per-tick sort; iteration follows the store's stable key order per NFR3.1). Frame composition within the ≤ 8 ms/frame total sim budget: water ≤ 4 ms (U2 NFR1.1) + fish ≤ 2 ms + breeding/commerce/notify ≤ 2 ms combined (their shares land with their NFR passes and must sum within the remainder). | NFR1 | Benchmark scene (100-fish save): 50 warmup ticks, then p95 of 300 timed fish-phase ticks ≤ 0.5 ms on a calibrated proxy of the Meizu Lucky 08 (on-device validation at milestones — same protocol family as the `benchmark.test.ts` full-tick p95 ≤ 8 ms device gate); heap growth < 64 KB over 100 consecutive ticks (allocation check). |

NFR2 (accessibility) has no U3 surface — fish state reaches the player through U7's icon+text rendering; marked N/A in traceability.
