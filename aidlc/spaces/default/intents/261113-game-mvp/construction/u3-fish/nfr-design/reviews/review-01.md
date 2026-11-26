## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-25T15:38:12Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-design/security-design.md > Compute layout (NFR1.1), and logical-components.md > FishSystem owns | The per-tick pipeline is given as age accrual, growth, health/stressor, transitions, and the FishSystem owns list repeats those four, but W12 step 4 plus BR10.2 make satiety decay a normative every-tick fish-phase step (satiety = max(0, satiety - 100/48)). A developer building the tick from this layout ships fish that never go hungry, so starvation, regen gating, and death causes silently break. | Add the satiety-decay step to the compute layout in W12 order (between growth and health) and to the FishSystem owns list. | New |
| R-02 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-design/logical-components.md > FishSystem owns: buy-path trio emission point | FishSystem is listed as owning the buy-path trio emission point, but BR11.1 states the spawnFish factory mutates nothing and emits nothing (a factory that emits is a bug), and W13 plus the C3 sketch place the fishBought plus fishSpawned plus moneyChanged trio emission in U6 commerce.buyFish. The ownership claim invites putting emission inside spawnFish, which is a defined violation. | Remove trio emission from FishSystem ownership, state that U6 buyFish is the authorised emitter of fishSpawned on that path, and keep spawnFish/inheritGenome pure with no emission. | New |
| R-03 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-design/logical-components.md > Isolation strategy: No cross-tick caches, and security-design.md > Compute layout | Both artifacts state an absolute no-cross-tick-cache rule (with a rationale that a cache would risk stale reads), yet the C2 allowlist expressly permits U6 commerce to refresh the Fish.value cache from its price formula each commerce tick, BR11.3 allowlists that write, and the functional-spec coordination notes call it a documented cache write. Taken literally, this design forbids a contract-mandated cache on a U3-owned field. | Scope the rule to caches kept by U3 itself and name the C2/BR11.3 Fish.value refresh as the explicit exception, including which reader must tolerate its cross-tick staleness. | New |
| R-04 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-design/traceability.json > coverage and upstream_ids | The file omits NFR1.1 even though the compute layout claims to enforce the 0.5 ms/tick budget and tech-stack-decisions.md defines NFR1.1 as a U3 requirement, so the headline perf budget is untracked. It simultaneously lists NFR4.3 as OK, but NFR4.3 is defined and owned in U2 security-requirements.md (bounded import barrier), not in any U3 requirement, so this unit claims coverage of another unit requirement. | Add an NFR1.1 row mapping to the compute layout and benchmark probe, and drop NFR4.3 as a coverage row (cite it as a U2-owned dependency in prose instead). | New |
| R-05 | Major | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-design/logical-components.md > FishSystem blast_radius | The blast radius names only water-phase writes as persisting un-versioned on a fish-phase tick abort, but W12 step 1 plus the C2 phase order (feeding, water, fish) put the U4 feeding phase before the fish phase too, so feeding writes (satiety, waste, fry feeding days) also persist. The same line then says committed state is untouched, which contradicts writes persisting un-versioned in the store. | State that both feeding-phase and water-phase writes persist with no rollback on a fish-phase abort, delete the untouched-state clause or restrict it to saved slots, and keep recovery as reload from the last autosave per C2. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-design/security-design.md > Determinism + genome guard | RNG draws are described as through ctx.rng only, but the owned factories take rng as a parameter (spawnFish(state, species, rng), inheritGenome(rng, sire, dam)) and have no ctx in scope. The phrasing is implementable only by guessing that the caller passes ctx.rng. | Rephrase to draws through the passed rng parameter (ctx.rng at both call sites) with no Math.random, Date.now, or other ambient source. | New |
| R-07 | Minor | aidlc/spaces/default/intents/261113-game-mvp/construction/u3-fish/nfr-design/security-design.md > Compute layout, and logical-components.md > Isolation strategy | Genome rolls are located at spawn/grade events, but no grade event exists in U3 scope: rolls happen at spawn (spawnFish) and at conception (inheritGenome called by U5 breeding), while cohort grading only instantiates Fish from the existing pool. | Replace grade events with the two concrete call sites (spawnFish on the buy path, inheritGenome on the U5 breeding path). | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| required-sections | PASS per dispatch brief | Section shape is present; the findings above concern content correctness, not missing sections. |
| upstream-coverage | PASS per dispatch brief | Upstream files are referenced; the NFR1.1 omission and NFR4.3 scope error in traceability.json are semantic, not reference, defects. |
| traceability | PASS per dispatch brief | Machine shape passes, but the coverage set is wrong in both directions (missing U3-owned NFR1.1, claiming U2-owned NFR4.3); see the Major traceability finding. |
| linter, type-check | N/A per dispatch brief | No TypeScript or JavaScript snippets in these artifacts, so nothing to run. |

### Summary

The compute layout, ownership, blast radius, and traceability each contradict a norm in W12, BR10 through BR11, or C2: the tick drops satiety decay, emission ownership crosses into U6, the no-cache absolute forbids the allowlisted value cache, NFR1.1 is untracked while NFR4.3 is claimed, and the blast radius forgets the feeding phase.
