# Unit Test Instructions — u6-commerce

> Framework: Vitest (+ v8 coverage). Methodology: TDD red-green-refactor. Strategy: Standard (5–8 tests per component + integration stubs) + mvp 80% line floor, CI before merge.

## Setup

Workspace-wide config already covers this unit. Depends on the U2 codegen migration (v2 shape incl. market/order/progression/notification fields); suite reads live U2/U3/U5 state — no sibling mocks.

## Commands (unit-scoped only)

```bash
npx vitest run packages/u6-commerce
npx vitest run --coverage packages/u6-commerce
npx tsc --noEmit
npx eslint packages/u6-commerce/src packages/u6-commerce/tests
```

## Expected coverage targets

80% line floor (checked by Build and Test on the full suite); new/changed lines ~100% covered by its own tests.

## Mocking/stubbing guidance

Real U1 kernel + real sibling systems/units in integration tests (buyFish trio, fulfil flow, hatch-XP sighting). Minimal species fixtures. Fixed seeds via ctx.rng.

## Test data management

Full-board + 100-notification benchmark fixture; golden replay script (sales → saturation → order cycle); hand-stamped commerce fixtures (negative demand, L9 progression, 101st notification, zero interval).
