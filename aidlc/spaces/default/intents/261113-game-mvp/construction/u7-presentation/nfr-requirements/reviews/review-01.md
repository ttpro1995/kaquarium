## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-25T15:03:55Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/performance-requirements.md > NFR1.1 | The 12 ms render share of the 20 ms frame is claimed but never isolated or exercised at the x4 worst case. Verification measures total p95 frame time with the sim running at x1 only, so a build with render at 18 ms passes at x1 and still fails at x4, where the C2 cap packs 4 ticks into one frame and the cited 8 ms per frame sim split (water 4 plus fish 2 plus feeding 1 plus breeding 0.5 plus commerce and notify 0.5) is never tested. | Add an x4 render-budget gate on the calibrated proxy (for example p95 frame time at x4 with the 100-fish save) with a render-isolated probe, or restate NFR1.1 as per-tick sub-caps that compose to 8 ms per frame and verify those at x4. | New |
| R-02 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/performance-requirements.md > NFR1.2 | The x4 soak criteria cannot enforce 50 fps at x4 and cannot be executed as written. A sustained 35 ms frame passes the 40 ms ceiling while violating the frame budget, and a single unrelated hitch fails a zero-tolerance max over about 3000 frames. The expected version count is undefined because no tick rate (game hours per real second at x4) is stated, and the C2 backlog loading state has no owning workflow in W36 through W49. | Define the tick rate so the expected version count is computable, replace the zero-max with a percentile gate at x4 plus a reasoned max, and name the workflow that surfaces backlog accumulation. | New |
| R-03 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/security-requirements.md > NFR2.1 | Verification leans on an axe-core audit of the shell, but axe inspects the DOM while the tank canvas paints fish outside it, and the canvas fish-click path in W39 has no named keyboard equivalent. The keyboard walkthrough covers tabs and dialogs only, so parity for canvas-anchored actions is unproven while the requirement promises every action keyboard-reachable. | Scope the axe audit to the shell DOM explicitly, name the keyboard path for each canvas action (for example the roster panel for fish selection), and extend the walkthrough to exercise it. | New |
| R-04 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/security-requirements.md > NFR5.1 | Renderer coverage is assigned to snapshot plus soak tests without saying what is snapshotted. Sprite appearance derives from deterministic genome tokens while steering and particles use the NFR3.1 local RNG, so a live-tank pixel snapshot would be nondeterministic, and no fixture, frozen-seed rule, tolerance, or environment is given. The carve-out from the 80% line floor leaves renderer code with no measurable bar. | Define the snapshot subject and fixture (for example sprite catalog renders per genome with a frozen seed, or shell DOM structure), the tolerance and environment, and the coverage metric that replaces line coverage for renderer code. | New |
| R-05 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/tech-stack-decisions.md > Dependencies | New dependencies are named without installable versions: pixi.js, Svelte 5, axe-core, and an unnamed PWA plugin. The root package manifest carries none of them, so the pinned-stack claim resolves only to major versions while Pixi 8 and Svelte 5 both break from their predecessors. | Pin installable version ranges for pixi.js, Svelte, axe-core, and the PWA plugin by name, consistent with the workspace manifest. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/security-requirements.md > NFR3.1 | Re-seeded per mount from a local RNG names no entropy source, so a fixed-seed implementation would replay identical motion on every mount without violating any stated rule, and the scope of the ambient-nondeterminism ban for renderer use of Math.random or Date.now is unstated. | State the seed source and whether identical restart motion is accepted, and clarify that the seeded-stream ban covers sim systems only. | New |
| R-07 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/security-requirements.md > NFR2.1 text scaling | The requirement promises text scaling with system settings but verification lists no scaling check. | Add a scaling check such as 200 percent zoom or system font size, or remove the promise. | New |
| R-08 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/security-requirements.md > NFR4.1 defaults | Documented defaults on old saves points to no defaults table, and with schema version 1 there is no older envelope to fixture. | Reference the settings defaults table and name the fixture version the round-trip test uses. | New |
| R-09 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/performance-requirements.md > NFR1.3 | Within 5 percent names no statistic, so full-motion versus reduced-motion comparison is not reproducible. | Name the statistic, for example p95 frame time on the benchmark scene. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| required-sections | PASS per dispatch brief | Structure present; findings are about measurement scope, not missing sections. |
| upstream-coverage | PASS per dispatch brief | W36 through W49 and NFR1 through NFR5 resolve; no dangling cross-reference found. |
| traceability | PASS per dispatch brief, confirmed against traceability.json | All five inception NFRs map to NFRx.y targets with no gap rows. |
| linter and type-check | N/A, no TS or JS snippets in these artifacts | Nothing to lint; the NFR3.1 lint-scope question is recorded as a Minor finding. |

### Summary

The frame budget, canvas accessibility, renderer snapshot method, and dependency pins all leave the implementer guessing at release-gate behavior, so the unit is not buildable from this document alone.
