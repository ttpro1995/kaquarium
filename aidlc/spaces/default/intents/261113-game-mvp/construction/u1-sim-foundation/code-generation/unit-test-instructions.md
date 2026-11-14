# Unit Test Instructions — u1-sim-foundation

> Test-first (TDD) per the Testing Contract: write each test before the code it verifies, then implement until it passes. Standard strategy (5–8 tests per kernel component + boundary probes) with the MVP 80% line-coverage floor.

## Framework

Vitest (Vite-native). Config: `vitest.config.ts` at the workspace root, created in plan Step 1.

## Commands (unit-scoped only)

```bash
npx vitest run packages/u1-sim-foundation
```

Coverage (informational on a unit run; the 80% floor is judged by Build and Test on the full suite, never by this command):

```bash
npx vitest run --coverage packages/u1-sim-foundation
```

Never run a bare project-wide command for this unit.

## Coverage target

80% line floor (NFR5.1), checked by Build and Test on the assembled suite. If this unit-scoped command exits non-zero only on the coverage threshold with every selected test passing, record that with the test results; it is not a failed test.

## Mocking / stubbing

No mocks for pure kernel logic (RNG, tick, commands, drain). Browser storage is abstracted behind a small `StoragePort` so tests inject an in-memory double; the real IndexedDB/localStorage adapters are covered by fault-injection tests. Timers are virtual (Vitest fake timers) for autosave tests.

## Test data

Fixed seeds (e.g. seed 42) with golden-state digests for replay tests; a 30-species fixture catalogue with 2 valid + 1 invalid entry for validation tests; a 100-fish generated save for benchmark probes (timings informational in CI).
