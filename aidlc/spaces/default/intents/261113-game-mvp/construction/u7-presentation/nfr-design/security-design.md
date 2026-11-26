# Security Design — u7-presentation

> Upstream: `nfr-requirements/security-requirements.md` (NFR2.1, NFR3.1, NFR4.1, NFR5.1), `tech-stack-decisions.md` (Svelte 5, PixiJS 8, axe-core, PWA plugin pins), `functional-design/functional-spec.md` (W38, W43–W47), `frontend-components.md`, `contract-summary.md` (C5, C6). Answers from `nfr-design-questions.md` (Q2–Q3 A).

## Design inputs

- NFR2.1 (WCAG AA: scoped axe, Roster keyboard path, 200% zoom, screen-reader passes) is implemented by the shell structure below.
- NFR4.1 (settings round-trip with built defaults) and W44–W47 (save/load, fault, away, boot) define the failure/surface design.

## Accessibility design (NFR2.1)

- axe-core audit scoped to the shell DOM (canvas excluded by design); zero serious/critical in CI.
- Roster row → FishPanel is the keyboard path for every canvas fish action; all tabs/dialogs focusable with visible focus and Esc-to-close.
- 200% zoom layout check; aria-live polite, criticals assertive; `autoPauseCritical` honoured.

## Snapshot + coverage design (NFR5.1)

- Sprite catalog: one render per species genome variant from a frozen fixture, headless Chromium, ≤ 0.1% differing pixels.
- Shell DOM snapshots for panels; 100% sprite-builder branch coverage via the catalog fixture + soak (replaces line coverage for renderer modules).

## Failure + settings design (NFR4.1)

- Tick abort → full-screen fault panel, reload to last autosave, no store rollback (C2).
- Settings persist through the C6 envelope with built defaults (`false`/`true`/`0.8`/`0.8`); old-save fixture gains them.
- STALE_SAVE confirm-then-retry; import errors named with current save untouched; away modal resumes at speed 1 (`clock.setPaused { paused: false }`).

## What's explicitly not built

No auth, no encryption, no PII (settings are local prefs), no network beyond the PWA shell cache. No auto-recovery beyond autosave reload.
