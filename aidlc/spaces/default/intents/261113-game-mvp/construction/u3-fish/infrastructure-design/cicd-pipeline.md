# CI/CD Pipeline — u3-fish

> Upstream: `nfr-design/security-design.md` (test design, genome guard), `nfr-design/logical-components.md` (FishSystem, FishSelectors), `inception/domain-design/components.md` (FishPopulation in the monolith), `functional-design/functional-spec.md` (W12–W15), U2's `infrastructure-design/cicd-pipeline.md` (shared stages, build/rollback ownership). Answers from `infrastructure-design-questions.md` (Q1–Q2 all A).
> Scope note: same library-unit position as U2 — no per-unit deployable, no `infrastructure-specification.md`/`monitoring-design.md`.

## Pipeline stages

| Stage | Command | Gate |
|---|---|---|
| Build | `npm run build` — today `tsc --noEmit`; `vite build` bundle lands at U7 codegen (recorded input) | One immutable artifact per commit SHA once the bundle exists. |
| Typecheck | `npx tsc --noEmit` | Fail on any error. |
| Lint | `npx eslint packages/*/src packages/*/tests` | Fail on error. |
| Test + coverage | `npx vitest run --coverage packages/*/tests` | 80% line floor; U3 required files (codegen inputs, paths): `packages/u3-fish/tests/growth-health.test.ts`, `packages/u3-fish/tests/replay.test.ts`, `packages/u3-fish/tests/benchmark.test.ts`. |
| Benchmarks | p95-of-300 ≤ 0.5 ms fish-phase probe + heap growth < 64 KB over 100 ticks (informational) | Cap exceedance opens a tracked `perf-regression` follow-up; repeat failures escalate to blocking. |

## Environments, promotion, rollback, secrets

Shared with U2's recorded pipeline: staging on merge, manual prod promotion of the same bytes; rollback = redeploy previous artifact (retention + hosting are U7 codegen inputs; interim = rebuild from tagged commit); no secrets in U3.
