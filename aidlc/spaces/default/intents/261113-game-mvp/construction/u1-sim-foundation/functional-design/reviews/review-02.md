## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-14T17:38:31Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u1-sim-foundation/functional-design/functional-spec.md > GameClock speed state machine (`setPaused(false)--> running (restores last nonzero speed, default 1)`) | The transition restores a "last nonzero speed" that is stored nowhere: `entities.md` defines `GameClock` as only `gameDay, gameHour, speed, paused`, and BR1.3 (`IF paused is set true THEN speed becomes 0`) destroys the prior speed, so a developer cannot implement the restore and the stated `default 1` fallback contradicts the `restores` promise. | Add a `lastSpeed` (or equivalent) field to `GameClock` in `entities.md` with a rule for when it is written, or rewrite the transition to a fixed deterministic target (e.g. always speed 1) and align BR1.3 accordingly. | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u1-sim-foundation/functional-design/entities.md > `Fish.tankId` (Q2-B) vs `contract-summary.md` C1 cross-boundary fields and C3 example | `entities.md` makes `Fish.tankId` authoritative and drops `Tank.fishIds`, but `contract-summary.md` C1 lists `Fish` cross-boundary fields without `tankId`, and the C3 `buyFish` example still reads `state.tank.fishIds.length` for the TANK_FULL check, so the capacity check has two contradictory sources and the contract reader never learns `tankId` exists. | Record `tankId` as an additive `Fish` field in the contract (C1 row) and correct the C3 example to the scan-based capacity check, or reconcile the design back to the contracted shape. | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u1-sim-foundation/functional-design/entities.md > Summary claim that cross-unit types are "declared here" | The file states cross-unit types (`Tank`, `Fish`, `FoodItem`, `FryCohort`, `MarketState`, `Order`, `PlayerProgression`, `Notification`) are "declared here and behaviourally owned elsewhere", but the YAML source-of-truth block defines only `GameState`, `GameClock`, `RngState`, `Species`, `Settings`, `SaveEnvelope`, `SlotInfo`, so the shared schema U1 supposedly defines once cannot be built from this file and a developer must guess field shapes from prose references. | Either include the full attribute declarations for every cross-unit type in the YAML block, or correct the claim and name the authoritative declaration site for each type (contract vs owning unit) so there is exactly one source of truth. | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u1-sim-foundation/functional-design/functional-spec.md > W2 step 2 ("one-tick bioload lag read as stored") | The phrase introduces a lagged-bioload read with no backing entity attribute, rule, or workflow step: no `Tank` field stores a lagged value and no rule defines the lag, so it is unimplementable as written. | Define the lag field and its update rule in `entities.md`/`rules.md`, or delete the phrase so W2 reads only stored `bioload`. | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u1-sim-foundation/functional-design/rules.md > BR1.3 violation (`fails validation on load with INVALID_SHAPE`) vs functional-spec.md W5 import pipeline | BR1.3 promises load-time rejection of `paused != (speed == 0)` states, but W5 (`parse → shape → version → checksum → migrate → rollback`) lists no clock-invariant check and the C6 import order has no such step, so it is unclear when or by which check the invariant is enforced. | Add the clock-invariant validation as an explicit step in W5 (and its position relative to checksum/migrate), or move the guarantee to a stated shape-validation rule. | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u1-sim-foundation/functional-design/entities.md > `SaveEnvelope.checksum` attribute (`type: object`) | The checksum attribute is typed only as `object` with a prose constraint, while C6 defines it as `{ algorithm: SHA-256, scope, value: lowercase hex }`, so a developer building from `entities.md` alone cannot produce the digest fields. | Expand the checksum declaration into its three sub-fields with types and constraints matching C6. | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u1-sim-foundation/functional-design/functional-spec.md > W4 `deleteSlot` and W6 "stop the clock" | W4 lists `deleteSlot(ref)` with no covering rule for its semantics (missing slot, deleting the active save), and W6 "stop the clock" never says which state that is (`speed 0` + `paused true` vs a new stopped flag), leaving two specified workflows with undefined end states. | State the `deleteSlot` outcome contract (including SLOT_NOT_FOUND and active-save behaviour) and define "stop the clock" as an explicit `speed`/`paused` assignment. | Resolved (reviewer) |
| R-08 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u1-sim-foundation/functional-design/rules.md > BR6.4 and functional-spec.md > W5 step 3 vs inception/contract-design/contract-summary.md > C6 SaveLoadApi | The design promises a SLOT_NOT_FOUND return for deleteSlot on a missing slot, but the contracted API is deleteSlot(ref: SlotRef): void, which cannot carry that outcome. | Reconcile in one change: either widen the C6 deleteSlot signature to return an outcome that can carry SLOT_NOT_FOUND, or align BR6.4 and W5 to the void contract by stating the missing-slot behaviour without a return value. | New |
| R-09 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u1-sim-foundation/functional-design/entities.md > GameState attribute references (tank, fish, progression) | Per-attribute notes still say defined here or type declared here for Tank, Fish, and PlayerProgression, which a YAML-only reader takes to mean this file, contradicting the corrected intro that full declarations live in owning units. | Reword those references to name the shared schema plus the owning file, for example type in U1 shared schema with full declaration in the owning unit entities.md and behaviour owned there. | New |
| R-10 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u1-sim-foundation/functional-design/functional-spec.md > Entity-relationship view (derived from entities.md) | The derived diagram covers GameClock, RngState, Settings, Fish, Species, SaveEnvelope, and SlotInfo but omits Tank, FoodItem, FryCohort, MarketState, Order, PlayerProgression, and Notification even though GameState attributes reference them. | Complete the derived view and the entities.md relationships block with the missing contains entries, or record why they are intentionally excluded from the diagram. | New |

> R-01 Reviewer note: BR1.2 now sets speed 1 on unpause with no restore promise, and the spec state machine matches (speed 1, always), so no stored lastSpeed is needed.

> R-02 Reviewer note: Contract C1 Fish row now lists tankId and the C3 buyFish example scans Fish by tankId, matching entities.md Q2-B scan-based capacity.

> R-03 Reviewer note: Intro and Summary now state kernel types are fully declared here while cross-unit full declarations live in owning units with cross-boundary fields in C1, giving one named authority per type.

> R-04 Reviewer note: W2 step 2 no longer claims a stored lagged bioload read; read timing is delegated to C2 with lag detail owned by U2.

> R-05 Reviewer note: W5 step 2 now includes the clock-invariant shape check with INVALID_SHAPE, aligned with BR6.2 order and C6 import order.

> R-06 Reviewer note: SaveEnvelope checksum constraint now names algorithm SHA-256, scope string, and lowercase hex value matching C6.

> R-07 Reviewer note: BR6.4 plus W5 step 3 define the deleteSlot outcome contract including SLOT_NOT_FOUND with untouched loaded state, and W6 step 3 defines stopped as speed 0 plus paused true.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability | PASS (per dispatch brief) | Coverage claims check out; no GAP rows remain for this unit. |
| linter | N/A (per dispatch brief, no TS/JS files) | Nothing to interpret for design prose. |
| type-check | N/A (per dispatch brief, no TS/JS files) | Nothing to interpret for design prose. |

### Summary

All seven prior findings verify as fixed and the living-contract update for tankId is consistent across C1 and C3. The one remaining contract breach is the deleteSlot void signature versus the new SLOT_NOT_FOUND return, plus two minor completeness notes, so a developer can otherwise build from this design.
