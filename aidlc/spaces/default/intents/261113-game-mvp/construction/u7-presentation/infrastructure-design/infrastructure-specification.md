# Infrastructure Specification — u7-presentation

> Upstream: `nfr-design/performance-design.md` (render budget, backlog), `nfr-design/logical-components.md` (TankCanvas, Shell, CompositionRoot), `nfr-design/security-design.md` (fault/settings design), `tech-stack-decisions.md` (pinned deps), `functional-design/functional-spec.md` (W36–W49 boot/save/away), `components.md` (TankRenderer + UI in the monolith), `contract-summary.md` (C2 scheduler cap, C5, C6). Answers from `infrastructure-design-questions.md` (Q1–Q3 all A).
> U7 owns the answers every sim unit deferred here: `vite.config.ts` + `index.html`, retained-artifact hosting, and the no-backend observability stance.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | None (static bundle; no servers, containers, or functions) | Offline-first browser game; all logic runs client-side. |
| Networking topology | None (no ingress/egress, VPC, or DNS beyond static hosting) | No backend to reach; saves live in browser storage. |
| Storage strategy | Browser storage (IndexedDB with localStorage fallback, per C6); no server-side state | Current save + autosave rotation + `lastSeenSaveAt` all client-side. |
| Environments | Staging auto-deploys on merge to `main`; production promotes the same bytes on manual approval (tech lead + product owner) | Team Deployment practice; environment parity = identical bytes. |
| IaC approach | None (no cloud resources to declare); the build is fully described by `package.json` scripts + `vite.config.ts` at codegen | Nothing to provision, nothing to drift. |
| Resource sizing | Client device is the fleet (reference: Meizu Lucky 08); budgets enforced by benchmark/soak gates, not by server sizing | Perf is a client-frame contract (8 ms sim + 12 ms render). |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Static hosting | hosting | Any static host serving immutable versioned URLs with SPA fallback to index.html (concrete provider selected at U7 codegen); retains last 10 versioned artifacts per commit SHA | Rollback = redeploy previous retained artifact (rebuild from tag only if retention exhausted). |
| PWA shell | offline | `vite-plugin-pwa@^2.0.0` manifest + service worker (codegen) | Installable, offline-first after first load. SW update: check on launch, prompt non-blocking "Reload to update"; a stale client keeps running on old bytes (saves are versioned and migrate forward, so no cross-version corruption). |
| CI runner | build/test | `tsc --noEmit` → `eslint` → `vitest run --coverage` (80% floor) → benchmarks informational → axe-core + snapshots + keyboard walkthrough | Every merge blocked on failure except informational benchmarks (cap exceedance opens a tracked `perf-regression` follow-up). |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| CI pipeline + build scripts | U7 (composition root) | U1–U6 (all `packages/*` run through the same stages) | Read-only for sim units; U7 codegen owns `vite.config.ts`, `index.html`, hosting wiring. |
| Versioned static artifact | U7 | All (single monolithic bundle) | One artifact per commit SHA; staging and prod promote identical bytes. |
