# External Dependency Map

> Upstream: `requirements.md` (Constraints: browser-only, offline-first PWA, no backend), `components.md`, `unit-of-work.md`, `unit-of-work-dependency.md`, `contract-summary.md` (no external API; save JSON is the only artifact that leaves the app), `team-practices.md`, `stories.md`, `mockups.md`. Answer Q7-A: nothing external.

A **Bolt**, one build pass over a piece of the work ending in something that runs, consumes the gated items below. None apply here — the MVP is fully AI-contained (offline-first PWA, PixiJS v8 + Svelte 5 + TypeScript + Vite, no backend, no external services).

## Gated items

| # | External item | Owner | Lead time | Blocks Bolt | If it slips |
|---|---|---|---|---|---|
| — | None. No external APIs, data feeds, approvals, or team hand-offs. | — | — | — | — |

## Why empty

- **No backend/services:** the game runs entirely in the browser; contracts C1–C4 are in-process TypeScript interfaces, C5 is build-time JSON content, C6 is browser storage + file download.
- **Content is in-repo:** 30-species data ships with the bundle (C5); gene/palette fill is content work by the same builder, not an external dependency.
- **Toolchain is local:** Vite + Vitest + PixiJS from npm; CI runs tests before merge but does not gate any Bolt's start.
- **Only outbound artifact:** the exported save JSON (C6) leaves the app to the player's disk — no consumer to coordinate with.

Revisit this file if a Bolt gains an external need (e.g.托管 leaderboard, analytics); until then every Bolt starts unblocked.
