# Feasibility Assessment

> Upstream: `intent-statement.md` — problem statement, target customer, success metrics, and scope signal for the MVP.

## Assessment

The initiative — a browser-based aquarium breeding/management tycoon MVP — is **feasible**. It is a greenfield, browser-only, offline-first build with no backend, no external integrations, and no regulatory obligations. The classes of risk that most often block a project (integration, compliance, infrastructure) are absent here.

## Technical Viability

- **Stack**: PixiJS v8 (rendering) + Svelte 5 (UI) + TypeScript + Vite is a standard, well-supported combination for a 2D browser game, and the solo developer is comfortable with the full stack.
- **No backend**: an offline-first PWA with local persistence removes server, network, and authentication complexity entirely.
- **Determinism**: the fixed-tick, seeded-RNG simulation runs headlessly (no browser needed), which enables the automated balance tests the success metrics require.
- **The open risk**: rendering 150 animated fish at ≥ 50 fps on a Meizu Lucky 08 (the reference mid-range phone) via procedural sprites is the one genuinely uncertain element and the item to validate first.

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rendering performance below target on the reference device | Medium | High | Validate first with a procedural-sprite + 150-fish benchmark scene, before building the full game |
| Procedural sprite scope (many phenotype combinations) | Medium | Medium | Quantize phenotypes and cap the texture atlas (per the architecture doc) |
| Save size / corruption in late game | Low | High | Versioned schema + migrations; cohort-based fry; autosave slots + JSON export |
| Determinism drift from stray randomness | Low | Medium | Seed-only RNG; replay test |

## Verdict

**Feasible.** Proceed to scope definition. Rendering performance is the first thing to validate.
