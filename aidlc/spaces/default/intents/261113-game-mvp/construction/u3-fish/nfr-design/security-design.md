# Security Design — u3-fish

> Upstream: `nfr-requirements/security-requirements.md` (NFR3.1, NFR4.1, NFR4.2, NFR5.1), `tech-stack-decisions.md` (NFR1.1 ≤ 0.5 ms/tick), `functional-design/functional-spec.md` (W12–W15), `functional-design/rules.md` (BR10–BR11), `contract-summary.md` (C2, C6). Answers from `nfr-design-questions.md` (Q1–Q3 all A).

## Design inputs

- `functional-spec.md` W12 (tick pipeline: age → growth → health → transitions) is the per-fish pass this design budgets; W13 (buy path) is the `spawnFish` call site the genome guard covers.
- `tech-stack-decisions.md` NFR1.1 (≤ 0.5 ms/tick, p95-of-300 probe) is enforced by the single-pass, no-allocation layout below.

## Compute layout (NFR1.1)

One pass per tick over fish in stable key order, in W12 order: age accrual → growth (closed-form) → satiety decay (`satiety = max(0, satiety − 100/48)` per W12 step 4 / BR10.2 — without this step fish never go hungry and starvation, regen gating, and death causes break) → health/stressor → stage transitions → death. No cross-tick caches kept by U3 (each tick recomputes from live state — a U3-kept cache would risk stale reads from earlier phases in the same tick). The one allowlisted exception is U6's `Fish.value` per-commerce-tick refresh (C2, BR11.3): U6 owns that write on a U3-owned field; the fish phase never reads `Fish.value` to drive state, and readers (U7 panels) tolerate up to one tick of price staleness. No per-tick allocation: scalar locals only; genome rolls happen only at spawnFish (buy path) and inheritGenome (U5 breeding path), never in the tick loop.

## Determinism + genome guard (NFR3.1, NFR4.1)

RNG draws go through the passed `rng` parameter — `spawnFish(state, species, rng)`, `inheritGenome(rng, sire, dam)` — supplied as `ctx.rng` at both call sites (U6 buy handler, U5 breeding system), with no `Math.random`, `Date.now`, or other ambient source. Age-driven transitions (BR10.6) draw nothing. Defense in depth for genomes: post-migration barrier check (U2 NFR4.3, `Fish.genome` is-record) plus consumer guards in `spawnFish`/`inheritGenome` that reject non-record genomes at use.

## Test design (NFR5.1)

TDD, 80% line floor, CI gate. Boundary suites: growth-curve calibration, stressor matrix, death causes + protected-critical catch-up, sex distribution, genome roll shape, stunted factor, maturity/senior transitions; golden replay (birth-death-maturity script); benchmark probes per NFR1.1.

## What's explicitly not built

No auth, no encryption, no PII handling (genomes are opaque gameplay data, not personal data), no network surface.
