# Code Generation Plan — u5-breeding

## Summary

- Builds: U5 Breeding library (breeding-phase system, pair/unpair/grade commands, selectors, events, GameState.pairs via the v1→v2 migration)
- Touches: `packages/u5-breeding/` (new); no U1 changes (consumes v2 shape + register rows from the U2 pass)
- Tests: 5 files, ~30 tests (unit + command-bus integration + golden replay + benchmark probe)

## Steps

### Step 1: Project structure and production configuration skeleton. (US5.1–US5.3)
- [x] Create `packages/u5-breeding/package.json` (name `@aquarium/u5-breeding`, type module, no new deps), `tsconfig.json` (extends root, strict), `src/` + `tests/` dirs.

### Step 2: Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.
- [x] Verify `vitest run packages/u5-breeding` executes (empty suite green); command recorded in `unit-test-instructions.md`.

### Step 3: Data model — Red: pair/cohort field tests. (FR5.1–FR5.3; BR14–BR15)
- [x] Write failing `packages/u5-breeding/tests/pairs.test.ts`: pair/unpair validation (eligibility, gravid/cooling re-pair rejected INVALID_SETTING, archetype gate, silent dissolution); cohort construction (fertility roll range, hatchDay, counters zeroed). Record failing output.

### Step 4: Data model — Green: implement pair/cohort state.
- [x] `src/pairs.ts` (BreedingPair helpers), `src/cohorts.ts` (FryCohort helpers); parents genomePool plumbing.
- [x] Run pair tests green.

### Step 5: Data model — Refactor while green.
- [x] Share gate/condition helpers; keep tests green.

### Step 6: Business logic — Red: spawn/survival/grading tests. (BR14–BR15)
- [x] Write failing `packages/u5-breeding/tests/breeding.test.ts` (10): condition-scaled attempts with bound gates (tempFit ≥ 0.5, quality ≥ 40), no punishment on gate failure; livebearer gestation → seeded scaled brood → cooldown; egg laying (fertility 0.6–0.9) → timed hatch; cycleDays cooldown; day-boundary survival decay with newborn grace (ideal ≈ 0.95, neglected ≈ 0.70); stunt flag from first-food test; grading (eggs/not-ready/quantity/TANK_FULL batch formula, remainder stays, U3-rule Fish with parents + inheritGenome + stunted); silent cleanup. Record failing output.

### Step 7: Business logic — Green: implement breeding-phase system.
- [x] `src/breeding.ts`: registered `u5.breeding` system (breeding phase: dissolve dead refs, cooling→paired promotion, attempts, gestation/hatch transitions, midnight decay, XP-relevant event emission).
- [x] Run breeding tests green.

### Step 8: Business logic — Refactor while green.
- [x] Extract attempt-condition and brood-scale functions; keep tests green.

### Step 9: API/endpoint — Red: command + event tests. (US5.1–US5.3)
- [x] Write failing `packages/u5-breeding/tests/commands.test.ts` (7): pair/unpair/grade via real bus (precedence UNKNOWN_ENTITY > INVALID_SETTING; trio breedingStarted/fryHatched/cohortGraded; nothing on rejection); gradePreview selector (capacity + stunt, no mutation). Record failing output.

### Step 10: API/endpoint — Green: implement commands + events + register + selectors.
- [x] `src/commands.ts`, `src/events.ts`, `src/selectors.ts` (pairsInTank, cohortsInTank, breedingReadiness, gradePreview), `src/index.ts` (register).
- [x] Run command tests green.

### Step 11: API/endpoint — Refactor while green.
- [x] Consolidate validation; keep tests green.

### Step 12: Integration tests for key boundaries.
- [x] `packages/u5-breeding/tests/integration.test.ts`: pair → spawn → hatch → feed (U4 feedFry) → grade → stunted adults; hatch XP sighting by U6 (interface check).
- [x] Benchmark probe `packages/u5-breeding/tests/benchmark.test.ts`: 50 warmup, p95-of-300 ≤ 0.125 ms (50-pair/10-cohort fixture); heap < 64 KB/100 ticks (informational).

### Step 13: Documentation and traceability.
- [x] `code-summary.md`, `source-manifest.json`, `traceability.json` mapping BR14/BR15 + NFR1.1/NFR3.1/NFR4.1/NFR4.2/NFR5.1 to the new files.

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
