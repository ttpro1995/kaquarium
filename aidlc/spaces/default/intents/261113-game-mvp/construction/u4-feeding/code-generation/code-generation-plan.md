# Code Generation Plan — u4-feeding

## Summary

- Builds: U4 Feeding library (feeding-phase system, buyFood/feedFish/feedFry/setAutoFeeder commands, selectors, events)
- Touches: `packages/u4-feeding/` (new); no U1 changes (consumes v2 shape + migration from the U2 pass)
- Tests: 5 files, ~30 tests (unit + command-bus integration + golden replay + benchmark probe)

## Steps

### Step 1: Project structure and production configuration skeleton. (US3.1, US3.2)
- [x] Create `packages/u4-feeding/package.json` (name `@aquarium/u4-feeding`, type module, no new deps), `tsconfig.json` (extends root, strict), `src/` + `tests/` dirs.

### Step 2: Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.
- [x] Verify `vitest run packages/u4-feeding` executes (empty suite green); command recorded in `unit-test-instructions.md`.

### Step 3: Data model — Red: stock/schedule field tests. (FR3.1; BR12)
- [x] Write failing `packages/u4-feeding/tests/stock.test.ts`: buyFood appends dated stacks (kind/qty/price, money deducts, trio of validation rejections); expiry by game day (expired stacks visible, never dispense); schedule state shape. Record failing output.

### Step 4: Data model — Green: implement stock + schedule state.
- [x] `src/food.ts` (FoodItem helpers, expiry predicates, oldest-first usable order); `src/schedule.ts` (FeedingSchedule state, lastRunHour init).
- [x] Run stock tests green.

### Step 5: Data model — Refactor while green.
- [x] Share portion/price math; keep tests green.

### Step 6: Business logic — Red: feeding/dispensing tests. (US3.2 AC3.2.1–AC3.2.2; BR13)
- [x] Write failing `packages/u4-feeding/tests/feeding.test.ts` (10): manual feed restores satiety (round(25×quality), ascending-satiety order); overfeeding leftover → waste + overfed; depleted stack removed + foodOut; fry feeding (10 fry/portion, day idempotency, eggs rejected); auto-feeder interval runs + backlog-never + silent skip on no stock; schedule set/clear validation. Record failing output.

### Step 7: Business logic — Green: implement feeding-phase system.
- [x] `src/feeding.ts`: registered `u4.feeding` system (feeding phase: auto-feeder run, expiry sweep + foodOut once per stack) + C2-allowlisted writes (tank waste, Fish.satiety, feedFry counters).
- [x] Run feeding tests green.

### Step 8: Business logic — Refactor while green.
- [x] Extract dispense/validation helpers; keep tests green.

### Step 9: API/endpoint — Red: command + event tests. (US3.1; C2 purchase-path)
- [x] Write failing `packages/u4-feeding/tests/commands.test.ts` (7): buyFood/feedFish/feedFry/setAutoFeeder via real bus (validate-first, atomic, moneyChanged on buys, fed/overfed/foodOut events); NOT_AVAILABLE paths (device, expiry, dryness); day-idempotent counter writes. Record failing output.

### Step 10: API/endpoint — Green: implement commands + events + register.
- [x] `src/commands.ts`, `src/events.ts` (fed/overfed/foodOut augmentation), `src/selectors.ts` (foodStock, usableFood, feedingProgram), `src/index.ts` (register).
- [x] Run command tests green.

### Step 11: API/endpoint — Refactor while green.
- [x] Consolidate validation; keep tests green.

### Step 12: Integration tests for key boundaries.
- [x] `packages/u4-feeding/tests/integration.test.ts`: feed → satiety → U3 growth reads it; overfeed → waste → U2 band flip; schedule fires across catch-up ticks identically.
- [x] Benchmark probe `packages/u4-feeding/tests/benchmark.test.ts`: 50 warmup, p95-of-300 ≤ 0.25 ms (4-stack + 24-stack fixtures); heap < 64 KB/100 ticks (informational).

### Step 13: Documentation and traceability.
- [x] `code-summary.md`, `source-manifest.json`, `traceability.json` mapping BR12/BR13 + NFR1.1/NFR3.1/NFR4.1/NFR4.2/NFR5.1 to the new files.

Repository/data-access (shared U1 store) and frontend layers are genuinely inapplicable and omitted without changing TDD methodology.

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
