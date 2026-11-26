# Infrastructure Design — Questions (u5-breeding)

> Unit U5 is a `library`-kind pure-logic package in the same offline-first bundle: shared pipeline, no per-unit deployable. Produces: cicd-pipeline.md, traceability.json.

## Q1. [Model] CI stages for U5 (NFR5.1)

Shared pipeline (typecheck → lint → test+coverage gate → benchmarks informational), plus re-pair/gate/scale/decay/grade/stunt suites and golden replay (pairing → spawn → hatch → grade) as required test files.

A. Shared pipeline; required files: `packages/u5-breeding/tests/breeding.test.ts`, `packages/u5-breeding/tests/replay.test.ts`, `packages/u5-breeding/tests/benchmark.test.ts`
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Build/rollback ownership (shared)

Same as U2–U4: `vite build` bundle + retention/hosting land at U7 codegen; until then typecheck is the compile gate and rollback = rebuild from the tagged commit. Benchmark trigger: cap exceedance → tracked `perf-regression` follow-up.

A. Confirm (shared)
B. Tune — say how
X. Other (please specify)

[Answer]: A
