# Wireframes (Low-Fidelity)

> Upstream: `intent-statement.md` (core fantasy, MVP boundary), `scope-document.md` (core loop), `intent-backlog.md` (proto-units). These are rough concept wireframes, not final design.

## Information Architecture

```
Aquarium Tycoon (app)
├── Tank (main screen, entry point)
│   └── Fish info panel (overlay)
├── Fish Store
├── Food
├── Upgrades
├── Fish Management
├── Statistics
└── Customers (orders)
```

The tank is the hub; every other screen is a toolbar tab. The fish info panel is an overlay reached by tapping/clicking a fish.

## Wireframes

### 1. Main Tank Screen

```
+-------------------------------------------------------------------+
| HUD: $FISH 1,240   Day 3   [Pause] [x1] [x2] [x4]        (bell)   |
+-------------------------------------------------------------------+
|                                                                   |
|                                                                   |
|                     TANK  (living diorama)                        |
|          fish swim here · plants sway · caustic light             |
|                                                                   |
|                                                                   |
+-------------------------------------------------------------------+
| Tank | Store | Food | Upgrades | Manage | Stats | Customers        |
+-------------------------------------------------------------------+
```

- Accessibility: h1 = game title (visually hidden); landmarks = header (HUD) / main (tank) / nav (toolbar); keyboard entry = toolbar is first tab stop, then the tank.

### 2. Fish Info Panel (overlay on tank)

```
+------------------------------------------+
| [x] Guppy · Female · Adult                |
|                                          |
| Health  [####----]   Satiety [######--]  |
| Size 3.2 cm · Age 14d · Genetic ** (2)   |
| Value $FISH 18                            |
|                                          |
| [Sell] [Move] [Rename] [Cull]  (actions) |
+------------------------------------------+
```

- Accessibility: h2 = fish name; landmark = dialog (focus trapped while open); keyboard entry = panel opens focused on the close control, Escape closes.

### 3. Fish Store

```
+-------------------------------------------------------------------+
| HUD: $FISH 1,240   Day 3                                           |
+-------------------------------------------------------------------+
| Fish Store                                          (filter/sort) |
|  - Guppy        T1  $FISH 12   [Buy]                               |
|  - Neon Tetra   T1  $FISH 10   [Buy]                               |
|  - Corydoras    T1  $FISH 9    [Buy]                               |
|  ...                                                               |
+-------------------------------------------------------------------+
| Tank | Store | Food | Upgrades | Manage | Stats | Customers        |
+-------------------------------------------------------------------+
```

- Accessibility: h1 = "Fish Store"; landmark = main (list) / nav (toolbar); keyboard entry = first "Buy" button in the list.

### 4. Food

```
+-------------------------------------------------------------------+
| HUD: $FISH 1,240   Day 3                                           |
+-------------------------------------------------------------------+
| Food                                                              |
|  - Flakes         x12   [Feed]                                    |
|  - Fry powder     x4    [Feed]                                    |
|  - Live Artemia   x2 (expires soon)  [Feed]                       |
+-------------------------------------------------------------------+
| Tank | Store | Food | Upgrades | Manage | Stats | Customers        |
+-------------------------------------------------------------------+
```

- Accessibility: h1 = "Food"; landmark = main (list) / nav (toolbar); keyboard entry = first "Feed" control.

### 5. Upgrades

```
+-------------------------------------------------------------------+
| HUD: $FISH 1,240   Day 3                                           |
+-------------------------------------------------------------------+
| Upgrades                                                          |
|  - Standard Tank (60L)   $FISH 400   [Upgrade]                    |
|  - Heater                $FISH 60    [Buy]                        |
|  - Better Filter         $FISH 120   [Buy]                        |
+-------------------------------------------------------------------+
| Tank | Store | Food | Upgrades | Manage | Stats | Customers        |
+-------------------------------------------------------------------+
```

- Accessibility: h1 = "Upgrades"; landmark = main (list) / nav (toolbar); keyboard entry = first "Buy"/"Upgrade" control.

### 6. Fish Management (roster)

```
+-------------------------------------------------------------------+
| HUD: $FISH 1,240   Day 3                                           |
+-------------------------------------------------------------------+
| Fish Management                              (species filter)     |
|  [ ] Guppy M · Adult · 3.2cm · $18                                  |
|  [ ] Guppy F · Adult · 3.1cm · $19   (gravid)                      |
|  [ ] Guppy fry cohort · 12 · —                                      |
|  [Bulk sell] [Bulk cull]                                          |
+-------------------------------------------------------------------+
| Tank | Store | Food | Upgrades | Manage | Stats | Customers        |
+-------------------------------------------------------------------+
```

- Accessibility: h1 = "Fish Management"; landmark = main (roster table) / nav (toolbar); keyboard entry = first row's checkbox.

### 7. Statistics

```
+-------------------------------------------------------------------+
| HUD: $FISH 1,240   Day 3                                           |
+-------------------------------------------------------------------+
| Statistics                                                        |
|  Fish: 24   Sales: 41   Fry: 60   Level 2 (XP [###-----])         |
|  Revenue by species (chart) · Death causes (list)                 |
+-------------------------------------------------------------------+
| Tank | Store | Food | Upgrades | Manage | Stats | Customers        |
+-------------------------------------------------------------------+
```

- Accessibility: h1 = "Statistics"; landmark = main / nav (toolbar); keyboard entry = first stat value (chart/list is not the only presentation of the data).

### 8. Customers (orders)

```
+-------------------------------------------------------------------+
| HUD: $FISH 1,240   Day 3                                           |
+-------------------------------------------------------------------+
| Customers (orders)                                                |
|  - Hobbyist: 5 Guppies (min 3cm)      due Day 4   [Fulfil]        |
|  - Pet shop: 20 Neon Tetras           due Day 5   [Fulfil]        |
+-------------------------------------------------------------------+
| Tank | Store | Food | Upgrades | Manage | Stats | Customers        |
+-------------------------------------------------------------------+
```

- Accessibility: h1 = "Customers"; landmark = main (order list) / nav (toolbar); keyboard entry = first "Fulfil" control.
