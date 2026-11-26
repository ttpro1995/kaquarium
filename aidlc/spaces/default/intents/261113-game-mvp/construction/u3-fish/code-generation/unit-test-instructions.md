# Unit Test Instructions — u3-fish

> Framework: Vitest (+ v8 coverage). Methodology: TDD red-green-refactor. Strategy: Standard (5–8 tests per component + integration stubs) + mvp 80% line floor, CI before merge.

## Setup

Workspace-wide config already covers this unit. Depends on the U2 codegen migration existing in the tree (v2 Tank shape); the suite reads live U2 water state — no mocks of sibling units.

## Commands (unit-scoped only)

```bash
# Full U3 suite
npx vitest run packages/u3-fish

# With coverage (informational at unit scope; the 80% floor is judged by Build and Test on the full suite)
npx vitest run --coverage packages/u3-fish

# Typecheck + lint for U3 files
npx tsc --noEmit
npx eslint packages/u3-fish/src packages/u3-fish/tests
```

## Expected coverage targets

- 80% line floor (mvp scope add-on; checked by Build and Test on the assembled full suite).
- New/changed lines in this unit should be ~100% covered by its own tests.

## Mocking/stubbing guidance

- Do not mock the U1 kernel or U2 water: use the real store/bus/registry + real U2 system for integration tests.
- Species catalogue: minimal inline fixtures (maturity/lifespan/adultSize/genes); never the full 30-species data.
- RNG: fixed seeds; `spawnFish`/`inheritGenome` take rng as a parameter — pass a seeded stream in tests.

## Test data management

- 100-fish benchmark save builder (deterministic seed), shared shape with the U2 benchmark fixture.
- Golden replay script: fixed seed + scripted ticks/commands (birth-death-maturity) with stored expected state.
