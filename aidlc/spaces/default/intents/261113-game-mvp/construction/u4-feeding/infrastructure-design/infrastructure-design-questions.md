# Infrastructure Design — Questions (u4-feeding)

> Unit U4 is a `library`-kind pure-logic package in the same offline-first bundle: shared pipeline, no per-unit deployable. Produces: cicd-pipeline.md, traceability.json.

## Q1. [Model] CI stages for U4 (NFR5.1)

Shared pipeline (typecheck → lint → test+coverage gate → benchmarks informational), plus portion/expiry/idempotency/schedule suites, hand-stamped import fixtures, and golden replay as required test files.

A. Shared pipeline; required files: `packages/u4-feeding/tests/feeding.test.ts`, `packages/u4-feeding/tests/replay.test.ts`, `packages/u4-feeding/tests/benchmark.test.ts`
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Build/rollback ownership (shared)

Same as U2/U3: `vite build` bundle + retention/hosting land at U7 codegen; until then typecheck is the compile gate and rollback = rebuild from the tagged commit. Benchmark trigger: cap exceedance → tracked `perf-regression` follow-up.

A. Confirm (shared)
B. Tune — say how
X. Other (please specify)

[Answer]: A
