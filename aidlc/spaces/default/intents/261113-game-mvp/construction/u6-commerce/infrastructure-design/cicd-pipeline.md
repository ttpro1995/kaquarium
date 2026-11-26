# CI/CD Pipeline — u6-commerce

> Upstream: `nfr-design/security-design.md` (test design, money atomicity), `nfr-design/logical-components.md` (CommerceSystem, CommerceCommands, NotifySubsystem), `inception/domain-design/components.md` (Market, Orders, Progression, Economy, Notifications in the monolith), `functional-design/functional-spec.md` (W26–W35), U2–U5 `infrastructure-design/cicd-pipeline.md` (shared stages). Answers from `infrastructure-design-questions.md` (Q1–Q2 all A).
> Scope note: same library-unit position — no per-unit deployable, no `infrastructure-specification.md`/`monitoring-design.md`.

## Design inputs

- `functional-spec.md` W26–W35 (buy/sell, demand/trend, orders, XP/levels, costs, notifications) define the operations CI covers.
- `components.md` places Market/Orders/Progression/Economy/Notifications in the monolith: one artifact, no per-unit services.

## Pipeline stages

| Stage | Command | Gate |
|---|---|---|
| Build | `npm run build` — today `tsc --noEmit`; `vite build` bundle lands at U7 codegen (recorded input) | One immutable artifact per commit SHA once the bundle exists. |
| Typecheck | `npx tsc --noEmit` | Fail on any error. |
| Lint | `npx eslint packages/*/src packages/*/tests` | Fail on error. |
| Test + coverage | `npx vitest run --coverage packages/*/tests` | 80% line floor; U6 required files (codegen inputs, paths): `packages/u6-commerce/tests/commerce.test.ts`, `packages/u6-commerce/tests/replay.test.ts`, `packages/u6-commerce/tests/benchmark.test.ts`. |
| Benchmarks | p95-of-300 ≤ 0.125 ms commerce+notify probe (full board, 100-notification queue) + heap growth < 64 KB over 100 ticks (informational) | Cap exceedance opens a tracked `perf-regression` follow-up; repeat failures escalate to blocking. |

## Environments, promotion, rollback, secrets

Shared with U2–U5's recorded pipeline: staging on merge, manual prod promotion of the same bytes; rollback = redeploy previous artifact (retention + hosting are U7 codegen inputs; interim = rebuild from tagged commit); no secrets in U6.
