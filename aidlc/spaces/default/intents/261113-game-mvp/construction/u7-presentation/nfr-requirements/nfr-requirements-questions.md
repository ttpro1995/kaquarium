# NFR Requirements — Questions (u7-presentation)

> Unit U7 owns TankRenderer + UI + composition root. U7 is the `ui` kind: this pass also produces performance-requirements.md. Inception NFRs: NFR1 (100-fish ≥ 50 fps on Meizu Lucky 08), NFR2 (WCAG 2.1 AA), NFR3 (seeded determinism — render path), NFR4 (versioned saves — settings + UI prefs), NFR5 (TDD, 80% line floor, CI).

## Q1. [Model] Render frame budget (NFR1)

Sim holds ≤ 8 ms/frame; rendering owns the remaining ≥ 12 ms at 50 fps: 100 procedural sprites + steering + particles + lighting in PixiJS 8.

A. Render ≤ 12 ms/frame at 100 fish on the reference device (sprite pool, no per-frame allocation in the steering loop); benchmark scene asserts p95 frame time ≤ 20 ms with sim running at x1
B. Tune — say how
X. Other (please specify)

[Answer]: A + review amendments R-01/R-02: x4 p95 ≤ 20 ms gate + render-isolated probe (speed 0, render-only p95 ≤ 12 ms) added; scheduler contract pinned (x1 = 1 game-hour/s); soak defined as 60 s x4 → Δversion 240, p95 ≤ 20 ms, max ≤ 50 ms, with HUD backlog indicator (W38).

## Q2. [Model] Accessibility verification (NFR2)

WCAG 2.1 AA contract from the shell design: keyboard parity, icon+text, aria-live, 44px targets, reduced-motion, text scaling.

A. Verify by: keyboard-only walkthrough of every tab/dialog in CI (tab-order test), axe-core audit on the shell with zero serious/critical violations, reduced-motion snapshot (ambient frozen), focus-visible + target-size checks; manual screen-reader pass at milestones
B. Tune — say how
X. Other (please specify)

[Answer]: A + review amendment R-03: axe scoped to shell DOM (canvas excluded by design); Roster row is the keyboard path for canvas fish-click; 200% zoom layout check added.

## Q3. [Model] Render determinism and settings persistence (NFR3/NFR4)

Render state is excluded from saves and replay (positions/steering/particles never serialized); `settings` (reducedMotion, autoPauseCritical, volume) persist through the C6 save envelope like any GameState field.

A. Confirm: renderer reads the seeded sim but its own motion needs no determinism guarantee (visual-only, re-seeded per mount from ctx-independent local RNG); settings round-trip through save/load with defaults on old saves
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q4. [Model] Tech stack for U7 (tech-stack-decisions)

Svelte 5 + PixiJS 8 + TypeScript strict + Vite (pinned stack); Vitest + 80% line floor in CI for shell logic, axe-core for a11y audit; ESLint + Svelte plugin per repo config (no formatter configured in this repo); PWA shell (manifest + service worker) offline-first.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A
