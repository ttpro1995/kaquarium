# Infrastructure Design — Questions (u1-sim-foundation)

> Unit U1 is a pure-TypeScript library kernel inside an offline-first PWA (no backend, no cloud resources, no secrets). The only infrastructure is the build, the static hosting, and the CI pipeline. Affirmed practices: feature branches into `main`, review before merge, TDD with 80% line floor, CI before merge; staging on merge, manual production approval.

## Q1. [Infra] Hosting and packaging (MVP)

The app ships as static files (Vite build) with a service-worker precache for offline play, hosted on any static host. Browser storage (IndexedDB + localStorage) is the only persistence. This confirms the MVP footprint — no environments beyond staging/prod, no IaC, no servers.

A. Confirm: static hosting + service-worker precache; staging deploys on merge, production on manual approval
B. Change it — say how
X. Other (please specify)

[Answer]: A

## Q2. [Infra] CI pipeline gates (MVP)

Build (Vite + typecheck), unit tests (Vitest), 80% line-coverage floor, lint (ESLint), then merge. This confirms the gate set the Code Generation stage will build against.

A. Confirm: build + typecheck + Vitest + coverage floor + ESLint on every PR; staging deploy on merge to `main`
B. Change it — say how
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
