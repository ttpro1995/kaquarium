# Infrastructure Design — Questions (u6-commerce)

> Unit U6 is a `library`-kind pure-logic package in the same offline-first bundle: shared pipeline, no per-unit deployable. Produces: cicd-pipeline.md, traceability.json.

## Q1. [Model] CI stages for U6 (NFR5.1)

Shared pipeline (typecheck → lint → test+coverage gate → benchmarks informational), plus price/saturation/premium/cap suites and golden replay (sales → saturation → order cycle) as required test files.

A. Shared pipeline; required files: `packages/u6-commerce/tests/commerce.test.ts`, `packages/u6-commerce/tests/replay.test.ts`, `packages/u6-commerce/tests/benchmark.test.ts`
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Build/rollback ownership (shared)

Same as U2–U5: `vite build` bundle + retention/hosting land at U7 codegen; until then typecheck is the compile gate and rollback = rebuild from the tagged commit. Benchmark trigger: cap exceedance → tracked `perf-regression` follow-up.

A. Confirm (shared)
B. Tune — say how
X. Other (please specify)

[Answer]: A
