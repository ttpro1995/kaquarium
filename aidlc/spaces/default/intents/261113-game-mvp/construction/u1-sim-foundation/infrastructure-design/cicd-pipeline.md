# CI/CD Pipeline — u1-sim-foundation

> Upstream: `security-design.md`, `logical-components.md`, `components.md`, `functional-spec.md`, `contract-summary.md` (C1–C6). Answers from `infrastructure-design-questions.md` (Q1-A, Q2-A, summary `Looks correct`). No cloud resources, no IaC, no secrets: the pipeline builds, checks, and ships static files.

## Stages

1. **Install** — clean `npm ci` on the pinned lockfile.
2. **Build** — `vite build` + `tsc --noEmit`. A type error fails the run.
3. **Lint** — ESLint with the repo config, including `no-restricted-properties` + `no-restricted-globals` for the NFR3.2 banned APIs. A violation fails the run.
4. **Test** — Vitest run with the headless tick/scale/autosave probes (NFR1.1, NFR1.3, NFR1.4 protocols). A failing test fails the run.
5. **Coverage** — 80% line-coverage floor (NFR5.1). Below floor fails the run.
6. **Package** — static bundle + service-worker precache manifest for offline play. The precache manifest is produced by the Vite PWA plugin at this stage (workbox-style, content-hash addressed); CI fails the run if the manifest is missing or does not cover every build output.

## Artifact retention and promotion

- **Build once**: the bundle is built once on the PR. Vite emits content-hashed filenames, so identical content is byte-identical.
- **Owner and retention**: the CI artifact store owns the bundle (retain the last 30 builds); the static host keeps the current plus the previous bundle.
- **Hash-pinned promotion**: staging and production deploy the exact retained bytes referenced by content hash — never a rebuild. Rollback is redeploy-previous (the retained previous bundle); no data migration, since the save schema migrates forward in-app via BR6.3.

## Stage → gate mapping

| Stage | Gate | On failure |
|---|---|---|
| PR to `main` | Build + typecheck + lint + test + coverage all green | Merge blocked |
| Merge to `main` | All PR gates green | No deploy; fix forward on a branch |
| Staging deploy | Merge to `main` | Automatic deploy to the staging host |
| Production deploy | Manual approval | Human go-ahead only; same static bundle as staging |

## Rollback, promotion, secrets

- **Precache invalidation**: the manifest is versioned per build; on activation the new service worker purges old caches. A stale client running old code against a newer save is covered by the forward-only in-app migration chain (BR6.3); a save with an unknown newer schemaVersion is rejected with UNSUPPORTED_VERSION, current save untouched.
- **Promotion**: the exact bundle verified on staging promotes to production; never rebuild between the two.
- **Secrets**: none. No backend keys, no tokens, no vault; browser storage is the only persistence.
