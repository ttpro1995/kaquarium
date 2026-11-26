# CI/CD Pipeline — u4-feeding

> Upstream: `nfr-design/security-design.md` (test design, import bounds), `nfr-design/logical-components.md` (FeedingSystem, FoodShop, FeedCommands), `inception/domain-design/components.md` (Feeding in the monolith), `functional-design/functional-spec.md` (W16–W20), U2/U3 `infrastructure-design/cicd-pipeline.md` (shared stages). Answers from `infrastructure-design-questions.md` (Q1–Q2 all A).
> Scope note: same library-unit position as U2/U3 — no per-unit deployable, no `infrastructure-specification.md`/`monitoring-design.md`.

## Design inputs

- `functional-spec.md` W16 (append-per-buy), W17–W19 (feed paths, command-path counters), W18 (auto-feeder schedule) define the operations CI covers.
- `components.md` places Feeding in the monolith: one artifact, no per-unit services.

## Pipeline stages

| Stage | Command | Gate |
|---|---|---|
| Build | `npm run build` — today `tsc --noEmit`; `vite build` bundle lands at U7 codegen (recorded input) | One immutable artifact per commit SHA once the bundle exists. |
| Typecheck | `npx tsc --noEmit` | Fail on any error. |
| Lint | `npx eslint packages/*/src packages/*/tests` | Fail on error. |
| Test + coverage | `npx vitest run --coverage packages/*/tests` | 80% line floor; U4 required files (codegen inputs, paths): `packages/u4-feeding/tests/feeding.test.ts`, `packages/u4-feeding/tests/replay.test.ts`, `packages/u4-feeding/tests/benchmark.test.ts`. |
| Benchmarks | p95-of-300 ≤ 0.25 ms feeding-phase probe (4-stack + 24-stack) + heap growth < 64 KB over 100 ticks (informational) | Cap exceedance opens a tracked `perf-regression` follow-up; repeat failures escalate to blocking. |

## Environments, promotion, rollback, secrets

Shared with U2/U3's recorded pipeline: staging on merge, manual prod promotion of the same bytes; rollback = redeploy previous artifact (retention + hosting are U7 codegen inputs; interim = rebuild from tagged commit); no secrets in U4.
