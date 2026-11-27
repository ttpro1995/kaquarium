# Code Generation Plan — u7-presentation

## Summary

- Builds: U7 Presentation shell (Svelte 5 UI + PixiJS 8 tank canvas + composition root + PWA shell) over the read-only store and command bus; all screens W36–W49
- Touches: `packages/u7-presentation/` (new); root `vite.config.ts`, `index.html`, `eslint.config.js` (Svelte plugin), `package.json`/`package-lock.json` (new deps)
- Tests: 6 files, ~35 tests (shell-logic unit + render-math unit + dispatch-wiring via real kernel + boot/integration + benchmark/soak probes)

## Dependency

U7 codes against the LANDED v2 shape and all six sim units (U1 store/registry + U2–U6 `register()` entry points, selectors, commands, SaveLoadApi). Same-batch order: U7 last (batch 3), after batch 2 (U2–U6) converged and merged.

## Steps

### Step 1: Project structure and production configuration skeleton. (US1.1; W47)
- [ ] Create `packages/u7-presentation/package.json` (name `@aquarium/u7-presentation`, type module; prod deps `pixi.js@^8.23.0`, `svelte@^5.59.1`; dev `vite-plugin-pwa@^2.0.0`, `axe-core@^4.14.1`, `@sveltejs/vite-plugin-svelte`, `jsdom`, `@testing-library/svelte` — versions pinned at install, lockfile committed), `tsconfig.json` (extends root, strict), `src/` + `tests/` dirs.
- [ ] Root: `vite.config.ts` (Svelte plugin + PWA manifest + service worker, offline-first), `index.html` (app mount), `eslint.config.js` (+ Svelte plugin, CI-blocking per tech decision).

### Step 2: Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.
- [ ] `npm install` (new deps only; sim packages stay dependency-free); verify `vitest run --coverage packages/u7-presentation` executes (empty suite green); record command in `unit-test-instructions.md` (already written).

### Step 3: Data model — Red: shell-store binding tests. (C1; W38)
- [ ] Write failing `packages/u7-presentation/tests/store.test.ts`: shell store wrapper subscribes to the real U1 store, snapshots selectors on `version` bumps only (no per-tick re-read), never writes `GameState` (mutation attempt surface: none — wrapper exposes read + `dispatch` only); settings diffing emits changed fields only. Record failing output.

### Step 4: Data model — Green: implement store bindings + settings diff.
- [ ] `src/shell/store.ts` (version-bump subscription, selector snapshots), `src/shell/settings.ts` (changed-fields diff for `settings.update`).
- [ ] Run store tests green.

### Step 5: Data model — Refactor while green.
- [ ] Share snapshot memoization; keep tests green.

### Step 6: Business logic — Red: render-math + panel-helper tests. (W36/W37; BR20)
- [ ] Write failing `packages/u7-presentation/tests/render.test.ts` (8): boids steering (separation/alignment/cohesion, render-side only, zero per-frame allocation); lighting tint from `gameDay`/`gameHour` (smooth); reducedMotion (ambient frozen, snap tint, minimal-amplitude swimming, no darting); sprite-per-fish mapping (palette/pattern/fin tokens); bulk-selection set ops; preview formatting (sell/bulk/order/grade previews pass through U6/U5 selectors unchanged); deadline countdowns. Record failing output.

### Step 7: Business logic — Green: implement render math + panel helpers.
- [ ] `src/tank/steering.ts` (allocation-free boids), `src/tank/lighting.ts`, `src/tank/sprites.ts` (procedural mapping), `src/panels/helpers.ts` (selection, formatting, countdowns).
- [ ] Run render tests green.

### Step 8: Business logic — Refactor while green.
- [ ] Extract pure math (vector ops, tint curves) from the tick closures; keep tests green.

### Step 9: API/endpoint (dispatch wiring) — Red: command + save tests. (W38–W44, W48–W49)
- [ ] Write failing `packages/u7-presentation/tests/dispatch.test.ts` (8): every panel action dispatches through the REAL kernel bus (buy/sell/bulk/fulfil/dismiss, pair/unpair/grade, waterChange/buyEquipment/upgradeTier, buyFood/feedFish/feedFry/setAutoFeeder, setSpeed/setPaused/settings.update); `ok` → refresh-from-store, `err` → named message at the originating row (funds/unlock/health/egg/not-ready precedence visible); save menu calls SaveLoadApi directly (never the bus): saveToSlot/load (STALE_SAVE → confirm dialog, never silent overwrite)/deleteSlot/exportFile/importFile (CORRUPT_JSON / INVALID_SHAPE / UNSUPPORTED_VERSION / CHECKSUM_MISMATCH surface, current save untouched). Record failing output.

