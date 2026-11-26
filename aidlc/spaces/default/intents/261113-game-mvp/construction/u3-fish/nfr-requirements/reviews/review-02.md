## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-25T14:00:53Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-requirements/tech-stack-decisions.md > NFR1.1 | The 2 ms/tick fish budget does not compose with the frame budget it cites. C2 caps live ticks at 4 per rendered frame at x4, and U2 NFR1.1 maps 1 ms/tick to 4 ms/frame for water. By the same mapping fish costs 8 ms/frame worst case, so water 4 ms plus fish 8 ms already exceeds the 8 ms/frame total sim budget before breeding, commerce, and notify run. The row gives no tick-to-frame mapping and leaves the remainder unbounded with shares that land with their NFR passes. | Add the per-frame worst-case mapping for the fish phase, re-budget the sub-shares so 4 ticks/frame of water plus fish plus breeding plus commerce plus notify fits 8 ms/frame, or record a scheduling rule that restores the fit and update C2 accordingly. | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-requirements/security-requirements.md > NFR3.1 | Fixed sorted-fish-id iteration order appears nowhere upstream: W12 steps 1-8, BR10.1-BR11.4, and C2 fix phase order and ctx.rng use but state no within-phase per-fish order. Fish lives in a Record keyed by id, which iterates in insertion order, so compliance forces a per-tick sort whose allocation churn cuts against the same pass's no-per-fish-allocation perf claim. | Either promote the ordering rule into the functional design (W12/BR10.x) with its allocation cost accounted against NFR1.1, or weaken NFR3.1 to draws through ctx.rng in a fixed implementation-defined order pinned by the replay test. | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-requirements/security-requirements.md > NFR3.1 | The draw-only-through-ctx.rng claim overreaches in both directions. BR10.6 states old-age death is deterministic with no RNG, contradicting the blanket coverage of death/maturity transitions. Clutch draws belong to U5: the C1 entity table assigns FryCohort ownership and behaviour to U5, and U3's functional design only owns the per-locus inheritGenome helper. | Scope the RNG rule to the RNG-driven events (sex, size, genome rolls), explicitly exempt age-driven transitions per BR10.6, and move clutch/cohort draw determinism to U5's NFR pass. | Resolved (reviewer) |
| R-04 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-requirements/security-requirements.md > NFR4.1 | The stunted-default story names two mechanisms and the wrong migration. U2 tech-stack-decisions.md Breaking change register defines the v1 to v2 migration as Tank-only (water, equipment, volumeL, latches) with no Fish fields, yet NFR4.1 assigns absent-Fish-field filling to the v1 to v2 migration while also saying stunted defaults false on pre-U5 saves, i.e. load defaulting, the mechanism U2 NFR4.1 explicitly rejects in favour of migration ownership. The field itself lands with U5 data completion, so no single owner or schema bump is identified. | Name one owning mechanism (migration step with its schema bump, or load default) consistent with the register, agree with U2/U5 which version introduces Fish.stunted, and add the corresponding register row if migration-owned. | Resolved (reviewer) |
| R-05 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-requirements/security-requirements.md > NFR4.1 | The genome-record verification cannot pass against the built import pipeline. validateStateShape in packages/u1-sim-foundation/src/persistence/persistence.ts only checks that state.fish is an object and performs no per-Fish or genome checks, so a non-record genome sails through and is never rejected INVALID_SHAPE. types.ts declares genome as a Record but nothing on the C6 path enforces it, and no contract line assigns per-Fish genome validation to any party. | Either add per-Fish genome-is-record validation to the C6 pipeline with an owning contract line, or rewrite the NFR4.1 verification to a check U3 actually owns, such as a unit-level guard where the genome is consumed. | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-requirements/security-requirements.md > NFR4.2 | The row leans on the NFR4.3 bounded barrier, but U3 traceability.json covers only NFR4.1 and NFR4.2 for NFR4, so the cited NFR4.3 is U2's identically-numbered requirement. A developer resolving the reference inside this unit finds nothing. | Qualify the reference as U2 NFR4.3 or restate the size-gate, count, and range barrier normatively inside the U3 row. | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-requirements/tech-stack-decisions.md > NFR1.1 verification | The verification protocol (5 warmup ticks, median of 30 fish-phase ticks, on the reference device) matches neither the established benchmark.test.ts protocol (50 warmup, 300 timed full ticks, p95 8 ms device gate, informational in CI) nor U2's calibrated-proxy plus on-device-milestones wording, and the heap check is cited only as shared with the U2 protocol with no numeric threshold. | Align warmup, sample count, statistic, and device-vs-proxy wording with the shared protocol or justify the deviation, and state the heap-growth threshold numerically. | Resolved (reviewer) |

> R-01 Reviewer note: NFR1.1 now budgets fish ≤ 0.5 ms/tick (≤ 2 ms/frame at x4) with explicit frame composition water ≤ 4 ms + fish ≤ 2 ms + rest ≤ 2 ms = 8 ms total, consistent with the C2 4-ticks/frame accumulate-never-drop cap.

> R-02 Reviewer note: NFR3.1 weakened to the store's stable key order with no per-tick sort, pinned by the replay test — the weaken-and-pin alternative the finding offered; allocation conflict with NFR1.1 is gone.

> R-03 Reviewer note: RNG rule scoped to sex/size/genome rolls, BR10.6 age-driven transitions explicitly exempt, clutch/cohort draws assigned to U5's NFR pass.

> R-04 Reviewer note: Single owner named: v1 → v2 migration fills `Fish.stunted = false`, register row present in the U2 breaking-change register, no load-defaulting path.

> R-05 Reviewer note: Genome is-record enforced post-migration via U2 NFR4.3 (extended to `Fish.genome`) plus U3 consumer guards in `spawnFish`/`inheritGenome`; verification rewritten to checks that exist.

> R-06 Reviewer note: NFR4.2 reference qualified as the U2-owned NFR4.3 bounded import barrier.

> R-07 Reviewer note: Verification aligned to the benchmark protocol family (50 warmup, p95 of 300, calibrated proxy + on-device milestones) with a numeric heap < 64 KB threshold.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| required-sections | PASS (per dispatch brief) | Required NFR sections present. |
| upstream-coverage | PASS (per dispatch brief) | All inception NFRs covered or explicitly N/A. |
| traceability | PASS (per dispatch brief) | traceability.json maps NFR1–NFR5 to NFRx.y targets. |
| linter / type-check | N/A (no TS/JS snippets) | Nothing to lint; no finding. |

### Summary

All seven iteration-1 findings verify as fixed against the amended artifacts and the U2/C2 counterparts; the frame budget composes, determinism is correctly scoped, migration ownership is single, and verification protocols are measurable. No new architectural concern blocks implementation.
