# CI/CD Pipeline — u7-presentation

> Upstream: `infrastructure-specification.md` (build + hosting + retention), `nfr-design/security-design.md` (snapshot design, settings persistence), `frontend-components.md`, U2–U6 `infrastructure-design/cicd-pipeline.md` (shared stages this file completes). Answers from `infrastructure-design-questions.md` (Q1–Q3 all A).
> U7 closes every deferred build/hosting input from the sim units.

## Design inputs

- `functional-spec.md` W36–W49 (renderer, shell, boot, save/load, away, fault) define what the bundle must contain.
- `tech-stack-decisions.md` pins: `pixi.js@^8.23.0`, `svelte@^5.59.1`, `axe-core@^4.14.1` (dev), `vite-plugin-pwa@^2.0.0`; codegen installs and commits the lockfile.

## Pipeline stages

| Stage | Command | Gate |
|---|---|---|
| Install | `npm ci` (lockfile committed at U7 codegen) | Reproducible dependency tree. |
| Build | `npm run build` → `tsc && vite build` (`vite.config.ts` + `index.html` land here) | Fail on error; emits one versioned static artifact per commit SHA. |
| Lint | `npx eslint` incl. Svelte plugin (repo `eslint.config.js` extended at codegen) | Fail on error. |
| Test + coverage | `npx vitest run --coverage` | 80% line floor (shell logic); renderer visuals via catalog snapshots + soak, not line coverage. |
| A11y + snapshots | axe-core on shell DOM, keyboard walkthrough, catalog + DOM snapshots | Zero serious/critical; ≤ 0.1% pixel diff; no clipped targets at 200% zoom. |
| Benchmarks | full phase probes + x1/x4 soaks + render-isolated probe (informational) | Cap exceedance opens a tracked `perf-regression` follow-up; two consecutive failures on `main` escalate the benchmark stage to blocking until green. |

## Environments, promotion, rollback, secrets

- Staging auto-deploys the versioned artifact on merge to `main`; production promotes the identical bytes on manual approval (tech lead + product owner).
- Static hosting retains the last 10 artifacts; rollback = redeploy the previous retained artifact (rebuild from the tagged commit only if retention is exhausted).
- No secrets in any unit; the only CI credential is the hosting deploy target, configured outside this design.
