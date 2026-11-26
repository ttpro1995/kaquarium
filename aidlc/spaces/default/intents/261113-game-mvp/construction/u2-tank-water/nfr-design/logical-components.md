# Logical Components — u2-tank-water

> Component-level view of where the NFR patterns apply; bridges to Infrastructure Design (which, for this offline-first browser bundle, is the build/deploy pipeline rather than servers).

```yaml
components:
  - name: WaterSystem
    phase: water
    owns: [bioload scan + cache, waste/nitrate math, filter conversion, latch updates, waterChange/upgradeTier/buyEquipment handlers]
    failure_domain: water phase of the tick
    blast_radius: "tick-abort with NO rollback (C2): a throw aborts the tick, so feeding-phase writes persist in memory un-versioned and version-keyed subscribers go stale until the next completed tick bumps version; fish/breeding/commerce/notify are skipped for that tick. Committed state (last version-bumped tick) is untouched; recovery = last autosave"
    perf_budget: "≤ 1 ms/tick (≤ 4 ms/frame at x4)"
  - name: ImportBarrier
    owns: [raw-text size gate, JSON parse, banned-key scan, envelope + version check, checksum verification, pre-migrate count gate, migrate, rollback check, post-migration structural validation]
    failure_domain: load/import path (outside ticks)
    blast_radius: "rejection leaves the current save untouched by construction; no partial state"
    owner_note: "implemented in U1 kernel; U2/U4/U5 supply the field bounds as NFR inputs"
  - name: TankSelectors
    owns: [tankWater, waterQuality, capacity, projectedBioload, bioloadOf, tempFitFor]
    failure_domain: none (pure functions, no writes)
    blast_radius: none
```

## Isolation strategy

- Systems mutate only their owned entities (C2 ownership); the only allowlisted cross-entity writes are the C2 exceptions (feeding waste/satiety, feedFry counters, Fish.value cache).
- Selectors are pure and allocation-light; panels re-render on `version` bumps only.
- No shared mutable state between phases except `GameState` itself, written only by the three C1 writers.
