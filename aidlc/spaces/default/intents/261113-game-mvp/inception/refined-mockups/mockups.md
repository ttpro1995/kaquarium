# Refined Mockups

> Upstream: `wireframes.md` + `user-flow.md` (rough pass), `stories.md` (25 stories), `requirements.md` (FR1–FR12), `team-practices.md` (WCAG-driven, TDD). Refines the rough wireframes and resolves the rough-pass review findings (breeding UI, save/load UI, empty states, market surface, label consistency, mobile).

## Layout

- **Desktop**: tank front and center; toolbar as a bottom dock; HUD across the top.
- **Mobile**: tank full-bleed; bottom tab bar (Tank · Store · Fish · Breeding · More); panels slide up from the bottom.
- **Toolbar labels (consistent)**: Tank · Fish Store · Food · Upgrades · Fish Management · Statistics · Customers · Breeding.

## Screens

### 1. Tank (hub)

As the rough wireframe, with three refinements:

- **HUD** adds a gear icon (right) opening the Save/Load menu, and the level + XP readout next to money.
- **Empty state** (first open): the tank renders with water but no fish, and a centered prompt — "Buy your first fish" → opens Fish Store.
- **Market indicator**: the HUD shows a small "market" chip; tapping it opens a market popover with per-species demand (fixes the invisible-saturation finding).

### 2. Fish Info (overlay)

As the rough wireframe, plus:

- A **market line** in the value row: "Value $FISH 18 · market ×1.05 (rising)" so saturation is visible where the player sells.

### 3. Breeding (new — dedicated screen)

```
+-------------------------------------------------------------------+
| HUD: $FISH 1,240   Day 3                (gear)                    |
+-------------------------------------------------------------------+
| Breeding                                                          |
|  Pairs ready:                                                      |
|   - Guppy F (gravid, 2d left)         [Move to breeding tank]     |
|  Eggs / fry:                                                       |
|   - Neon Tetra eggs (8) · hatch in 1d                              |
|   - Guppy fry cohort ×12 · juvenile in 4d                          |
|  Conditions: temp 26°C · pH 7.0 · plants present                  |
+-------------------------------------------------------------------+
| Tank | Fish Store | Food | Upgrades | Manage | Stats | Customers   |
+-------------------------------------------------------------------+
```

- **Accessibility**: h1 = "Breeding"; landmark = main (list) / nav (toolbar); keyboard entry = first action button.

### 4. Save/Load menu (gear overlay)

```
+-------------------------------------------+
| Save & Load                               |
|  [Save now]   [Load…]                     |
|  Autosave: on (every 30s)                 |
|  [Export JSON]  [Import JSON…]            |
+-------------------------------------------+
```

- **Accessibility**: h2 = "Save & Load"; landmark = dialog (focus trapped); Escape closes and returns focus to the gear.

### 5. Fish Store (buy — core loop)

Buying is a core-loop step, so the buy surface gets a full flow:

```
+-------------------------------------------------------------------+
| HUD: $FISH 1,240   Day 3                (gear)                    |
+-------------------------------------------------------------------+
| Fish Store                                    [filter: species]    |
|  - Guppy        T1   $FISH 12    [Buy]                            |
|  - Neon Tetra   T1   $FISH 10    [Buy]                            |
|  - Corydoras    T1   $FISH 9     [Buy] (not enough money)         |
+-------------------------------------------------------------------+
| Tank | Fish Store | Food | Upgrades | Manage | Stats | Customers   |
+-------------------------------------------------------------------+
```

- **Buy action**: tap Buy → the juvenile appears in the tank → money decreases by the price → a toast confirms ("Guppy added").
- **States**: empty (no species match the filter), loading (skeleton list), disabled Buy (insufficient funds, with the missing amount shown), populated.
- **Accessibility**: h1 = "Fish Store"; landmark = main (list) / nav (toolbar); keyboard entry = first Buy control.

### 6–8. Food / Upgrades / Statistics / Customers

As the rough wireframes, with: consistent labels, an **empty state** per list ("No food yet — buy some in Food"), and a **loading skeleton** on first open. The Statistics screen shows market demand alongside revenue.

## Screen States (every screen)

- **Empty**: a short explanation + the primary action.
- **Loading**: a content-shaped skeleton.
- **Error**: plain-language message + recovery action (e.g. "Couldn't load — retry").
- **Populated**: the normal state.

## Responsive

- **< 768px**: bottom tab bar; panels slide up; 44px touch targets.
- **768–1024px**: docked toolbar; two-pane where useful.
- **> 1024px**: full dock; popovers for secondary info.
