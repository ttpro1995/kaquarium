# Interaction Specification

> Upstream: `mockups.md`, `wireframes.md`. Component format follows the component-spec-template.

## Toolbar

| Field | Value |
|---|---|
| Component | Toolbar |
| Description | Primary navigation across the eight screens |
| Category | navigation |

### States

| State | Description | Trigger |
|---|---|---|
| default | All tabs visible, active tab highlighted | page load |
| active | One tab emphasized (icon + label) | selected |
| overflow | Remaining tabs behind "More" | mobile, > 5 tabs |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | Bottom tab bar, 5 primary + "More" overflow |
| tablet/desktop (>768px) | Bottom dock, all tabs visible |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | navigation |
| Keyboard interaction | Tab to focus, Enter/Space to switch tabs |
| Label | Each tab has a visible text label |
| Contrast ratio | 3:1 for the active-tab indicator |
| Focus management | Active tab carries a visible focus ring |

## FishInfoPanel

| Field | Value |
|---|---|
| Component | FishInfoPanel |
| Description | Overlay showing one fish's state and actions |
| Category | display |

### States

| State | Description | Trigger |
|---|---|---|
| default | Fish stats + Sell/Move/Rename/Cull | tap a fish |
| loading | Skeleton while the fish loads | slow device |
| error | "Couldn't load this fish — retry" | load failure |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| fishId | string | yes | — | the fish to display |
| onClose | fn | yes | — | dismiss the panel |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | dialog |
| Keyboard interaction | Enter/Space to open actions, Escape to close |
| Label | aria-labelledby → fish name |
| Contrast ratio | 4.5:1 for body text |
| Focus management | Focus moves to the panel on open; returns to the fish on close |

## BreedingScreen

| Field | Value |
|---|---|
| Component | BreedingScreen |
| Description | Shows gravid pairs, eggs/fry, and breeding conditions |
| Category | display |

### States

| State | Description | Trigger |
|---|---|---|
| default | Pairs, eggs, fry, and conditions listed | open Breeding tab |
| empty | "No fish yet — buy a pair to start breeding" | no mature fish |
| error | "Couldn't load breeding state — retry" | load failure |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | main |
| Keyboard interaction | Tab through the list; Enter/Space on actions |
| Label | h1 = "Breeding" |
| Contrast ratio | 4.5:1 text |
| Focus management | Tab order follows the list |

## NotificationQueue

| Field | Value |
|---|---|
| Component | NotificationQueue |
| Description | Prioritized alerts; click focuses the subject |
| Category | feedback |

### States

| State | Description | Trigger |
|---|---|---|
| default | Bell with unread count | events fire |
| expanded | Dropdown list of notifications | bell clicked |
| empty | No notifications | none pending |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | list / alert for critical |
| Keyboard interaction | Tab to bell, Enter to open, arrows to move |
| Label | aria-label = "Notifications" |
| Contrast ratio | 3:1 for the bell badge |
| Screen reader | aria-live="polite" announces new items |

## SaveMenu

| Field | Value |
|---|---|
| Component | SaveMenu |
| Description | Manual save/load and JSON export/import |
| Category | navigation |

### States

| State | Description | Trigger |
|---|---|---|
| default | Save/Load/Export/Import actions | gear clicked |
| saving | "Saving…" then "Saved" | Save now |
| error | "Export failed — retry" | export failure |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | dialog |
| Keyboard interaction | Enter/Space to activate, Escape to close |
| Label | h2 = "Save & Load" |
| Focus management | Focus trapped; returns to the gear on close |
