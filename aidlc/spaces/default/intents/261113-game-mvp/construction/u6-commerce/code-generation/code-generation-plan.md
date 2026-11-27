# Code Generation Plan — u6-commerce

## Summary

- Builds: U6 Commerce & Progression library (commerce/notify systems, buy/sell/bulk/fulfil/dismiss commands, mapper, selectors, events)
- Touches: `packages/u6-commerce/` (new); no U1 changes (consumes v2 shape + register rows from the U2 pass)
- Tests: 5 files, ~32 tests (unit + command-bus integration + golden replay + benchmark probe)

## Steps

### Step 1: Project structure and production configuration skeleton. (US6.1–US8.1, US12.1)
- [x] Create `packages/u6-commerce/package.json` (name `@aquarium/u6-commerce`, type module, no new deps), `tsconfig.json` (extends root, strict), `src/` + `tests/` dirs.

### Step 2: Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.
- [x] Verify `vitest run packages/u6-commerce` executes (empty suite green); command recorded in `unit-test-instructions.md`.

### Step 3: Data model — Red: market/order/progression field tests. (FR6–FR8; BR16–BR18)
- [x] Write failing `packages/u6-commerce/tests/pricing.test.ts`: eight-factor formula bands (size/age/colour/rarity/health/genetics/market, floor 1, sick < 40 unsellable); demand ×0.97/sale, +8%/day recovery, 3-day trend cycle; board generation (3–6, customer params, deadlines); XP sources/thresholds (sale/5, hatch+10, reward/4; L2 200, L3 600); midnight electricity clamp. Record failing output.

### Step 4: Data model — Green: implement price/demand/board/progression state.
- [x] `src/pricing.ts` (sellPrice + factor helpers reading U3 selectors), `src/market.ts` (demand/trend), `src/orders.ts` (generation, fulfil math, expiry), `src/progression.ts` (XP/levels/unlocks).
- [x] Run pricing tests green.

### Step 5: Data model — Refactor while green.
- [x] Share clamp/floor helpers; keep tests green.

### Step 6: Business logic — Red: sell/fulfil/notify tests. (BR16–BR19)
- [x] Write failing `packages/u6-commerce/tests/commerce.test.ts` (10): atomic sell (remove/pay/saturate/XP, Trio events); bulk skip-sick/reject-unknown + dedupe + empty-list; fulfil (precedence, trio orderFulfilled/moneyChanged, no saturation, rep+1); expiry (rep −2 floor 0); cascade level-ups; mapper table (incl. fishSpawned/fishSick nulls); fishSick batch collapse via notify system; queue cap 100 (info→warn, critical overflow) + dismiss. Record failing output.

### Step 7: Business logic — Green: implement commerce + notify systems.
- [x] `src/commerce.ts` (commerce system: recovery→costs→expiry→hatch-XP→upkeep→cache; notify system: fishSick aggregation + away summary), `Fish.value` cache refresh (C2-allowlisted).
- [x] Run commerce tests green.

### Step 8: Business logic — Refactor while green.
- [x] Extract day-boundary order into named steps; keep tests green.

### Step 9: API/endpoint — Red: command + selector tests.
- [x] Write failing `packages/u6-commerce/tests/commands.test.ts` (8): buyFish (trio, TANK_FULL via projectedBioload, NOT_AVAILABLE gates) / sellFish / sellBulk / orders.fulfil / notifications.dismiss via real bus; preview selectors (sellPrice, bulkPreview, orderRewardPreview, buyableSpecies, notificationQueue) without mutation. Record failing output.

### Step 10: API/endpoint — Green: implement commands + mapper + selectors + register.
- [x] `src/commands.ts`, `src/notifications.ts` (mapper + table), `src/selectors.ts`, `src/index.ts` (register systems + commands + notification mapper).
- [x] Run command tests green.

### Step 11: API/endpoint — Refactor while green.
- [x] Consolidate validation/precedence; keep tests green.

### Step 12: Integration tests for key boundaries.
- [x] `packages/u6-commerce/tests/integration.test.ts`: buy → sell → saturation → order fulfil → level-up end-to-end on the real kernel; away-summary counts after catch-up.
- [x] Benchmark probe `packages/u6-commerce/tests/benchmark.test.ts`: 50 warmup, p95-of-300 ≤ 0.125 ms commerce+notify ticks (full board, 100-notification queue); heap < 64 KB/100 ticks (informational).

### Step 13: Documentation and traceability.
- [x] `code-summary.md`, `source-manifest.json`, `traceability.json` mapping BR16–BR19 + NFR1.1/NFR3.1/NFR4.1/NFR4.2/NFR5.1 to the new files.

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
