# Design System Mapping

> Upstream: `mockups.md`, `interaction-spec.md`. The game has no existing component library; this maps the affirmed style ("vivid deep 2D, layered parallax, caustics") to tokens and components.

## Design Tokens

| Token | Value |
|---|---|
| Color — primary (interactive) | Deep teal `#0d7377` |
| Color — accent (CTA) | Warm coral `#e76f51` |
| Color — surface | Dark navy `#0b1a2a` (tank backdrop) |
| Color — text | Near-white `#eaf6f6` on dark surfaces |
| Color — warning/danger | Amber `#f4a261` / red `#e63946` (always icon + text) |
| Spacing scale | 4 / 8 / 16 / 24 / 32 / 48 px |
| Radius | 8 px panels, 12 px cards |
| Type scale | 12 / 14 / 16 / 20 / 28 px (rem-based) |
| Touch target | 44 px minimum |

## Component Mapping

| Component | Token use |
|---|---|
| Toolbar / tab bar | primary color for active state, 44px targets |
| FishInfoPanel / dialogs | surface color, 8px radius, 16px padding |
| Buttons (primary/secondary/destructive) | accent / primary / danger colors |
| Notification bell | warning color badge, 3:1 contrast |
| Progress bars (health/satiety/XP) | segmented bars, icon + text (never color alone) |

## Non-Colour Indicators

Every status uses icon + text in addition to colour: health/satiety as segmented bars with labels, market direction as up/down arrows, fish health as an icon (healthy / sick / critical).

## Reduced Motion

Caustics and particle effects are disabled under `prefers-reduced-motion`; animations are kept under 300 ms or removed.
