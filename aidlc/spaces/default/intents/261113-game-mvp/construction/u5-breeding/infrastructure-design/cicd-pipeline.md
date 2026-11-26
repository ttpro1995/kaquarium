# CI/CD Pipeline — u5-breeding

> Upstream: `nfr-design/security-design.md` (test design, no-rollback), `nfr-design/logical-components.md` (BreedingSystem, BreedingCommands), `inception/domain-design/components.md` (Breeding in the monolith), `functional-design/functional-spec.md` (W21–W25), U2–U4 `infrastructure-design/cicd-pipeline.md` (shared stages). Answers from `infrastructure-design-questions.md` (Q1–Q2 all A).
> Scope note: same library-unit position — no per-unit deployable, no `infrastructure-specification.md`/`monitoring-design.md`.

## Design inputs

- `functional-spec.md` W21–W25 (pairing, spawn attempts, birth/hatch, fry life, grading) define the operations CI covers.
- `components.md` places Breeding in the monolith: one artifact, no per-unit services.

## Pipeline stages

| Stage | Command | Gate |
|---|---|---|
| Build | `npm run build` — today `tsc --noEmit`; `vite build` bundle lands at U7 codegen (recorded input) | One immutable artifact per commit SHA once the bundle exists. |
| Typecheck | `npx tsc --noEmit` | Fail on any error. |
| Lint | `npx eslint packages/*/src packages/*/tests` | Fail on error. |
| Test + coverage | `npx vitest run --coverage packages/*/tests` | 80% line floor; U5 required files (codegen inputs, paths): `packages/u5-breeding/tests/breeding.test.ts`, `packages/u5-breeding/tests/replay.test.ts`, `packages/u5-breeding/tests/benchmark.test.ts`. |
| Benchmarks | p95-of-300 ≤ 0.125 ms breeding-phase probe (50-pair/10-cohort fixture) + heap growth < 64 KB over 100 ticks (informational) | Cap exceedance opens a tracked `perf-regression` follow-up; repeat failures escalate to blocking. |

## Environments, promotion, rollback, secrets

Shared with U2–U4's recorded pipeline: staging on merge, manual prod promotion of the same bytes; rollback = redeploy previous artifact (retention + hosting are U7 codegen inputs; interim = rebuild from tagged commit); no secrets in U5.
