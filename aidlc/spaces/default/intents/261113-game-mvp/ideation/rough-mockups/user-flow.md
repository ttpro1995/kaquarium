# User Flow

> Upstream: `intent-statement.md` (core fantasy), `scope-document.md` (value stream map), `intent-backlog.md` (proto-units and sequencing).

## Core User Flow (happy path)

```
[Open game] ──> [Buy fish] ──> [Feed & care] ──> [Watch grow] ──> [Breed]
                                                                      │
                                                                      v
                    [Reinvest] <──── [Money] <──── [Sell] <── [Grade fry]
                        │
                        └─────► (repeat: bigger tanks, more species)
```

## Steps

1. **Open the game** → the tank loads, fish swim, the HUD shows money/time.
2. **Buy fish** → open Fish Store, buy a juvenile pair, they appear in the tank.
3. **Feed and care** → feed them, watch health/satiety; fix water if it degrades.
4. **Watch them grow** → fish mature over game days; health and colour improve.
5. **Breed** → a mature pair spawns (livebearer / scatter / plant archetypes); eggs hatch into a fry cohort; fry grow with first foods.
6. **Grade** → fry mature into juveniles; decide who to keep, sell, or cull.
7. **Sell** → sell fish (single or bulk); fulfil an order when one matches.
8. **Reinvest** → buy food, equipment, a bigger tank, or rarer species; the loop repeats.

## Error / Recovery Paths

- **Insufficient funds** → the Buy/Sell action is disabled with the missing amount shown, no error dialog needed.
- **Tank full / overstocked** → a warning shows the bioload limit and what to do (sell, cull, or upgrade).
- **Fish sick / dying** → a prioritized notification (icon + text) jumps to the affected fish; a "why" tooltip names the cause.
- **Unsaved progress** → autosave runs in the background; a "Saved" indicator is visible near the HUD.
