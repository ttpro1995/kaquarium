# Unit Test Instructions — u4-feeding

> Framework: Vitest (+ v8 coverage). Methodology: TDD red-green-refactor. Strategy: Standard (5–8 tests per component + integration stubs) + mvp 80% line floor, CI before merge.

## Setup

Workspace-wide config already covers this unit. Depends on the U2 codegen migration (v2 shape incl. feeding section); suite reads live U2 water + U3 fish state — no sibling mocks.

## Commands (unit-scoped only)

```bash
npx vitest run packages/u4-feeding
npx vitest run --coverage packages/u4-feeding
npx tsc --noEmit
npx eslint packages/u4-feeding/src packages/u4-feeding/tests
```

## Expected coverage targets

80% line floor (checked by Build and Test on the full suite); new/changed lines ~100% covered by its own tests.

## Mocking/stubbing guidance

Real U1 kernel + real U2/U3 systems in integration tests. Minimal species/food fixtures. Fixed seeds; no ambient nondeterminism.

## Test data management

4-stack food stock fixture (one per kind + one expired liveFirst); scheduled program fixture; golden replay script (scheduled program + expiry crossing).
