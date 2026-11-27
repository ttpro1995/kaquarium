# Unit Test Instructions — u7-presentation

> Framework: Vitest (+ v8 coverage, jsdom for component tests) + Testing Library (`@testing-library/svelte`). Methodology: TDD red-green-refactor (team affirmation). Strategy: Standard (5–8 tests per component + integration stubs) + mvp 80% line-coverage floor, CI before merge.

## Setup

Workspace-wide config covers this unit (`vitest.config.ts` includes `packages/*/tests`; coverage includes `packages/*/src`). Depends on all six sim units landed (store factory, `register()` entry points, selectors, commands, SaveLoadApi). New deps installed at codegen Step 1 (prod: `pixi.js`, `svelte`, `@sveltejs/vite-plugin-svelte` via root Vite config, `vite-plugin-pwa`; dev/test: `axe-core`, `jsdom`, `@testing-library/svelte`); `npm install` at root if `node_modules` is absent; lockfile committed.

## Commands (unit-scoped only)

```bash
# Full U7 suite (shell-logic + render-math + dispatch-wiring + integration + benchmark)
npx vitest run packages/u7-presentation

# With coverage (informational at unit scope; the 80% floor is judged by Build and Test on the full suite)
npx vitest run --coverage packages/u7-presentation

# Typecheck + lint for U7 files
npx tsc --noEmit
npx eslint packages/u7-presentation/src packages/u7-presentation/tests
```

## Expected coverage targets

- 80% line floor (mvp scope add-on; checked by Build and Test on the assembled full suite, not on this unit's run alone).
- New/changed shell-logic lines in this unit should be ~100% covered by its own tests. Renderer visuals are verified via catalog snapshot + soak per NFR5.1, not line coverage (tech-stack decision).

## Mocking/stubbing guidance

- Do not mock the sim: use the real U1 store/bus/registry + all six real sim units for dispatch and integration tests.
- Pixi `Application`/stage is stubbed in component tests (assert mount/dispatch/prop wiring, never pixels); procedural sprite mapping, steering, and lighting are pure modules tested directly without Pixi.
- Minimal species fixtures (maturity/lifespan/adultSize/genes + catalogue tokens); never the full 30-species data except the Store screen's 30-row list test.
- RNG: fixed seeds via `ctx.rng`; no `Math.random`/`Date.now` in tests or src.

## Test data management

- 100-fish benchmark save builder (deterministic seed, shared shape with sim fixtures) for the NFR1.1 frame/soak probes.
- axe-core audit runs against the mounted shell in jsdom (component-level; full-page keyboard walkthrough stays manual, recorded in code-summary as not-executed with reason).
- Catalog snapshot fixture (species → expected sprite token map) for the procedural mapping test.
