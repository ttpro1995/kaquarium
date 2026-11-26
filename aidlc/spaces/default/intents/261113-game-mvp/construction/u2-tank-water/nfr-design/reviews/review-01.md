## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-25T15:25:47Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u2-tank-water/nfr-design/security-design.md > Import validation pipeline; aidlc/spaces/default/intents/261113-game-mvp/construction/u2-tank-water/nfr-design/logical-components.md > ImportBarrier | Pipeline claims "Six layers, in C6 order" but drops two C6 import_order steps: checksum verification (C6: version → checksum → migrate) and the rollback check (C6: migrate → rollback → replace). The owns list (size gate, banned-key scan, shape check, migrate, post-migration validation) likewise names neither checksum nor STALE_SAVE/rollback, while NFR4.1 requires migration after checksum and NFR4.2 requires shape → version → checksum → migrate → rollback. The non-C6 banned-key scan is also placed before checksum, so the order as written is not C6 order. | Restore the checksum-verification step (after version check, before migrate) and the rollback check (after migrate, before replace), or stop claiming C6 order and explicitly scope both as U1-owned steps with a pointer to the U1 implementation. | New |
| R-02 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u2-tank-water/nfr-design/security-design.md > Import validation pipeline layers 4 and 6 | NFR4.3 requires count caps (fish 1000 / cohorts 500 / orders 6 / notifications 100) rejected after checksum and before migrate so an inflated payload never reaches the O(fish + cohorts) scan across up to 192 catch-up ticks. Layer 4 covers only records/integers/clock plus required fields, and layer 6 mentions only a post-migration "notification cap" — there is no pre-migrate count gate. A payload under the 2 MB size gate can still carry thousands of records into migrate and catch-up, putting the NFR1.1 ≤ 1 ms/tick budget at risk. | Add the pre-migrate count gate with the four NFR4.3 caps and INVALID_SHAPE rejection before migrate. | New |
| R-03 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u2-tank-water/nfr-design/security-design.md > Test design | Benchmark protocol contradicts the upstream NFR1.1 verification in tech-stack-decisions.md: the design specifies 50 warmup ticks and p95 of 300, while NFR1.1 specifies 5 warmup ticks then median of 30 (heap < 64 KB over 100 ticks matches in both). A developer cannot verify NFR1.1 without guessing which protocol governs. | Align the test-design numbers with the NFR1.1 verification protocol, or record the 50-warmup/p95-of-300 change as an explicit NFR amendment in tech-stack-decisions.md. | New |
| R-04 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u2-tank-water/nfr-design/security-design.md > Post-migration structural validation layer 6; aidlc/spaces/default/intents/261113-game-mvp/construction/u2-tank-water/nfr-design/logical-components.md > ImportBarrier owner_note | Post-migration validation normatively depends on cross-unit inputs not pinned in the passed contracts: Fish.genome is-record (U3 NFR4.1 consumer), U4 NFR4.2 feeding bounds including the 24-stack cap, and U5 NFR4.2 breeding bounds including pairs ≤ 500. Contract-summary.md C1/C5/C6 carry none of these field bounds, so the validator cannot be built from this design plus the passed contracts alone. | Inline the concrete genome/feeding/breeding bounds with rejection codes, or cite the exact sibling NFR requirement revisions that pin them so the implementer is not guessing. | New |
| R-05 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u2-tank-water/nfr-design/logical-components.md > WaterSystem blast_radius; aidlc/spaces/default/intents/261113-game-mvp/construction/u2-tank-water/nfr-design/security-design.md > Design inputs and nfr-design-questions.md Q2 | "Committed state untouched" contradicts C6/C2 "the store is not rolled back": C2 phase_order runs feeding before water, so when the water phase throws, feeding-phase mutations persist in memory without a version bump. Version-keyed subscribers go stale and the next tick resumes from partial state; "recovery = last autosave" is correct but "untouched" understates the blast radius. | Restate as tick-abort with no rollback: earlier-phase writes persist un-versioned until the next completed tick or an autosave restore, and note the stale-version consequence for subscribers. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| required-sections | PASS | Section presence holds; findings above are content correctness, not missing sections. |
| upstream-coverage | PASS | Every listed NFR ID is mapped; the gaps are wrong step order, missing count gate, and unresolvable cross-unit bounds, which coverage does not check. |
| traceability | PASS | All five NFR rows declare OK with free-text targets, which matches the stage template example; target wording itself is not the defect. |
| linter / type-check | N/A | No TS/JS snippets in the artifacts (the logical-components yaml block is not code); nothing to run. |

### Summary

The import barrier at the heart of this security design misstates the C6 pipeline it claims to follow — no checksum step, no rollback check, no pre-migrate count gate — and its benchmark numbers contradict the NFR1.1 verification protocol, so a developer building strictly from these artifacts would ship a weaker barrier and an unverifiable perf budget.
