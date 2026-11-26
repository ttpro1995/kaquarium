# Security Design — u2-tank-water

> Upstream: `nfr-requirements/security-requirements.md` (NFR3.1, NFR4.1–NFR4.3, NFR5.1), `tech-stack-decisions.md` (NFR1.1, breaking-change register), `functional-design/functional-spec.md` (W7 water tick, W9 water change, W10 equipment/tier — the operations this design hardens), `functional-design/rules.md` (BR8–BR9), `contract-summary.md` (C2, C6). Answers from `nfr-design-questions.md` (Q1–Q3 all A).

## Design inputs

- `functional-spec.md` W7 defines the per-tick water pipeline this import barrier protects; W9/W10 define the money-deducting handlers covered by the C2 purchase-path exception.
- `tech-stack-decisions.md` carries NFR1.1 (≤ 1 ms/tick budget, enforced by the per-tick bioload cache below) and the v1 → v2 breaking-change register the migration layer executes.

## Import validation pipeline (NFR4.2–NFR4.3)

Nine layers, in true C6 `import_order` with the two U1-owned additions marked — each layer rejects before the next runs:

1. **Size gate** (U1 addition): reject when raw text exceeds 2 MB (pre-parse; a huge payload never reaches `JSON.parse`).
2. **Parse**: `JSON.parse`; CORRUPT_JSON on failure, current save untouched.
3. **Banned-key scan** (U1 addition, per built `persistence.ts` placement): `findBannedKey` over the parsed payload (`__proto__`/`constructor`/`prototype` at any depth → INVALID_SHAPE).
4. **Envelope + version**: validate envelope shape and required fields; reject unknown/newer `schemaVersion` (UNSUPPORTED_VERSION).
5. **Checksum**: recompute SHA-256 over the canonical envelope; mismatch → CHECKSUM_MISMATCH.
6. **Pre-migrate count gate**: reject INVALID_SHAPE when counts exceed fish 1000 / cohorts 500 / orders 6 / notifications 100 / food stacks 24 — an inflated payload never reaches migrate or the O(fish + cohorts) scan across 192 catch-up ticks.
7. **Migrate**: known version only; v1 → `migrateV1ToV2` per the register; MIGRATION_FAILED on refusal.
8. **Rollback check**: compare `savedAt` with last-seen; older save → STALE_SAVE unless `confirmStale` (U7 asks first).
9. **Post-migration structural validation**, then replace: required Tank structure (latch fields present/typed, equipment structured, waste/nitrate 0–100, tempC 10–35), `Fish.genome` is-record, feeding bounds (known kind, qty integer ≥ 1, acquiredDay integer ≥ 0, intervalHours ≥ 1, portions ≥ 1, fish-target foodKind), breeding bounds (pair state enum, readyDay integer ≥ 0, species/fish id shape; cohort stage enum, count integer ≥ 0, ageDays/hatchDay integers, genomePool is-record; pairs ≤ 500), notifications ≤ 100 — INVALID_SHAPE on any violation. Only then replace the state.

## Determinism design (NFR3.1)

Single seeded stream (`ctx.rng`); no ambient nondeterminism in systems. Key order follows the store's stable insertion order (no per-tick sort). The renderer must never consume `ctx.rng` (U7 NFR3.1).

## Test design (NFR5.1)

TDD, 80% line floor, CI gate. Boundary suites: latch edge-transitions, band flips, overcrowd open/re-arm, migration round-trips (v1 fixture → fresh-v2 equality), import rejection fixtures (oversize text, banned keys, count-gate breaches, bad checksum, stale save, hand-stamped v2), golden replay, benchmark probes per the amended NFR1.1 protocol (50 warmup ticks, p95 of 300 timed water-phase ticks ≤ 1.0 ms, heap growth < 64 KB over 100 ticks).

## What's explicitly not built

No auth, no encryption at rest (save integrity is checksum-based, not anti-cheat), no audit log beyond the AI-DLC audit trail, no network security surface (no backend).
