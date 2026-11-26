# NFR Design — Questions (u7-presentation)

> Unit U7 NFR requirements: NFR1.1–1.3 (render budget, soak, reduced-motion), NFR2.1 (WCAG AA), NFR3.1 (local RNG), NFR4.1 (settings), NFR5.1 (tests + snapshots). Produces: performance-design.md, security-design.md, logical-components.md, traceability.json.

## Q1. [Model] Render pipeline design (NFR1.1–1.3)

Sprite pool fixed at scene build; steering/particles update in place; lighting is a tint uniform; x4 backlog surfaces the HUD loading indicator (W38) and catch-up runs behind the loading state.

A. As stated: pooled sprites, in-place steering, tint lighting, backlog indicator
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Accessibility + snapshot design (NFR2.1, NFR5.1)

axe-core scoped to shell DOM; Roster row is the keyboard path for canvas fish-click; sprite-catalog snapshots (frozen fixture, ≤ 0.1% pixels, headless Chromium); shell DOM snapshots; 100% sprite-builder branch coverage + soak.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q3. [Model] Fault and settings design (NFR4.1, failure handling)

Fault panel on tick abort (reload to last autosave, no rollback); settings round-trip with built defaults; STALE_SAVE confirm-then-retry; away modal resume at speed 1.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A
