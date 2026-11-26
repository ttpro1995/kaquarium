# Unit Test Instructions — u2-tank-water

> Framework: Vitest (+ v8 coverage). Methodology: TDD red-green-refactor (team affirmation). Strategy: Standard (5–8 tests per component + integration stubs for key boundaries) + mvp 80% line-coverage floor, CI before merge.

## Setup

Workspace-wide config already covers this unit (`vitest.config.ts` includes `packages/*/tests`, coverage includes `packages/*/src`). No extra setup; `npm install` at root if `node_modules` is absent.

## Commands (unit-scoped only)

```bash
# Full U2 suite (unit + integration + migration + benchmark)
npx vitest run packages/u2-tank-water

# With coverage (informational at unit scope; the 80% floor is judged by Build and Test on the full suite)
npx vitest run --coverage packages/u2-tank-water

# Typecheck + lint for U2 files
npx tsc --noEmit
npx eslint packages/u2-tank-water/src packages/u2-tank-water/tests
```

## Expected coverage targets

- 80% line floor (mvp scope add-on; checked by Build and Test on the assembled full suite, not on this unit's run alone).
- New/changed lines in this unit should be ~100% covered by its own tests.

## Mocking/stubbing guidance

- Do not mock the U1 kernel: use the real store/bus/registry (`createKernel` factory) for command tests.
- Species catalogue: use minimal inline fixtures (heater-relevant tropical + temperate species); never the full 30-species data.
- RNG: fixed seeds via `ctx.rng`; no `Math.random`/`Date.now` in tests or src.

## Test data management

- v1 save fixture: minimal envelope with the OLD Tank shape (hand-written JSON in `tests/fixtures/`).
- Benchmark scene: 100-fish save builder (deterministic seed, mixed sizes) shared by the timed probes.
- Import fixtures: oversize text, banned-key payload, over-count payload, out-of-range chemistry, hand-stamped v2 missing latches.
