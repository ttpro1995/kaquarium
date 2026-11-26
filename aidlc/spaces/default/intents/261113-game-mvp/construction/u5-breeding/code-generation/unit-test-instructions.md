# Unit Test Instructions — u5-breeding

> Framework: Vitest (+ v8 coverage). Methodology: TDD red-green-refactor. Strategy: Standard (5–8 tests per component + integration stubs) + mvp 80% line floor, CI before merge.

## Setup

Workspace-wide config already covers this unit. Depends on the U2 codegen migration (v2 shape incl. `GameState.pairs`); suite reads live U2 water/U3 fish/U4 counters — no sibling mocks.

## Commands (unit-scoped only)

```bash
npx vitest run packages/u5-breeding
npx vitest run --coverage packages/u5-breeding
npx tsc --noEmit
npx eslint packages/u5-breeding/src packages/u5-breeding/tests
```

## Expected coverage targets

80% line floor (checked by Build and Test on the full suite); new/changed lines ~100% covered by its own tests.

## Mocking/stubbing guidance

Real U1 kernel + real sibling systems in integration tests. Minimal species fixtures (one livebearer, one scatter). Fixed seeds via ctx.rng.

## Test data management

50-pair/10-cohort benchmark fixture; golden replay script (pairing → spawn → hatch → grade) with stored expected state; hand-stamped breeding fixtures (unknown pair state, 501st pair) for import tests.
