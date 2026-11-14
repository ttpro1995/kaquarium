# Accessibility Checklist

> Upstream: `requirements.md` (NFR2: WCAG 2.1 AA), `mockups.md`, `interaction-spec.md`.

## Perceivable

- [ ] Every non-decorative element has a text alternative (fish icons, charts).
- [ ] Text contrast ≥ 4.5:1; UI components ≥ 3:1.
- [ ] Status is never conveyed by colour alone (icon + text + pattern).
- [ ] No content flashes more than 3 times per second.

## Operable

- [ ] All functions work by keyboard (Tab, Enter, Space, arrows, Escape).
- [ ] Focus indicators are visible on every interactive element.
- [ ] No keyboard traps; modals trap focus and restore it on close.
- [ ] Touch targets ≥ 44px on mobile.

## Understandable

- [ ] Consistent navigation and labels across all screens.
- [ ] Input errors name the field and the fix, and preserve the user's input.
- [ ] Destructive actions (cull, bulk sell) confirm before executing.

## Robust

- [ ] Semantic landmarks: header (HUD), main (content), nav (toolbar), dialog (overlays).
- [ ] Heading hierarchy (h1 per screen, h2 per panel) is logical and unskipped.
- [ ] `aria-live` announces the notification queue and level-ups.

## Screen-Specific Notes

- **Tank**: h1 (visually hidden) = "Aquarium Tycoon"; the tank is `main`; toolbar is `nav`.
- **Fish Info / Save Menu**: `dialog` role, focus trapped, Escape closes.
- **Breeding**: h1 = "Breeding"; the list is keyboard-navigable.
- **Statistics**: charts have text summaries; data is never colour-only.
