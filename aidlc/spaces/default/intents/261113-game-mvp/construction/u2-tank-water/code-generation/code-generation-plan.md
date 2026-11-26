# Code Generation Plan — u2-tank-water

## Summary

- Builds: U2 Tank & Water library (water system, equipment/tier commands, selectors, events) plus the v1→v2 migration executing the breaking-change register
- Touches: `packages/u2-tank-water/` (new); `packages/u1-sim-foundation/src/types.ts`, `persistence/persistence.ts` (Tank alignment + migration + barrier); `contract-summary.md` C1 Tank row
- Tests: 5 files, ~30 tests (unit + command-bus integration + migration + benchmark probe)

## Steps

### Step 1: Project structure and production configuration skeleton. (US1.2, US1.3)
- [ ] Create `packages/u2-tank-water/package.json` (name `@aquarium/u2-tank-water`, type module, no new deps), `tsconfig.json` (extends root, strict), `src/` + `tests/` dirs.

### Step 2: Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.
- [ ] Verify workspace-wide `vitest run --coverage packages/u2-tank-water` executes (empty suite green); record command in `unit-test-instructions.md` (already written).

### Step 3: Data model — Red: Tank alignment + migration tests first. (FR1.2, FR1.3; NFR4.1)
- [ ] Write failing `packages/u2-tank-water/tests/migration.test.ts`: v1 fixture (water {waste,temperature,ph}, equipment string[], volumeL 50, no latches) → migrated equals fresh v2 (water {waste,nitrate,tempC}, structured equipment, tier volumes 20/60/150, latches derived, `Fish.stunted=false`, feeding defaults, `pairs={}`, commerce defaults); record failing output.
- [ ] Write failing import-barrier tests (oversize text, banned key, over-count, out-of-range chemistry, hand-stamped v2 missing latches); record failing output.

### Step 4: Data model — Green: implement alignment + migration + barrier.
- [ ] Edit `packages/u1-sim-foundation/src/types.ts`: `TankWater {waste,nitrate,tempC}`, structured `Equipment`, `Tank` latch fields, tier-volume pairing, `defaultTank()` update, `GameState.pairs`, `FoodItem.acquiredDay/target`, `FryCohort` counters, `MarketState.lastTrendDay`, `Order` commerce fields, `Notification.subjectId?`.
- [ ] Add `migrateV1ToV2` in `persistence/` + extend `validateStateShape` (pre-parse size gate, count caps, chemistry ranges, required-field + genome-is-record checks).
- [ ] Update `contract-summary.md` C1 Tank row + C5 if a meaning changed.
- [ ] Run migration + barrier tests green.

### Step 5: Data model — Refactor while green.
- [ ] Dedupe derivation helpers (band/latch derivation shared by migration and load); keep tests green.

### Step 6: Business logic — Red: water system tests. (US1.2 AC1.2.1–AC1.2.2; BR8–BR9)
- [ ] Write failing `packages/u2-tank-water/tests/water.test.ts` (8): waste accumulates from bioload+feeding; filter converts waste→nitrate at capacity×maturity; new filter cycles ~10 days; water change dilutes 10–50% for fee; bioload vs volume + 2× waste while overcrowded; overcrowd episode open/re-arm + `tankOvercrowded` once; heater holds 26°C vs 22°C drift; latch edge-transitions (prevQualityBand/tempPoorLatch, late arrivals emit nothing). Record failing output.

### Step 7: Business logic — Green: implement water system + selectors.
- [ ] `src/water.ts`: registered `u2.water` system (water phase) + selectors (`tankWater`, `waterQuality`, `capacity`, `projectedBioload`, `bioloadOf`, `tempFitFor`).
- [ ] Run water tests green.

### Step 8: Business logic — Refactor while green.
- [ ] Extract pure math (conversion, dilution, episode transitions) from the system; keep tests green.

### Step 9: API/endpoint (command bus + events) — Red: equipment/upgrade/water-change tests. (US1.3 AC1.3.1–AC1.3.2; BR9)
- [ ] Write failing `packages/u2-tank-water/tests/equipment.test.ts` (7): buy filter/heater/light/autoFeeder (funds, unlocks incl. `equipment.autofeeder`, TANK_FULL via projectedBioload never head-count); tier upgrade 300/800 keeps heater; heater holds tropical range; unlock NOT_AVAILABLE; INSUFFICIENT_FUNDS atomicity; `moneyChanged` + `equipmentUpgraded`/`tierUpgraded` events.
- [ ] Record failing output.

### Step 10: API/endpoint — Green: implement commands + events + register.
- [ ] `src/commands.ts` (`tank.waterChange`, `tank.buyEquipment`, `tank.upgradeTier`), `src/events.ts` (SimEventMap augmentation: `waterChanged`, `equipmentUpgraded`, `tankOvercrowded`, `fishSick`), `src/index.ts` (`register`: system + commands).
- [ ] Run equipment tests green.

### Step 11: API/endpoint — Refactor while green.
- [ ] Share validation helpers (funds/unlock/capacity checks); keep tests green.

### Step 12: Integration tests for key boundaries.
- [ ] `packages/u2-tank-water/tests/commands.test.ts`: dispatch through the real U1 bus+registry (waterChange fee deducts + emits pair; upgrade deducts + emits pair; rejected calls change nothing, bump nothing).
- [ ] Benchmark probe `packages/u2-tank-water/tests/benchmark.test.ts`: 50 warmup, p95-of-300 timed water-phase ticks ≤ 1.0 ms at 100 fish; heap growth < 64 KB/100 ticks (informational, opens `perf-regression` follow-up on exceedance).

### Step 13: Documentation and traceability.
- [ ] `code-summary.md` (files, decisions, coverage, deviations); `source-manifest.json`; `traceability.json` via `aidlc engine sensor-traceability --stage code-generation` mapping BR8/BR9 + NFR1.1/NFR3.1/NFR4.1–NFR4.3/NFR5.1 to the new files.

Repository/data-access and frontend layers are genuinely inapplicable (shared U1 store; no UI in U2) and omitted without changing TDD methodology.

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
