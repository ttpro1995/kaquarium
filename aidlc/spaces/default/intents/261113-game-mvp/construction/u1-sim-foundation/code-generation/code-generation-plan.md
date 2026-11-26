# Code Generation Plan — u1-sim-foundation

## Summary

- Builds: shared-kernel library (store, tick, commands, drain, species, persistence, catch-up) with Vitest suite
- Touches: `package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `packages/u1-sim-foundation/src/**`, `packages/u1-sim-foundation/tests/**`
- Tests: 5–8 per kernel component plus boundary integration probes, TDD Red/Green/Refactor, 80% line floor checked on the full suite

## Steps

- [x] Step 1: Project skeleton — `package.json` (Vite, Vitest, TypeScript), `tsconfig.json` (strict), `vitest.config.ts`, `eslint.config.js` (includes NFR3.2 `no-restricted-properties` + `no-restricted-globals` banned-API rules), `packages/u1-sim-foundation/` layout. (Supports all US9–US11 work.)
- [x] Step 2: Bootstrap the Vitest runner and record the unit-scoped command in `unit-test-instructions.md`; verify it runs (0 tests, green).
- [x] Step 3: Types + store Red — failing tests for `GameState`/`GameClock` (incl. BR1.3 `paused == (speed == 0)` invariant)/`RngState`/`Species`/`Settings`/`SaveEnvelope`/`SlotInfo`, `canonicalJson` pinning, read-only selectors. (US9.1–US11.1; BR1.3)
- [x] Step 4: Types + store Green — minimal implementation to pass.
- [x] Step 5: Types + store Refactor — improve while green.
- [x] Step 6: RNG + tick pipeline + registry Red — seeded stream replay, phase order feeding → water → fish → breeding → commerce → notify, duplicate registration throws, exhaustiveness gate. (AC10.2.1; BR1.1, BR2.1, BR4.1, BR4.2)
- [x] Step 7: RNG + tick pipeline + registry Green — minimal implementation.
- [x] Step 8: RNG + tick pipeline + registry Refactor — improve while green.
- [x] Step 9: Command bus + event drain Red — `settings.update`/`clock.setSpeed`/`clock.setPaused` validate-then-mutate, rejected commands touch nothing, drain-then-bump-then-dirty, subscriber isolation, `getFault()` empty by default. (AC10.1.1; BR1.2, BR3.1)
- [x] Step 10: Command bus + event drain Green — minimal implementation.
- [x] Step 11: Command bus + event drain Refactor — improve while green.
- [x] Step 12: Species catalog + persistence Red — catalogue validation (fail loudly dev / exclude-and-log prod), autosave rotation + verify-before-swap + fallback, export/import pipeline (shape + clock-invariant → version → checksum → migrate → rollback), recursive `__proto__`/`constructor`/`prototype` rejection, sync bundled SHA-256 digest, `deleteSlot` contract ( incl. SLOT_NOT_FOUND). (AC9.1.1, AC9.2.1, AC9.3.1, AC9.3.2; BR5.1, BR6.1–BR6.4; NFR4.1–NFR4.4)
- [x] Step 13: Species catalog + persistence Green — minimal implementation.
- [x] Step 14: Species catalog + persistence Refactor — improve while green.
- [x] Step 15: Catch-up + fault containment Red — 192-tick cap with `catchUp=true` threading, `whileYouWereAway` summary event, halt + discard + `getFault()` + U7-pollable reload offer, stopped clock as speed 0 + paused. (AC11.1.1; BR7.1; NFR4.2)
- [x] Step 16: Catch-up + fault containment Green, then Refactor while green.
- [x] Step 17: SaveLoadApi surface + selectors Red/Green/Refactor — `autosave`/`saveToSlot`/`listSlots`/`load`/`deleteSlot`/`exportFile`/`importFile`, `SlotInfo` rows, re-read-after-load behavior. (US9.1–US9.3)
- [x] Step 18: Benchmark harness (test-only, not shipped) — headless 100-fish tick probe (NFR1.1 protocol), 1/10/50/100 scaling curve (NFR1.3), autosave latency probe (NFR1.4); timings informational in CI, gated on device.
- [x] Step 19: Full unit run + coverage report; record results; hand to Build and Test for the 80% floor verdict on the assembled suite.

## Story-to-step map

| Story / AC | Plan steps |
|---|---|
| US9.1 / AC9.1.1 | 12–14, 17, 19 |
| US9.2 / AC9.2.1 | 12–14, 17, 19 |
| US9.3 / AC9.3.1, AC9.3.2 | 3–5, 12–14, 17, 19 |
| US10.1 / AC10.1.1 | 9–11, 17 |
| US10.2 / AC10.2.1 | 6–8, 19 |
| US11.1 / AC11.1.1 | 15–16 |

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