### Step 10: API/endpoint — Green: implement dispatch wiring + save menu + panels.
- [ ] `src/panels/*.svelte` (Hud, Toolbar, TankCanvas shell, FishPanel, RosterPanel, StorePanel, FeedingPanel, BreedingPanel, OrdersPanel, TankPanel, SavePanel, SettingsPanel, BellPanel), `src/shell/outcomes.ts` (ok/err mapping), `src/save/menu.ts`.
- [ ] Pixi `Application`/stage lives only inside `TankCanvas` mount; component tests stub the Pixi stage (renderer visuals verified via catalog snapshot + soak per NFR5.1, not unit tests).
- [ ] Run dispatch tests green.

### Step 11: API/endpoint — Refactor while green.
- [ ] Consolidate outcome-message mapping; keep tests green.

### Step 12: Integration tests for key boundaries.
- [ ] `packages/u7-presentation/tests/integration.test.ts`: boot composition root (store factory + all six `register()` calls in any order + mount; C5 catalogue validation excludes invalid entries without crash); away-summary flow (catch-up → one modal → Resume dispatches setPaused false → speed 1); fault boundary (throwing system → fault panel → reload-to-autosave, no rollback); bell focus flow (notification click → Tank tab + camera focus + FishPanel).
- [ ] Benchmark/soak `packages/u7-presentation/tests/benchmark.test.ts`: render-isolated probe, sim paused: render-only p95 ≤ 12 ms at 100 fish; total p95 ≤ 20 ms at x1; x4 burst (4 queued ticks before a measured frame) p95 ≤ 20 ms; x4 soak 60 s → version delta exactly 240 game-hours, max frame ≤ 50 ms, zero dropped ticks; reduced-motion within 5% of full motion; heap < 256 KB over 1000 frames (informational, opens `perf-regression` follow-up on exceedance).

### Step 13: Documentation and traceability.
- [ ] `code-summary.md` (files, decisions, coverage, deviations); `source-manifest.json`; `traceability.json` via `aidlc engine sensor-traceability --stage code-generation` mapping US1.1/US11.1 + FR1.1/FR1.2/FR1.3/FR3.1/FR3.2/FR9.1–FR9.3/FR10.1/FR12.1 + NFR1.1/NFR1.2/NFR1.3/NFR2/NFR5.1 + BR20 (W36–W49) + AC1.1.1/AC1.1.2/AC2.1.2/AC11.1.1 + C1/C2/C4/C5/C6 to the new files.

Repository/data-access layers are the shared U1 store (read-only from U7) and are genuinely inapplicable as built code; no UI test doubles of the sim — integration runs the real kernel + all six sim units.

## Assumptions

- New runtime deps (`pixi.js`, `svelte`, `@sveltejs/vite-plugin-svelte`, `vite-plugin-pwa`) and test-only dev deps (`axe-core`, `jsdom`, `@testing-library/svelte`) are added by this plan (Step 1); sim packages stay dependency-free. See Test instructions.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "tdd",
  "source": "team",
  "ordering": "write each test before the code it verifies, then implement until the test passes.",
  "scope": "mvp",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop`, `classic` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: tdd\n- **Methodology evidence**: the human affirmed test-first development. We write\n  the test before the code, watch it fail, then implement the minimum code that\n  makes it pass (red-green-refactor). Writing the test first pins each behavior\n  to a verifiable, runnable check before implementation begins, so no behavior\n  ships without a test that demands it.\n- **Ordering**: write each test before the code it verifies, then implement until the test passes.\n- **Coverage floor (mvp scope)**: 80% line coverage, with tests run in CI before\n  merge; the `mvp` scope adds this floor on top of the selected test strategy."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Meet an 80% line-coverage floor.",
      "Run the selected tests in CI before merge."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "tdd",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - Red: write the failing tests and record the failing command output.",
      "Data model / database behavior - Green: implement only enough behavior to pass.",
      "Data model / database behavior - Refactor: improve the implementation while tests stay green.",
      "Repository / data access - Red: write the failing tests and record the failing command output.",
      "Repository / data access - Green: implement only enough behavior to pass.",
      "Repository / data access - Refactor: improve the implementation while tests stay green.",
      "Business logic - Red: write the failing tests and record the failing command output.",
      "Business logic - Green: implement only enough behavior to pass.",
      "Business logic - Refactor: improve the implementation while tests stay green.",
      "API / endpoint - Red: write the failing tests and record the failing command output.",
      "API / endpoint - Green: implement only enough behavior to pass.",
      "API / endpoint - Refactor: improve the implementation while tests stay green.",
      "Frontend behavior - Red: write the failing tests and record the failing command output.",
      "Frontend behavior - Green: implement only enough behavior to pass.",
      "Frontend behavior - Refactor: improve the implementation while tests stay green.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:f543d7c49c2d4c47988f2e1d0be15fcff4e660c9e4c2c1bb1f35ad14e46b53fa",
  "contract_sha256": "sha256:e0041f12fc57d8e3b45f8b7c6f9b980975d6988fd6a983f0d933f7e2b3b89019"
}
```
