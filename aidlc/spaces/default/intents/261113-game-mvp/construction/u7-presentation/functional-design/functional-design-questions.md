# Functional Design — Questions (u7-presentation)

> Unit U7 owns TankRenderer + UI + the app composition root: the living-tank diorama (procedural sprites, steering, particles), HUD/toolbar/panels/screens (store, breeding, orders, roster, save/load, notifications, away summary), read-only-over-store discipline with command dispatch, WCAG 2.1 AA, and boot/wiring. Implements US1.1 (AC1.1.1, AC1.1.2) and the U7 share of US11.1 (AC11.1.1 away summary); renders every other unit's state and dispatches their commands (composition root imports each unit's `register`). Grounded in FR1.1, FR9.1–FR9.3, FR10.1, FR12.1, NFR2, C2 (register order), C5 (boot validation), C6 (save/load API, STALE_SAVE). Rule group BR20 (U6 ended at BR19); as a `ui`-kind unit this design carries no `rules.md` — traceability targets name `functional-spec.md` / `frontend-components.md` sections.

## Q1. [Model] Renderer construction (AC1.1.1, AC1.1.2)

PixiJS v8 scene graph; one procedural sprite per fish built from the catalogue palette/pattern/fin tokens; boids-style steering for swim motion (render-only, never touches GameState); bubbles + particles + plant sway as ambient layers; lighting tint follows gameDay/gameHour; all render state (positions, velocities, particles) transient and never serialized.

A. Exactly that: sprite-per-fish + steering + ambient layers + clock-driven lighting
B. Tune — say how
X. Other (please specify)

[Answer]: A A

## Q2. [Model] Day/night and reduced motion (AC1.1.1, NFR2)

Lighting tint and overlay follow the game clock continuously. With `settings.reducedMotion` on, ambient layers (sway, bubbles, particles, lighting transitions) freeze to a calm static scene; fish keep swimming (the tank must stay alive) but at minimal amplitude and no darting.

A. Ambient freezes, fish swim calm, lighting snaps (no transitions)
B. Tune — say how
X. Other (please specify)

[Answer]: A A

## Q3. [Model] Shell layout (FR1.1, FR10.1, FR12.1)

HUD top bar: money ($FISH), level + XP bar, game-day clock, pause/x1/x2/x4 controls, notification bell with unread count. Toolbar tabs: Tank, Store, Breeding, Orders, Roster, Save. Fish panel (click a fish): health with named cause, satiety, size/stage, value preview, sell button. Roster: management table with bulk-select + bulk-sell. Breeding/order/store/save screens dispatch the owning units' commands and read their preview selectors.

A. This tab set + HUD + panel contents
B. Tune — say how
X. Other (please specify)

[Answer]: A + review amendment R-02: Feeding and Settings tabs added (8 total) — the 6-tab set left feeding/water/settings unwirable; Tank tab hosts the Care sections, Feeding and Settings are full tabs (W48/W49). A

## Q4. [Model] Accessibility contract (NFR2)

Every action reachable by keyboard (tabs, buttons, lists all focusable, visible focus, Esc closes dialogs); status never by colour alone (health/demand always icon + text/number); `autoPauseCritical` pauses on critical notifications when set; notifications polite via aria-live, criticals assertive; touch targets ≥ 44px; text scales with system settings.

A. This contract
B. Tune — say how
X. Other (please specify)

[Answer]: A A

## Q5. [Model] Summaries and fault surfacing (AC11.1.1, FR9.3, C6)

Return after catch-up: one "while you were away" modal (elapsed days, hatched/matured/died-of-old-age/orders-expired counts from the event batch) with Resume; fish are shown in protected critical state. Tick-abort fault (a throwing system): full-screen fault panel with the error and "reload to last autosave". Import: corrupt/unsupported/stale outcomes surface the named SaveError with the current save untouched; STALE_SAVE asks for confirm-then-retry.

A. Modal + fault panel + named-error surfacing as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A A

## Q6. [Model] Composition root and boot (C2, C5, C6)

`main.ts` constructs the store from U1's factory, calls each sim unit's `register(registry)` (order imposes no sim order — U1 sorts by phase), subscribes audio/UI to the event bus, mounts the Svelte shell. Boot: invalid species excluded + console-logged per C5 (never crash); storage fallback (IndexedDB → localStorage) warns once in the UI; a boot failure in dev fails loudly, in production shows the fault panel.

A. This wiring and boot behaviour
B. Tune — say how
X. Other (please specify)

[Answer]: A A
