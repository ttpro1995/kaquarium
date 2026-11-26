# CI/CD Pipeline — u2-tank-water

> Upstream: `nfr-design/security-design.md` (test design, import barrier), `nfr-design/logical-components.md` (WaterSystem, ImportBarrier), `tech-stack-decisions.md` (TS strict, Vitest, ESLint), team Deployment practice (staging on merge, manual prod). Answers from `infrastructure-design-questions.md` (Q1–Q3 all A).
> Scope note: U2 is a `library`-kind pure-logic package in one offline-first browser bundle — no servers, no AWS, no containers, no per-unit deployable. This file designs the shared build/CI slice that ships it; there is no `infrastructure-specification.md` or `monitoring-design.md` for this unit (no services to provision or monitor).

## Design inputs

- `functional-design/functional-spec.md` W7–W11 (the water/tank operations CI must keep green) and `inception/domain-design/components.md` (TankEnvironment + the 14-component catalogue placing U2 in the monolith) scope this pipeline: one artifact, no per-unit deployables, no service topology to provision.

## Pipeline stages

| Stage | Command | Gate |
|---|---|---|
| Build | `npm run build` — today `tsc --noEmit` only; becomes typecheck + `vite build` bundle at U7 codegen when `vite.config.ts` + `index.html` land (recorded U7 codegen input, not a silent assumption) | One immutable artifact per commit SHA once the bundle step exists; until then the typecheck is the compile gate. |
| Typecheck | `npx tsc --noEmit` | Fail on any error. |
| Lint | `npx eslint packages/*/src packages/*/tests` | Fail on error; warnings allowed. |
| Test + coverage | `npx vitest run --coverage packages/*/tests` | 80% line floor (v8); fail below. |
| Benchmarks | timed phase probes + heap checks (informational) | Never block merge; any probe exceeding its NFR1.1-family cap opens a tracked `perf-regression` follow-up before the next stage gate — repeated failures escalate to blocking. |

## Environments and promotion

| Step | Rule |
|---|---|
| Build | One immutable artifact per commit SHA (`vite build`), shared by all units. |
| Staging | Merge to `main` deploys automatically; exercises U2 in a real environment. |
| Production | Manual approval only (tech lead + product owner); promotes the same bytes built for staging. |
| Rollback | Redeploy the previous artifact; no server state to unwind (saves are client-side and forward-migrate in-app via the C6 chain). Artifact retention (last N builds) and the hosting target are U7 codegen inputs (composition root + PWA shell own them); until they land, rollback = rebuild from the tagged commit. |

## Secrets management

None required for U2: no keys, tokens, or service credentials exist in this unit. CI needs no secret beyond the deploy target's hosting credentials (owned by the hosting setup, not this design).
