# Logical Components — u6-commerce

> Component-level view of where the NFR patterns apply; bridges to Infrastructure Design (build/deploy pipeline for this offline-first bundle).

```yaml
components:
  - name: CommerceSystem
    phase: commerce
    owns: [price-cache refresh, demand recovery, trend cycle, day-boundary upkeep (recovery → costs → expiry → hatch-XP/levels → upkeep → cache), operating-cost deduction, XP accrual]
    failure_domain: commerce phase of the tick
    blast_radius: "tick-abort with NO rollback per C2: earlier-phase writes persist un-versioned; subscribers stale until next completed tick. Committed state untouched; recovery = last autosave"
    perf_budget: "≤ 0.125 ms/tick with notify (≤ 0.5 ms/frame at x4)"
  - name: CommerceCommands
    owns: [commerce.buyFish, commerce.sellFish, commerce.sellBulk, orders.fulfil (command path; validate-first, atomic)]
    failure_domain: command path (between ticks)
    blast_radius: "rejection changes nothing; accepted call bumps version once"
    perf_budget: "not tick-bound; single-command cost"
  - name: NotifySubsystem
    owns: [notification mapper (fishSpawned/fishSick/moneyChanged/whileYouWereAway → null), notify-phase fishSick aggregation, away summary, queue cap + dismiss]
    failure_domain: notify phase of the tick + drain mapping
    blast_radius: "mapper is pure (no writes); notify system appends Notifications only"
    perf_budget: "included in the ≤ 0.125 ms/tick commerce+notify share"
  - name: CommerceSelectors
    owns: [sellPrice, bulkPreview, orderRewardPreview, buyableSpecies, levelProgress, notificationQueue]
    failure_domain: none (pure functions, no writes)
    blast_radius: none
```

## Isolation strategy

- Money mutations only through validated handlers (or the C2 purchase-path exception for U2/U4 purchase handlers); the scalar never goes negative.
- `Fish.value` refresh is the only cross-entity write (C2-allowlisted); never read back to drive state.
- No cross-tick caches kept by U6; reward estimates recomputed at fulfil time.
