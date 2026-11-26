# Tech Stack Decisions — u7-presentation

> Upstream: `requirements.md` constraints (pinned stack: PixiJS v8 + Svelte 5 + TypeScript + Vite; offline-first PWA), team Code Style. Answers from `nfr-requirements-questions.md` (Q4 A).

| Choice | Decision | Rationale |
|---|---|---|
| Renderer | PixiJS 8 (`pixi.js@^8.23.0`) | Pinned stack; sprite pool + tint lighting per W36/W37; render state transient. |
| UI framework | Svelte 5 (`svelte@^5.59.1`, same Vite build as sim) | Pinned stack; fine-grained reactivity fits selector + version-bump reads. |
| Language | TypeScript (strict, shared tsconfig) | Shared command/selector types with U1–U6; no `any` at sim boundaries. |
| Build/PWA | Vite + PWA shell (manifest + service worker via `vite-plugin-pwa@^2.0.0`, offline-first) | Pinned offline-first constraint; sim + shell ship as one monolithic artifact (U7 composition root). |
| Test runner | Vitest + `--coverage` 80% line floor (shell logic), axe-core (`axe-core@^4.14.1`, dev) audit, keyboard walkthrough | Workspace-wide config; renderer visuals via catalog snapshot + soak, not line coverage (NFR5.1). |
| Lint/format | ESLint per repo `eslint.config.js` (+ Svelte plugin at codegen; CI-blocking); no formatter configured yet | Same tracking note as U2–U6 — follows ESLint until the team configures one. |
| Dependencies | New vs sim units: `pixi.js@^8.23.0`, `svelte@^5.59.1`, `axe-core@^4.14.1` (dev), `vite-plugin-pwa@^2.0.0` — versions verified installable at NFR time; codegen installs and commits the lockfile | Renderer/UI-only; sim packages stay dependency-free. |
