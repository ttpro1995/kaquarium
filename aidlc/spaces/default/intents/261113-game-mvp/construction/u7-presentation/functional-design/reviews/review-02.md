## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-25T13:36:41Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/frontend-components.md > api_integration commands feeding.feed and feeding.scheduleAuto | The two feeding command names U7 tells the developer to dispatch do not exist in the owning unit. U4's command catalogue owns feeding.buyFood, feeding.feedFish, feeding.feedFry, and feeding.setAutoFeeder; there is no feeding.feed and no feeding.scheduleAuto, so both dispatches would return UNKNOWN_COMMAND and change nothing. | Replace both names with the real U4 commands and their payloads: manual feeding via feeding.feedFish, fry feeding via feeding.feedFry, scheduling via feeding.setAutoFeeder, and state which screen dispatches each. | Resolved (reviewer) |
| R-02 | Critical | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > W36-W47 and frontend-components.md > hierarchy Panels list | No screen owns the feeding, water-management, or settings controls, so the core loop cannot be driven from this UI. The toolbar offers Tank, Store, Breeding, Orders, Roster, Save; the Panels list offers Fish, Roster, Store, Breeding, Orders, Save, Bell. Nothing is assigned to own feeding.buyFood, feeding.feedFish, feeding.feedFry, feeding.setAutoFeeder, tank.waterChange, or the settings.update surface for reducedMotion, autoPauseCritical, and volume, even though FR3.1, FR3.2, FR1.2, and NFR2 depend on them. | Assign every one of those commands and controls to a named screen or tab (new Feeding, Tank, and Settings panels or explicit Tank-tab sections), and state which selectors each screen reads. | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > W44 Save/load menu | W44 says Save dispatches saveToSlot and Load dispatches load, but the persistence surface is deliberately not a command. C6 states the save file must work while the clock is paused, is not a simulation action, and U7 calls the SaveLoadApi directly; routing those calls through the command bus would return UNKNOWN_COMMAND. | Reword W44 to say the menu calls the SaveLoadApi directly (saveToSlot, load with confirmStale, exportFile, importFile, listSlots, deleteSlot) and never dispatches them. | Resolved (reviewer) |
| R-04 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > W38 HUD, toolbar, time controls and frontend-components.md > Hud actions plus api_integration commands | The speed and pause wiring is ambiguous and incomplete. W38 says the pause and x1, x2, x4 controls dispatch settings.update-family speed commands, and the command list names only settings.update, while U1 W3 defines three dispatch targets for this surface: settings.update, clock.setSpeed, and clock.setPaused, with the invariant paused equals speed 0. | Name the exact command per control (speed changes via clock.setSpeed, pause and resume via clock.setPaused or setSpeed 0, settings edits via settings.update) with payloads, so the developer does not guess the settings.update-family mapping. | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > header GDD reference | The header cites GDD section 6.12 for save and load, but the GDD has no section 6.12; the living-tank and offline rules are in section 6.1 and the save and load design is in section 9. | Correct the reference to sections 6.1 and 9. | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > Screen/state transitions and erDiagram | The transitions paragraph says tabs are a stateless switch while panel state is preserved per tab, which contradicts itself, and the diagram spells the shell entity UISHHELL instead of UISHELL. | Reword the tab-switching rule (stateless navigation with per-tab preserved panel state) and fix the diagram spelling. | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > W45 While-you-were-away summary and frontend-components.md > interaction_flows Away modal | Resume behaviour is underspecified against the clock invariant. U1 W6 stops the clock at speed 0 plus paused, and U1's clock machine resumes at speed 1 on unpause, but U7 only says Resume dismisses the modal and the clock resumes without naming the command or the resulting speed. | State the Resume command and resulting speed explicitly. | Resolved (reviewer) |
| R-08 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/functional-spec.md > W43 Notification bell | W43 labels the bell US12.1 rendering, but US12.1 is mapped only to U6, so U7's traceability correctly omits AC12.1.1. A developer reading W43 alone may expect U7 to own the story. | Clarify that U7 only renders the U6-owned notification queue for FR12.1 and that US12.1 acceptance stays with U6. | Resolved (reviewer) |
| R-09 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/frontend-components.md > header (line 3) | The header says the file implements the screens in functional-spec.md (W36–W47), but the spec now runs W36–W49, so a developer following the pointer misses the Feeding panel and Tank-tab Care plus Settings work. | Update the range to W36–W49. | New |
| R-10 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/frontend-components.md > Panels SavePanel actions | SavePanel lists actions saveToSlot, loadSlot, exportFile, importFile, but W44 requires a Delete path calling deleteSlot(ref), so the component action list does not cover a specified menu operation. | Add deleteSlot to the SavePanel actions. | New |
| R-11 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/functional-design/frontend-components.md > api_integration selectors | The selectors checklist omits cohortsInTank even though W48 feeds fry cohorts from U5's cohortsInTank (verified to exist in the U5 selector set) and the FeedingPanel validation depends on a fry-cohort picker. | Add cohortsInTank (and pairsInTank if the breeding screen reads through this integration list) to the selectors list. | New |

> R-01 Reviewer note: frontend-components.md api_integration now lists only feeding.buyFood, feeding.feedFish, feeding.feedFry, feeding.setAutoFeeder; W48 carries the same four names with payloads matching the U4 catalogue, and the old feeding.feed / feeding.scheduleAuto names are gone from both design files.

> R-02 Reviewer note: W48 Feeding panel and W49 Tank-tab Care sections plus Settings panel own every previously orphaned command (feeding.buyFood/feedFish/feedFry/setAutoFeeder, tank.waterChange/buyEquipment/upgradeTier, settings.update for reducedMotion/autoPauseCritical/volume), with owning screens and read selectors stated; toolbar and Panels list the 8-tab set with the Q3 amendment recorded.

> R-03 Reviewer note: W44 now states persistence is deliberately not a command and the menu calls the SaveLoadApi directly (saveToSlot, load with confirmStale, deleteSlot, exportFile, importFile) and never dispatches; save_note in frontend-components.md states the same.

> R-04 Reviewer note: W38 names the exact command per control (speed via clock.setSpeed, pause/resume via clock.setPaused, settings edits via settings.update) with payloads and the BR1.2 resume-at-1 semantic; Hud commands map matches U1 W3.

> R-05 Reviewer note: Header cites GDD §6.1/§7/§9; the nonexistent §6.12 reference is gone.

> R-06 Reviewer note: Transitions now read as stateless navigation with per-tab preserved panel state, and the diagram spells the shell entity UISHELL.

> R-07 Reviewer note: W45 Resume names clock.setPaused { paused: false } restarting at speed 1 per U1 BR1.2, and the Away-modal interaction flow states the same.

> R-08 Reviewer note: W43 carries the ownership note that US12.1/AC12.1.1 stay with U6 and U7 only renders the U6-owned queue.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| required-sections | PASS per dispatch brief | No missing-section concern carried into this pass. |
| upstream-coverage | PASS per dispatch brief | AC1.1.1, AC1.1.2, AC11.1.1 covered; US12.1 correctly left with U6. |
| traceability | PASS per dispatch brief | Coverage rows target functional-spec.md, permitted for a ui-kind unit. |
| linter / type-check | N/A per dispatch brief | No runnable TS/JS snippets in these artifacts; the frontend-components yaml block is design data, not code. |

### Summary

All eight iteration-1 findings verify as fixed against the owning units' contracts, with command names and payloads matching U4, U1, and U2 catalogues exactly. Three minor documentation inconsistencies remain in frontend-components.md, none blocking implementation. A developer can build from this design without architectural guesswork.
