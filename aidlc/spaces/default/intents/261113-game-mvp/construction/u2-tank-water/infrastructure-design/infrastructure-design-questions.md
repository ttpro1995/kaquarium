# Infrastructure Design — Questions (u2-tank-water)

> Unit U2 is a `library`-kind pure-logic package in an offline-first browser bundle (no servers, no AWS, no containers). This pass designs the build/CI slice that ships it: compile, test, lint, and the shared pipeline gates. Produces: cicd-pipeline.md, traceability.json.

## Q1. [Model] CI stages for the sim packages (NFR5.1)

Every merge runs, in order: `tsc --noEmit` → `eslint` (fail on error) → `vitest run --coverage` with the 80% line floor enforced → benchmark probes (informational). Any failure blocks merge. Same pipeline for every `packages/*` unit; U2 adds no unit-specific stage.

A. As stated: typecheck → lint → test+coverage gate → benchmarks informational
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Environments and promotion (team Deployment practice)

Merge to `main` deploys the static bundle to staging automatically; production promotes only on manual approval (tech lead + product owner per org defaults). U2 ships inside the single monolithic artifact — no per-unit deployable.

A. Confirm: staging on merge, manual prod promotion, single artifact
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q3. [Model] Rollback and artifact strategy (C6 recovery rule)

Rollback = redeploy the previous staging/prod artifact (immutable build per commit SHA); no database to migrate back (saves are client-side, forward-migrated by the app's own v1→v2 chain). Build once, promote the same bytes.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A
