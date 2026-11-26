# Logical Components — u4-feeding

> Component-level view of where the NFR patterns apply; bridges to Infrastructure Design (build/deploy pipeline for this offline-first bundle).

```yaml
components:
  - name: FeedingSystem
    phase: feeding
    owns: [auto-feeder due check, expiry sweep, feedFish dispensing writes]
    failure_domain: feeding phase of the tick (first phase)
    blast_radius: "tick-abort with NO rollback per C2: partial feeding writes persist in memory un-versioned with no version bump; recovery is reload from the last autosave"
    perf_budget: "≤ 0.25 ms/tick (≤ 1 ms/frame at x4)"
  - name: FoodShop
    owns: [buyFood validation + deduction + append-one-stack per BR12.2 — no merge semantics (C2 purchase-path exception)]
    failure_domain: command path (between ticks)
    blast_radius: "rejection changes nothing (validate-first); accepted call bumps version once"
    perf_budget: "not tick-bound; single-command cost"
  - name: FeedCommands
    owns: [feedFish/feedFry dispensing, setAutoFeeder program, firstFoodDays/lastFryFedDay counters (command path only, BR13.3/W19)]
    failure_domain: command path (between ticks)
    blast_radius: "rejection changes nothing (validate-first); accepted call bumps version once"
    perf_budget: "not tick-bound; single-command cost"
  - name: FeedingSelectors
    owns: [foodStock, usableFood, feedingProgram]
    failure_domain: none (pure functions, no writes)
    blast_radius: none
```

## Isolation strategy

- Mutates only FoodItem records, the feeding schedule section, cohort first-food counters and `Fish.satiety` (C2-allowlisted feeding-transaction writes), plus tank waste on the feeding path (C2-allowlisted) plus the money scalar on the purchase path (C2 purchase-path exception).
- Schedule keyed off absolute game hour; no wall-clock reads; no RNG in U4.
- No cross-tick caches kept by U4.
