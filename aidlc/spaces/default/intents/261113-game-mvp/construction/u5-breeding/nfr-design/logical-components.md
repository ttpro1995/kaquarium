# Logical Components — u5-breeding

> Component-level view of where the NFR patterns apply; bridges to Infrastructure Design (build/deploy pipeline for this offline-first bundle).

```yaml
components:
  - name: BreedingSystem
    phase: breeding
    owns: [pair gate checks, spawn attempts, gestation/incubation progress, fry decay, cooling promotion, silent cleanup]
    failure_domain: breeding phase of the tick
    blast_radius: "tick-abort with NO rollback per C2: feeding/water/fish writes persist un-versioned; subscribers stale until next completed tick. Committed state untouched; recovery = last autosave"
    perf_budget: "≤ 0.125 ms/tick (≤ 0.5 ms/frame at x4)"
  - name: BreedingCommands
    owns: [breeding.pair, breeding.unpair, breeding.grade (command path; validate-first, all-or-nothing)]
    failure_domain: command path (between ticks)
    blast_radius: "rejection changes nothing; accepted call bumps version once"
    perf_budget: "not tick-bound; single-command cost"
  - name: BreedingSelectors
    owns: [pairsInTank, cohortsInTank, breedingReadiness, gradePreview]
    failure_domain: none (pure functions, no writes)
    blast_radius: none
```

## Isolation strategy

- Mutates only BreedingPair and FryCohort records — plus Fish records created at grading via U3's `spawnFish`/`inheritGenome` (parents set, capacity pre-checked; the authorised U5-to-Fish path per the C2 exception register, mirroring U6's buyFish trio).
- RNG only on spawn/grade events via the passed parameter; the tick loop draws each attempt from it in stable key order.
- No cross-tick caches kept by U5; no shared mutable state beyond `GameState`.
