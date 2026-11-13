# Constraint Register

> Upstream: `intent-statement.md` — the MVP boundary and success metrics constrain what must be built.

## Technical Constraints

- Browser-only (HTML5), desktop and mobile; offline-first PWA; no backend.
- Stack: PixiJS v8 + Svelte 5 + TypeScript + Vite (the developer is comfortable with the full stack).
- Performance target: 150 fish at ≥ 50 fps on a Meizu Lucky 08 (the reference mid-range phone).
- Deterministic, seeded simulation (enables headless testing and offline catch-up).
- MVP boundary: one tank; store; feeding, growth, health and death; core breeding for three archetypes; selling with a market; basic orders; levels 1–3; autosave.

## Organizational Constraints

- Solo developer — single decision-maker, no external approvals.
- No hard budget or timeline — paced as an MVP.
- No change freeze or competing priorities.

## Regulatory Constraints

- None. Single-player, offline, no personal data collected, no monetization.
