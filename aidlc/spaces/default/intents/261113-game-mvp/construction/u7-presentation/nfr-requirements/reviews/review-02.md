## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-25T15:11:22Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/performance-requirements.md > NFR1.1 | The 12 ms render share of the 20 ms frame is claimed but never isolated or exercised at the x4 worst case. Verification measures total p95 frame time with the sim running at x1 only, so a build with render at 18 ms passes at x1 and still fails at x4, where the C2 cap packs 4 ticks into one frame and the cited 8 ms per frame sim split (water 4 plus fish 2 plus feeding 1 plus breeding 0.5 plus commerce and notify 0.5) is never tested. | Add an x4 render-budget gate on the calibrated proxy (for example p95 frame time at x4 with the 100-fish save) with a render-isolated probe, or restate NFR1.1 as per-tick sub-caps that compose to 8 ms per frame and verify those at x4. | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/performance-requirements.md > NFR1.2 | The x4 soak criteria cannot enforce 50 fps at x4 and cannot be executed as written. A sustained 35 ms frame passes the 40 ms ceiling while violating the frame budget, and a single unrelated hitch fails a zero-tolerance max over about 3000 frames. The expected version count is undefined because no tick rate (game hours per real second at x4) is stated, and the C2 backlog loading state has no owning workflow in W36 through W49. | Define the tick rate so the expected version count is computable, replace the zero-max with a percentile gate at x4 plus a reasoned max, and name the workflow that surfaces backlog accumulation. | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/security-requirements.md > NFR2.1 | Verification leans on an axe-core audit of the shell, but axe inspects the DOM while the tank canvas paints fish outside it, and the canvas fish-click path in W39 has no named keyboard equivalent. The keyboard walkthrough covers tabs and dialogs only, so parity for canvas-anchored actions is unproven while the requirement promises every action keyboard-reachable. | Scope the axe audit to the shell DOM explicitly, name the keyboard path for each canvas action (for example the roster panel for fish selection), and extend the walkthrough to exercise it. | Resolved (reviewer) |
| R-04 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/security-requirements.md > NFR5.1 | Renderer coverage is assigned to snapshot plus soak tests without saying what is snapshotted. Sprite appearance derives from deterministic genome tokens while steering and particles use the NFR3.1 local RNG, so a live-tank pixel snapshot would be nondeterministic, and no fixture, frozen-seed rule, tolerance, or environment is given. The carve-out from the 80% line floor leaves renderer code with no measurable bar. | Define the snapshot subject and fixture (for example sprite catalog renders per genome with a frozen seed, or shell DOM structure), the tolerance and environment, and the coverage metric that replaces line coverage for renderer code. | Resolved (reviewer) |
| R-05 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/tech-stack-decisions.md > Dependencies | New dependencies are named without installable versions: pixi.js, Svelte 5, axe-core, and an unnamed PWA plugin. The root package manifest carries none of them, so the pinned-stack claim resolves only to major versions while Pixi 8 and Svelte 5 both break from their predecessors. | Pin installable version ranges for pixi.js, Svelte, axe-core, and the PWA plugin by name, consistent with the workspace manifest. | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/security-requirements.md > NFR3.1 | Re-seeded per mount from a local RNG names no entropy source, so a fixed-seed implementation would replay identical motion on every mount without violating any stated rule, and the scope of the ambient-nondeterminism ban for renderer use of Math.random or Date.now is unstated. | State the seed source and whether identical restart motion is accepted, and clarify that the seeded-stream ban covers sim systems only. | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/security-requirements.md > NFR2.1 text scaling | The requirement promises text scaling with system settings but verification lists no scaling check. | Add a scaling check such as 200 percent zoom or system font size, or remove the promise. | Resolved (reviewer) |
| R-08 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/security-requirements.md > NFR4.1 defaults | Documented defaults on old saves points to no defaults table, and with schema version 1 there is no older envelope to fixture. | Reference the settings defaults table and name the fixture version the round-trip test uses. | Resolved (reviewer) |
| R-09 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/performance-requirements.md > NFR1.3 | Within 5 percent names no statistic, so full-motion versus reduced-motion comparison is not reproducible. | Name the statistic, for example p95 frame time on the benchmark scene. | Resolved (reviewer) |
| R-10 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u7-presentation/nfr-requirements/performance-requirements.md > NFR1.1 verification (b) | The x4 gate names the 4-ticks/frame worst case, but a plain run at x4 almost never packs 4 ticks into one frame (x1 = 1 game-hour/s, so x4 queues roughly one tick per 250 ms — about one tick every 12 frames at 50 fps); the burst only materialises after a stall. A developer implementing the gate literally would pass it without ever exercising the condition it cites. | State how the benchmark establishes the 4-tick frame (for example suspend frame callbacks to accumulate backlog, then measure catch-up frames), or separate the steady-state x4 p95 gate from an induced-burst gate. | New |

> R-01 Reviewer note: NFR1.1 now gates total p95 ≤ 20 ms at both x1 and x4 and adds a render-isolated probe (speed 0, render-only p95 ≤ 12 ms) plus the allocation probe.

> R-02 Reviewer note: Tick rate pinned via C2 (x1 = 1 game-hour/s); soak math is exact (60 s x4 → Δversion 240); gate is p95 ≤ 20 ms with reasoned max ≤ 50 ms; backlog owner named as the W38 HUD loading indicator, confirmed in functional-spec W38 item 4 and C2.

> R-03 Reviewer note: Axe explicitly scoped to shell DOM with canvas-exclusion rationale; Roster rows named as the keyboard path to the FishPanel; walkthrough extended to fish selection via Roster; 200% zoom check added.

> R-04 Reviewer note: Snapshot subject is the sprite catalog from a frozen fixture in headless Chromium (≤ 0.1% differing pixels) plus shell DOM snapshots; renderer metric is 100% sprite-builder branch coverage plus the NFR1 soak.

> R-05 Reviewer note: All four dependencies pinned with installable ranges (pixi.js ^8.23.0, svelte ^5.59.1, axe-core ^4.14.1, vite-plugin-pwa ^2.0.0) with lockfile commitment at codegen.

> R-06 Reviewer note: Seed source named (crypto.getRandomValues), identical-restart motion accepted, seeded-stream ban scoped to sim packages with the renderer free to use local entropy but never ctx.rng.

> R-07 Reviewer note: 200% zoom layout check added to NFR2.1 verification.

> R-08 Reviewer note: Defaults match built defaultSettings() exactly (false / true / master 0.8 sfx 0.8, verified in packages/u1-sim-foundation/src/types.ts); old-save fixture defined as a v1 envelope with settings fields removed.

> R-09 Reviewer note: NFR1.3 statistic named as p95 frame time on the benchmark scene.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| required-sections | PASS (per dispatch brief) | Section structure present in the NFR artifacts. |
| upstream-coverage | PASS (per dispatch brief, re-fired after the W38 amendment) | U7 NFRs trace to the functional spec, rules, requirements, and contract summary. |
| traceability | PASS (per dispatch brief) | NFR1–NFR5 all OK with NFRx.y targets; matches traceability.json. |
| linter / type-check | N/A (per dispatch brief, no TS/JS snippets) | Nothing to lint in these artifacts. |

### Summary

All nine iteration-1 findings verify as fixed against the artifacts and their amended counterparts (C2 pacing, W38 backlog indicator, built defaultSettings). One Minor remains on forcing the 4-tick burst the x4 gate cites; it does not block implementation. A developer can build U7 from this.
