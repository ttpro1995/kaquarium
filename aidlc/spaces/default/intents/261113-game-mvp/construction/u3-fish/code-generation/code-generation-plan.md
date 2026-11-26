# Code Generation Plan — u3-fish

## Summary

- Builds: U3 Fish Lifecycle library (fish-phase tick pass in W12 order, pure spawnFish/inheritGenome factories, selectors, events)
- Touches: `packages/u3-fish/` (new); no U1 changes (consumes the migrated v2 shape — depends on the U2 codegen migration landing first)
- Tests: 5 files, ~30 tests (unit + command-bus integration + golden replay + benchmark probe)

## Dependency

U3 codes against the MIGRATED v2 shape (`WaterChemistry`, structured equipment, tier volumes). The U2 codegen pass executes the `migrateV1ToV2` register first; U3 build starts after that migration exists in the tree (same batch order: U2 then U3).

## Steps

### Step 1: Project structure and production configuration skeleton. (US2.1, US2.2, US4.1–US4.3)
- [ ] Create `packages/u3-fish/package.json` (name `@aquarium/u3-fish`, type module, no new deps), `tsconfig.json` (extends root, strict), `src/` + `tests/` dirs.

### Step 2: Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.
- [ ] Verify `vitest run packages/u3-fish` executes (empty suite green); command recorded in `unit-test-instructions.md`.

### Step 3: Data model — Red: Fish field-rule tests. (FR4.1–FR4.3; BR11.1)
- [ ] Write failing `packages/u3-fish/tests/fields.test.ts`: spawnFish builds juvenile per BR11.1 field rules (sex 50/50 seeded, size 50–70%, genome rolled, parents set, stunted false, value cached); spawnFish mutates nothing and emits nothing. Record failing output.

### Step 4: Data model — Green: implement factories + selectors.
- [ ] `src/factories.ts` (`spawnFish`, `inheritGenome` — pure, rng-parameterized); `src/selectors.ts` (growthCondition/healthOf, genomeQuality, colour/rarity loci, price-factor inputs).
- [ ] Run field tests green.

### Step 5: Data model — Refactor while green.
- [ ] Share genome-locus helpers; keep tests green.

### Step 6: Business logic — Red: tick-pass tests in W12 order. (US4.1–US4.3; BR10)
- [ ] Write failing `packages/u3-fish/tests/tick.test.ts` (10): age accrual; growth toward 95% at maturityDays (well-fed vs starved); satiety decay 100/48; health regen/stressors (hunger/water/temp/crowd); sick < 40, critical < 15; juvenile→adult→senior transitions; death causes (starvation/oldAge) + no death while catchUp; tempFit crowdFactor. Record failing output.

### Step 7: Business logic — Green: implement fish-phase system.
- [ ] `src/fish.ts`: registered `u3.fish` system (fish phase, W12 steps 2–7); reads water via U2 selectors, never writes Tank.
- [ ] Run tick tests green.

### Step 8: Business logic — Refactor while green.
- [ ] Extract pure transition functions; keep tests green.

### Step 9: API/endpoint (command bus + events) — Red: buy-path + event tests. (US2.1 AC2.1.1; BR11)
- [ ] Write failing `packages/u3-fish/tests/lifecycle.test.ts` (7): sex distribution ~50/50; death explanations carry cause; maturity events; U6 buyFish trio emission observed through the real bus (U3 asserts its factory emitted nothing; trio asserted at the U6 handler level in U6's suite).
- [ ] Record failing output.

### Step 10: API/endpoint — Green: implement events + register.
- [ ] `src/events.ts` (SimEventMap augmentation for U3-owned variants), `src/index.ts` (`register`: fish system; no commands — U3 owns none, acts via factories + systems).
- [ ] Run lifecycle tests green.

### Step 11: API/endpoint — Refactor while green.
- [ ] Consolidate cause-mapping helpers; keep tests green.

### Step 12: Integration tests for key boundaries.
- [ ] `packages/u3-fish/tests/integration.test.ts`: tick through the real U1 bus+registry with U2 water state (poor water → health falls → fishSick named cause; starvation → death with cause).
- [ ] Benchmark probe `packages/u3-fish/tests/benchmark.test.ts`: 50 warmup, p95-of-300 timed fish-phase ticks ≤ 0.5 ms at 100 fish; heap growth < 64 KB/100 ticks (informational, opens `perf-regression` follow-up on exceedance).

### Step 13: Documentation and traceability.
- [ ] `code-summary.md`, `source-manifest.json`, `traceability.json` via `aidlc engine sensor-traceability --stage code-generation` mapping BR10/BR11 + NFR1.1/NFR3.1/NFR4.1/NFR4.2/NFR5.1 to the new files.

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
