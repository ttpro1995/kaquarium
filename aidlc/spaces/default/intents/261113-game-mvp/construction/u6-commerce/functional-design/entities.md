# Entities — u6-commerce

> Upstream: `unit-of-work.md` (U6 owns Market, Orders, Progression, Economy, Notifications behaviour), `components.md` (Market, Orders, Progression, Economy, Notifications), `contract-summary.md` (C1 MarketState/Order/PlayerProgression/Notification cross-boundary fields, money/reputation scalars; C2 value-cache exception; C4 target catalogue), `stories.md` (US6.1–US8.1, US12.1), `requirements.md` (FR6.1–FR8.1, FR12.1). Answers from `functional-design-questions.md` (Q1–Q6, summary `Looks correct`).
> Full declarations live here for `MarketState`, `Order`, `PlayerProgression` and the U6-owned `Notification` contents. The developer codes the types from U1's `packages/u1-sim-foundation/src/types.ts` (single shared definition); this file is the behavioural spec.

```yaml
entities:
  - name: MarketState
    owner: u6-commerce
    description: Per-species demand state; one record per catalogue species, keyed by speciesId.
    attributes:
      - { name: speciesId, type: SpeciesId, required: true }
      - { name: demand, type: number, required: true, min: 0, note: "starts 1.0; sale multiplies ×0.97, recovers daily" }
      - { name: trend, type: integer, required: true, allowed: [-1, 0, 1], note: "re-rolled per species every 3 game days via ctx.rng, weighted to 0" }
      - { name: activeEvent, type: string | null, required: false, note: "always null in the MVP (reserved)" }
      - { name: lastTrendDay, type: integer, required: true, min: 1, note: "game day of the last trend roll; drives the 3-day cycle" }

  - name: Order
    owner: u6-commerce
    description: One customer request on the board.
    attributes:
      - { name: id, type: OrderId, required: true }
      - { name: speciesId, type: SpeciesId, required: true, note: "drawn from buyable species (tier ≤ level)" }
      - { name: customer, type: string, required: true, allowed: [hobbyist, petShop, collector], note: "collector needs L3" }
      - { name: quantity, type: integer, required: true, min: 1 }
      - { name: minHealth, type: integer, required: true, note: "40 / 50 / 70 by customer" }
      - { name: minSizeCm, type: number, required: true, note: "species market size; fulfil fish must meet it" }
      - { name: multiplier, type: number, required: true, note: "1.2 / 1.05 / 1.5 by customer; fulfil-time reward basis" }
      - { name: reward, type: integer, required: true, note: "board estimate at generation; replaced by the actual fulfil-time amount on fulfil" }
      - { name: deadlineDay, type: integer, required: true, note: "3–7 days out; expiry at day boundary past deadline" }
      - { name: status, type: string, required: true, allowed: [open, fulfilled, expired] }

  - name: PlayerProgression
    owner: u6-commerce
    description: XP, levels 1–3, and accumulated unlock ids.
    attributes:
      - { name: level, type: integer, required: true, allowed: [1, 2, 3] }
      - { name: xp, type: integer, required: true, min: 0 }
      - { name: unlocks, type: string[], required: true, note: "accumulates; L2 {tier.2, equipment.filter2, equipment.heater, equipment.autofeeder}, L3 adds {tier.3, equipment.filter3, equipment.light2, equipment.light3} + collector customer; species gating is tier ≤ level plus the egg-layer L2 rule, not an unlock id" }

  - name: Notification
    owner: u6-commerce
    description: One queue entry produced by the mapper or the notify system.
    attributes:
      - { name: id, type: NotificationId, required: true }
      - { name: priority, type: string, required: true, allowed: [info, warn, critical] }
      - { name: kind, type: string, required: true, note: "source event kind or summary kind (e.g. fishSickBatch)" }
      - { name: subjectId, type: string, required: false, note: "fish/cohort/order id the UI focuses; absent for summaries" }
      - { name: message, type: string, required: true }
```

## Money and reputation scalars

`GameState.money` ($FISH, integer, always ≥ 0) and `GameState.reputation` (integer, floor 0) are U6-owned scalars. Every deduction clamps (Q5-A shortfall rule); reputation never goes below 0.

## Summary

U6 fully declares market demand state, the order board entry (with fulfil-time reward semantics), progression with concrete unlock ids (per U2 coordination), and the notification entry. Price-factor inputs it does not own (genomeQuality, colour/rarity loci, water/quality gates) are read through U3/U2 selectors named in `functional-spec.md`.
