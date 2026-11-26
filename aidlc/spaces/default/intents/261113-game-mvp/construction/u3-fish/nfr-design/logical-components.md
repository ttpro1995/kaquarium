# Logical Components — u3-fish

> Component-level view of where the NFR patterns apply; bridges to Infrastructure Design (build/deploy pipeline for this offline-first bundle).

```yaml
components:
  - name: FishSystem
    phase: fish
    owns: [age accrual, growth, satiety decay, health/stressor, transitions, spawnFish factory, inheritGenome rolls]
    note: "spawnFish/inheritGenome are pure (BR11.1: a factory that emits is a bug) — the buy-path fishBought + fishSpawned + moneyChanged trio is emitted by U6 commerce.buyFish, the authorised emitter on that path, never by the factory"
    failure_domain: fish phase of the tick
    blast_radius: "tick-abort with NO rollback (C2): feeding-phase AND water-phase writes persist in memory un-versioned (feeding and water run before fish), version-keyed subscribers stale until the next completed tick bumps version. Saved slots are untouched (committed state = last version-bumped tick); recovery = reload from the last autosave"
    perf_budget: "≤ 0.5 ms/tick (≤ 2 ms/frame at x4)"
  - name: FishSelectors
    owns: [genomeQuality, colour-locus, rarity-allele, price-factor inputs for U6]
    failure_domain: none (pure functions, no writes)
    blast_radius: none
```

## Isolation strategy

- Mutates only Fish records; never writes Tank, cohorts, food, or the `Fish.value` display cache (U6-owned write per the C2/BR11.3 exception — U3 never reads it).
- Genome rolls isolated to the two concrete call sites: `spawnFish` on the buy path, `inheritGenome` on the U5 breeding path (cohort grading only instantiates Fish from the existing pool — no rolls there).
- No cross-tick caches; no shared mutable state beyond `GameState`.
