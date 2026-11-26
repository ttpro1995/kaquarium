# Performance Design — u7-presentation

> Upstream: `nfr-requirements/performance-requirements.md` (NFR1.1–1.3), `tech-stack-decisions.md` (PixiJS 8, Svelte 5), `functional-design/functional-spec.md` (W36–W38, W45–W47), `frontend-components.md`, `contract-summary.md` (C2 scheduler pacing, 4-ticks/frame cap). Answers from `nfr-design-questions.md` (Q1 A).

## Design inputs

- NFR1.1 (render ≤ 12 ms/frame; p95 ≤ 20 ms at x1 and x4; render-isolated p95 ≤ 12 ms, deterministic 4-tick burst induction) is enforced by the pipeline below.
- C2 (x1 = 1 game-hour/s; 4 ticks/frame cap; backlog accumulates, loading indicator) drives the backlog design.

## Pipeline

- **Sprite pool**: fixed at scene build — one procedural sprite per fish from catalogue tokens; no per-frame allocation in the steering/particle loop (in-place position/velocity integration).
- **Lighting**: tint uniform + overlay opacity driven by `gameDay`/`gameHour`; no redraw, no per-light sprites; transitions snap under `reducedMotion`.
- **Ambient**: plant sway/bubbles/particles frozen (skipped, not slowed) under `reducedMotion` — contributes zero frame cost.
- **Backlog**: HUD loading indicator when queued ticks exceed one frame's worth (W38); catch-up runs behind the full loading state; frame budget holds regardless.

## Verification mapping

- x1 soak 60 s (expected version delta 60) + x4 soak 60 s (expected version delta 240), p95 frame ≤ 20 ms and max ≤ 50 ms on each; render-isolated probe (speed 0, render-only p95 ≤ 12 ms); reduced-motion within 5% of full (p95).
