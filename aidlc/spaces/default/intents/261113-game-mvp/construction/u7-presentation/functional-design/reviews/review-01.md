## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-25T13:31:13Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/frontend-components.md > api_integration commands feeding.feed and feeding.scheduleAuto | The two feeding command names U7 tells the developer to dispatch do not exist in the owning unit. U4's command catalogue owns feeding.buyFood, feeding.feedFish, feeding.feedFry, and feeding.setAutoFeeder; there is no feeding.feed and no feeding.scheduleAuto, so both dispatches would return UNKNOWN_COMMAND and change nothing. | Replace both names with the real U4 commands and their payloads: manual feeding via feeding.feedFish, fry feeding via feeding.feedFry, scheduling via feeding.setAutoFeeder, and state which screen dispatches each. | New |
| R-02 | Critical | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > W36-W47 and frontend-components.md > hierarchy Panels list | No screen owns the feeding, water-management, or settings controls, so the core loop cannot be driven from this UI. The toolbar offers Tank, Store, Breeding, Orders, Roster, Save; the Panels list offers Fish, Roster, Store, Breeding, Orders, Save, Bell. Nothing is assigned to own feeding.buyFood, feeding.feedFish, feeding.feedFry, feeding.setAutoFeeder, tank.waterChange, or the settings.update surface for reducedMotion, autoPauseCritical, and volume, even though FR3.1, FR3.2, FR1.2, and NFR2 depend on them. | Assign every one of those commands and controls to a named screen or tab (new Feeding, Tank, and Settings panels or explicit Tank-tab sections), and state which selectors each screen reads. | New |
| R-03 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > W44 Save/load menu | W44 says Save dispatches saveToSlot and Load dispatches load, but the persistence surface is deliberately not a command. C6 states the save file must work while the clock is paused, is not a simulation action, and U7 calls the SaveLoadApi directly; routing those calls through the command bus would return UNKNOWN_COMMAND. | Reword W44 to say the menu calls the SaveLoadApi directly (saveToSlot, load with confirmStale, exportFile, importFile, listSlots, deleteSlot) and never dispatches them. | New |
| R-04 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > W38 HUD, toolbar, time controls and frontend-components.md > Hud actions plus api_integration commands | The speed and pause wiring is ambiguous and incomplete. W38 says the pause and x1, x2, x4 controls dispatch settings.update-family speed commands, and the command list names only settings.update, while U1 W3 defines three dispatch targets for this surface: settings.update, clock.setSpeed, and clock.setPaused, with the invariant paused equals speed 0. | Name the exact command per control (speed changes via clock.setSpeed, pause and resume via clock.setPaused or setSpeed 0, settings edits via settings.update) with payloads, so the developer does not guess the settings.update-family mapping. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > header GDD reference | The header cites GDD section 6.12 for save and load, but the GDD has no section 6.12; the living-tank and offline rules are in section 6.1 and the save and load design is in section 9. | Correct the reference to sections 6.1 and 9. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > Screen/state transitions and erDiagram | The transitions paragraph says tabs are a stateless switch while panel state is preserved per tab, which contradicts itself, and the diagram spells the shell entity UISHHELL instead of UISHELL. | Reword the tab-switching rule (stateless navigation with per-tab preserved panel state) and fix the diagram spelling. | New |
| R-07 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > W45 While-you-were-away summary and frontend-components.md > interaction_flows Away modal | Resume behaviour is underspecified against the clock invariant. U1 W6 stops the clock at speed 0 plus paused, and U1's clock machine resumes at speed 1 on unpause, but U7 only says Resume dismisses the modal and the clock resumes without naming the command or the resulting speed. | State the Resume command and resulting speed explicitly. | New |
| R-08 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > W43 Notification bell | W43 labels the bell US12.1 rendering, but US12.1 is mapped only to U6, so U7's traceability correctly omits AC12.1.1. A developer reading W43 alone may expect U7 to own the story. | Clarify that U7 only renders the U6-owned notification queue for FR12.1 and that US12.1 acceptance stays with U6. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| required-sections | PASS per dispatch brief, not independently re-run | No missing-section signal; findings above are about wrong or missing integration content, not absent sections. |
| upstream-coverage | PASS per dispatch brief, not independently re-run | The three mapped criteria are covered; the feeding and water-screen gaps are unmapped UI surface, which this sensor does not check. |
| traceability | PASS per dispatch brief, not independently re-run | The JSON shape is correct for a ui-kind unit with functional-spec.md targets; it does not validate that the named commands exist, which the Critical finding checks by hand. |
| linter, type-check | N/A per dispatch brief, no TS or JS snippets | Nothing to run; the yaml block in frontend-components.md is not code. |

### Summary

The read-only discipline, register ordering, away counts, fault no-rollback rule, and boot behaviour all match their contracts, but the design names two feeding commands that do not exist and leaves feeding, water, and settings controls without any owning screen, so a developer cannot wire the core loop without guessing.
