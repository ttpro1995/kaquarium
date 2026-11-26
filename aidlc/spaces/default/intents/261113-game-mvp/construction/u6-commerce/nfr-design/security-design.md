# Security Design — u6-commerce

> Upstream: `nfr-requirements/security-requirements.md` (NFR3.1, NFR4.1, NFR4.2, NFR5.1), `tech-stack-decisions.md` (NFR1.1 ≤ 0.125 ms/tick), `functional-design/functional-spec.md` (W26–W35), `functional-design/rules.md` (BR16–BR19), `contract-summary.md` (C2 purchase-path + value-cache + U5-grading exceptions, C6). Answers from `nfr-design-questions.md` (Q1–Q3 all A).

## Design inputs

- `functional-spec.md` W28 (atomic sell), W31 (fulfil premium), W33 (cascade levels), W34 (midnight clamp), W35 (notify ownership) define the operations this design hardens.
- `tech-stack-decisions.md` NFR1.1 (≤ 0.125 ms/tick, full-tick p95 gate as enforcer) is enforced by the single-pass layout below.

## Compute layout (NFR1.1)

One pass per tick: price-cache refresh over fish (closed-form eight-factor, display-only) → demand/trend reads → day-boundary upkeep only on wrap. `Fish.value` is the only U6 cross-unit write (C2-allowlisted, BR11.3/BR16.1); it never drives state — readers (U7 panels) tolerate one tick of staleness. No cross-tick caches kept by U6. No per-tick allocation. RNG draws (trend re-rolls, order generation) in ascending-speciesId catalogue order then board order.

## Money integrity + queue bound (NFR4.2)

Money scalar: integer, always ≥ 0. Every spend path validates first: INSUFFICIENT_FUNDS rejects with nothing changed; midnight costs clamp via max(0, balance − cost) — no debt, no shutoff. One `moneyChanged` per accepted call. Queue cap 100: drop oldest info, then warn; criticals are never auto-dropped (queue may transiently exceed 100 when full of criticals).

## Test design (NFR5.1)

TDD, 80% line floor, CI gate. Boundary suites: price-factor bands, saturation ×0.97 + daily recovery, fulfil premium > market sum with no saturation, rep floor 0, level thresholds + cascade (one levelUp per level), midnight clamp, queue cap (info→warn→critical overflow) + dismiss, migration conversion (built deadline/minQuality → deadlineDay/minHealth, catalogue market size, day-1 floors); golden replay sales → saturation → order cycle; benchmark probes per NFR1.1 (full board, 100-notification queue).

## What's explicitly not built

No auth, no encryption, no PII (economy scalars are gameplay data), no network surface. No debt/credit, no interest, no market shock events (activeEvent reserved null).
