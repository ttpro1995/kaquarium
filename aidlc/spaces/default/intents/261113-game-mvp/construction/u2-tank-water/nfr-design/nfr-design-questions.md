# NFR Design — Questions (u2-tank-water)

> Unit U2 NFR requirements: NFR1.1 (≤1ms/tick water budget), NFR3.1 (ctx.rng-only determinism), NFR4.1–NFR4.3 (migration-owned latches, C6 pipeline, bounded import), NFR5.1 (TDD/80%/CI). This pass designs the concrete patterns. Produces: security-design.md, logical-components.md, traceability.json.

## Q1. [Model] Cache and validation layering (NFR1.1, NFR4.2–NFR4.3)

Bioload scan caches per-fish terms in the tick and recomputes the cache once per water tick; import validation layers as: text size gate → JSON parse → banned-key scan → shape → version/migrate → post-migration structural validation (Tank + Fish.genome + feeding/breeding bounds).

A. As stated: per-tick bioload cache, six-layer import pipeline in C6 order
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Failure domains and blast radius (reliability)

A throwing U2 system aborts the tick per C2 (no rollback; last autosave is the recovery point). U2's failure domain is the water phase: a fault there skips fish/breeding/commerce/notify for that tick; feeding-phase writes persist in memory un-versioned (C2 runs feeding before water — no rollback), so version-keyed subscribers go stale until the next completed tick. Committed state (last version-bumped tick) is never corrupted.

A. Confirm: tick-abort containment per C2 with no rollback (earlier-phase writes persist un-versioned); no U2-owned retry (deterministic replay is the recovery)
B. Tune — say how
X. Other (please specify)

[Answer]: A + review amendment R-05: no-rollback blast radius stated explicitly (earlier-phase writes persist un-versioned, subscribers stale until next completed tick).

## Q3. [Model] Observability without logging infra (NFR5.1, diagnostics)

The sim has no logging pipeline (browser-local, no backend). U2's diagnostics surface is: latch fields + survivalFactor-style derived values readable via selectors, benchmark/verification probes (timed phases, heap growth), and the golden replay test as the determinism signal.

A. Confirm: selectors + probes + replay tests are the observability surface; no log/trace infrastructure
B. Tune — say how
X. Other (please specify)

[Answer]: A
