# Code Summary — u1-sim-foundation

## Files created / modified
- Project skeleton: `package.json` (workspaces, scripts), `tsconfig.json` (strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess), `vitest.config.ts` (80% line thresholds), `eslint.config.js` (NFR3.2 banned-API rules), `packages/u1-sim-foundation/package.json`
- Kernel source (`packages/u1-sim-foundation/src/`): `types.ts`, `canonicalJson.ts`, `rng.ts` (mulberry32 over mutable RngState), `store.ts` (version/dirty/tickCount/halted, getFault(), replaceStoreState), `selectors.ts`, `registry.ts` (phase sort, duplicate-throw, assertExhaustive), `events.ts` (SimEventMap + drainEventBuffer), `commands.ts` + `bus.ts` (settings.update / clock.setSpeed / clock.setPaused, UNKNOWN_COMMAND), `tick.ts` (1-hour advance, halt + memory-only fault), `species.ts`, `persistence/sha256.ts` (bundled sync SHA-256), `persistence/persistence.ts` (3-slot rotation, write→verify→swap, import pipeline), `catchup.ts` (192-tick cap, whileYouWereAway), `kernel.ts` (createKernel factory), `index.ts` (barrel)
- Tests (`packages/u1-sim-foundation/tests/`): `types-store`, `rng-tick`, `commands-drain`, `persistence` (13), `catchup`, `save-api`, `benchmark` (test-only probes)

## Key implementation decisions
- Mutable `GameState` in tick/command handlers; rejected commands return `CommandOutcome` union and touch nothing (contract C2/C6)
- One event buffer + single drain (mapper → deliver → clear) with subscriber isolation (NFR4.6)
- `Fish.tankId` authoritative; `canonicalJson` pinned (recursive key sort, UTF-8, shortest round-trip numbers) shared by both digest paths
- Fault containment: halt + discard half-mutated store, memory-only `{ tick, systemId, message }` via `getFault()`, U7 polls and offers reload-last-autosave (NFR4.2)
- Banned APIs (`Math.random`, `Date.now`, etc.) rejected by ESLint `no-restricted-properties` + `no-restricted-globals`; one justified `eslint-disable` for the C6 `savedAt` wall-clock stamp

## Test coverage summary
- `npx vitest run packages/u1-sim-foundation` → 7 files, 54 tests, all pass
- `npx vitest run --coverage packages/u1-sim-foundation` → 89.95% lines (80% floor judged by Build and Test on the full suite)
- `npx tsc --noEmit` → clean; `npx eslint packages/u1-sim-foundation/src packages/u1-sim-foundation/tests` → clean
- Benchmarks (informational in CI): 100-fish tick p95 well under 8 ms budget, scaling R²=0.948, 100-fish autosave ~33 ms; device gates remain for Bolt checkpoints

## Tests written but not executed
- None. All 54 tests executed in this stage. Benchmark probes ran here as informational; their pass/fail gates apply on device at the Bolt checkpoints.

## Deviations from the plan
- None. All 19 plan steps executed as approved; plan checkboxes ticked. `selectors.ts` split out of `store.ts` as a readability refactor (no behavior change).
