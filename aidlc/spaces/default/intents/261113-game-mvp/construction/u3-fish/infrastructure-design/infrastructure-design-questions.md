# Infrastructure Design — Questions (u3-fish)

> Unit U3 is a `library`-kind pure-logic package in the same offline-first bundle: same shared pipeline, no per-unit deployable. Produces: cicd-pipeline.md, traceability.json.

## Q1. [Model] CI stages for U3 (NFR5.1)

Same shared pipeline (typecheck → lint → test+coverage gate → benchmarks informational), plus the golden replay test and W12-ordered growth/health suites as required test files.

A. Shared pipeline, no U3-specific stage; replay + boundary suites named as required files
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Build/rollback ownership (U7 codegen inputs)

Same as U2: `vite build` bundle + retention/hosting land at U7 codegen; until then typecheck is the compile gate and rollback = rebuild from the tagged commit.

A. Confirm (shared with U2's recorded inputs)
B. Tune — say how
X. Other (please specify)

[Answer]: A
