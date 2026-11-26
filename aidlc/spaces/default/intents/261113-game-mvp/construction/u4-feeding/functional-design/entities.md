# Entities — u4-feeding

> Upstream: `unit-of-work.md` (U4 owns FoodItem behaviour), `components.md` (Feeding), `contract-summary.md` (C1 FoodItem cross-boundary fields, C2 exception, C4 fed/overfed/foodOut), `stories.md` (US3.1, US3.2), `requirements.md` (FR3.1, FR3.2), U2 design (waste path, WASTE_PER_PORTION), U3 design (satiety semantics, health thresholds). Answers from `functional-design-questions.md` (Q1–Q6, summary `Looks correct`).
> Full declarations live here for `FoodItem` and the feeding schedule. The developer codes the types from U1's `packages/u1-sim-foundation/src/types.ts` (single shared definition); this file is the behavioural spec it must satisfy. `acquiredDay` and `target` are U4-added fields (additive, safe); `GameState.feeding` is a U4-added top-level section U1 carries.

```yaml
entities:
  - name: FoodItem
    owner: u4-feeding
    description: One purchased stack of food; feeding consumes portions oldest-stack-first.
    attributes:
      - { name: id, type: FoodItemId, required: true }
      - { name: kind, type: string, required: true, allowed: [flakes, pellets, liveFirst] }
      - { name: qty, type: integer, required: true, min: 0, note: "portions remaining; stack removed at 0 with foodOut" }
      - { name: quality, type: number, required: true, note: "fixed per kind: flakes 0.7, pellets 0.9, liveFirst 1.0" }
      - { name: shelfLifeDays, type: integer, required: true, min: 0, note: "0 = never expires; liveFirst 7" }
      - { name: acquiredDay, type: integer, required: true, min: 1, note: "game day of purchase; expiry origin (U4-added)" }
      - { name: target, type: string, required: true, allowed: [fish, fry], note: "liveFirst is fry-flagged; flakes/pellets are fish food (U4-added)" }
    constraints:
      - "expired ≡ shelfLifeDays > 0 AND acquiredDay + shelfLifeDays < today; expired stacks never dispense"

  - name: FeedingSchedule
    owner: u4-feeding
    description: Auto-feeder program; lives in GameState.feeding.schedule (null = no program).
    attributes:
      - { name: foodKind, type: string, required: true, allowed: [flakes, pellets], note: "fish-target kinds only; fry food never auto-dispenses" }
      - { name: portions, type: integer, required: true, min: 1 }
      - { name: intervalHours, type: number, required: true, min: 1 }
      - { name: lastRunHour, type: integer, required: true, note: "absolute game-hour of the last run; absolute clock, deterministic" }

  - name: FoodCatalogueRow
    owner: u4-feeding
    description: Static data (prices, qualities), not state.
    attributes:
      - { name: kind, type: string, required: true }
      - { name: pricePerUnit, type: integer, required: true, note: "$FISH per portion: flakes 2, pellets 4, liveFirst 6" }
```

## Summary

U4 fully declares `FoodItem` (kind/qty/fixed quality/expiry/acquired-day/fish-or-fry target) and the `FeedingSchedule` program. Stacks are per-purchase (each carries its own acquiredDay); the feeder draws FIFO across stacks of the scheduled kind. Fry cohorts' `firstFoodDays: integer ≥ 0` / `lastFryFedDay: integer game day` counters are U5-owned fields U4 writes under the C2 exception (required U5 data, same pattern as U2's tempRangeC ask of U1).
