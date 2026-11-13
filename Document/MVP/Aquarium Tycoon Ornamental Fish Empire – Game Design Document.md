# Aquarium Tycoon: Ornamental Fish Empire – Game Design Document

Version 0.1 (refined from the original brief) · Platform: browser (desktop and mobile) · Status: pre-production

## 1. Executive Summary

**One-line pitch:** Grow a tiny home aquarium into a world-famous ornamental fish empire by caring for individual fish, breeding better genetics, and out-thinking a living market.

**Genre:** Management simulation / breeding tycoon with an ambient "living diorama" presentation.

- Primary: Tycoon / economic management
- Secondary: Creature-breeding and genetics sim (in the tradition of Niche, Equilinox, Creatures)
- Tertiary: Cozy aquascaping / virtual pet care

**Platform:** HTML5 in the browser, desktop and mobile, single-player, offline-capable, no backend required.

**Target audience:**

- Core: players of tycoon and management sims who enjoy optimization loops (RollerCoaster Tycoon, Game Dev Tycoon, Stardew-style farming).
- Secondary: real aquarium hobbyists who want a faithful but forgiving simulation.
- Tertiary: cozy-game players who want a relaxing tank to watch and decorate.

**Unique selling points:**

1. Every fish is an individual with a unique ID, genome, health history and value.
2. A readable genetics system where breeding choices matter (colour lines, rare mutations, inbreeding risk).
3. A dynamic market that punishes single-species spam and rewards diversification and specialization.
4. Real husbandry depth (water cycle, feeding, compatibility, breeding triggers) presented through clear, friendly UI.

## 2. Design Pillars

Every feature must support at least one pillar. When two features conflict, the higher pillar wins.

1. **Every fish matters.** Players should notice, name and worry about individuals. Systems expose individual state (health, lineage, colour) rather than hiding it in aggregates.
2. **Care creates value.** Money comes from good husbandry and smart breeding, not from waiting. Neglect has visible, fair consequences.
3. **Meaningful choices, no dominant strategy.** Species differ in risk, speed, capital need and market. The economy actively counters any single-species loop.
4. **A tank worth watching.** Even when idle, the tank must look alive, beautiful and readable.
5. **Depth you can grow into.** Early game teaches 3 systems; later game layers in genetics, contracts and multi-tank logistics. Complexity is unlocked, never dumped.

## 3. Player Fantasy and Experience Goals

- **Fantasy:** "I'm the breeder whose fish everyone wants."
- **Moment-to-moment feeling:** calm, attentive, nurturing, with small spikes of tension (a sick fish, a pH swing) and delight (first fry, a rare mutation).
- **Session feeling:** "One more day": there is always a fry batch about to mature, an order about to expire, an upgrade almost affordable.
- **Long-term feeling:** mastery, from keeping fish alive, to breeding for colour, to running a business.

**Anti-goals:** no real-money monetization, no punishing permadeath spirals, no idle auto-income, no hidden numbers the player cannot learn from.

## 4. Core Game Loops

### 4.1 Micro loop (seconds to minutes): Observe → Care

1. Look at the tank; spot problems (hungry, sick, stressed, ready to breed) via fish behaviour and icons.
2. Act: feed, adjust, medicate, move fish, change water.
3. See immediate feedback (fish eat, colours brighten, water clears).

### 4.2 Session loop (10 to 30 minutes): Plan → Breed → Grow → Sell → Reinvest

1. **Plan:** check orders, market demand and tank space.
2. **Stock:** buy juveniles or pairs that fit the plan.
3. **Care and breed:** hold ideal conditions, wait for spawning, protect eggs and fry.
4. **Grade:** decide who to keep as breeders, who to sell, who to cull or relocate.
5. **Sell:** fulfil orders (best margin) or sell to the open market.
6. **Reinvest:** food, plants, equipment, bigger tanks, rarer species.

### 4.3 Macro loop (hours): Specialize → Expand → Prestige

- Build bloodlines (stable colour strains), earn reputation, unlock premium customers, species and facilities, and scale into a multi-tank farm and then an empire.

```
Care ──► Healthy, colourful fish ──► Breeding ──► Fry ──► Grown fish
  ▲                                                          │
  │                                                       Grade & sell
  └── Reinvest (food, tanks, gear, species) ◄── Money ◄──────┘
                      ▲
            Market demand + Orders + Reputation (shapes what sells best)
```

**Key tension (the "fun engine"):** limited tank space and attention versus the growing opportunity to produce more. Water quality, capacity and time are the scarce resources, not money alone.

## 5. Gaps in the Original Brief (addressed here)

The brief is strong on content lists but under-specifies systems. This GDD adds:

- **Disease and treatment** (notifications mention "sick" but no system existed).
- **Compatibility and aggression** (Tiger Barbs, male Bettas, Cichlid territory).
- **Culling, grading and sorting** (essential for genetics and capacity management).
- **Nitrogen cycle for new tanks** (the classic beginner trap, made teachable).
- **Market saturation** (the concrete economic balancing mechanism).
- **Species breeding archetypes** (to implement 30 species without 30 custom systems).
- **Fry cohorts** (performance and UX for hundreds of fry).
- **Pacing targets and metrics** (so balance can be tested, not guessed).

## 6. Game Systems

### 6.1 Time

- **Scale:** 1 game hour ≈ 10 real seconds at x1 (1 game day ≈ 4 real minutes). Speeds: Pause, x1, x2, x4.
- **Day/night cycle:** drives lighting, fish activity (sleep at night, some species nocturnal), plant oxygen behaviour, and auto-light schedules.
- **Simulation steps:** life simulation runs on a fixed tick (1 game hour) independent of frame rate, so speed changes and background tabs stay deterministic.
- **Offline/background:** on return, simulate up to 8 game-days at coarse resolution with an "While you were away" summary. Fish never die while away from neglect alone; they drop to a protected "critical" state (avoids punishing real life).
- **Auto-pause:** optional pause on critical events (disease outbreak, tank crash).

### 6.2 Fish: Data Model and Life Cycle

Each fish is a record with a unique ID (not a shared species object):

| Field group | Contents |
| --- | --- |
| Identity | `id`, `speciesId`, optional player-given name, sex, birth day, parent IDs (lineage) |
| Genome | allele pairs for colour, pattern, fin, size, vigor loci (see 6.4) |
| State | health (0 to 100), satiety (0 to 100), stress, age, size (cm), disease flags |
| Reproduction | maturity flag, last-spawn day, pregnancy/pair-bond state, clutch history |
| Derived | phenotype colour, genetic quality score, current sale value |

**Life stages:** Egg → Fry → Juvenile → Adult → Senior.

- Stage thresholds are per species (maturity days, lifespan days).
- Growth follows a saturating curve: fast when young, slowing near adult size. Growth rate multiplier = food quality × water quality × temperature fit × (1 − overcrowding penalty).
- Seniors lose breeding ability and eventually die of old age (a gentle, expected ending, with a small memorial note in lineage history).

**Health model (0 to 100):** each tick, health changes by regeneration minus the sum of stressors:

- Hunger, poor water (ammonia/nitrite/low O2), temperature or pH outside tolerance, overcrowding, aggression/bullying, disease.
- Health below 40 reduces colour and breeding; below 15 risks death; 0 is death.
- Clear thresholds and a visible "why" tooltip ("Stress: pH too high, bullied by Tiger Barb") keep losses learnable.

**Behaviour (visual simulation):** boids-style steering with per-species traits: schooling (tetras, rasbora), territorial (cichlids, bettas), bottom-dwelling (corydoras, loaches, plecos), surface (killifish, gourami). Behaviour reflects state: hungry fish swim to the surface, sick fish hover and clamp fins, ready-to-breed fish display.

### 6.3 Species Catalogue and Breeding Archetypes

Implementing 30 species is done with a small set of **archetypes** plus per-species data, not 30 bespoke systems.

| Code | Archetype | Mechanism |
| --- | --- | --- |
| LB | Livebearer | Mating → gestation (visible "gravid" mother) → brood of free-swimming fry; adults may eat fry |
| SC | Scatter spawner | Triggered by conditioning, temperature/light cue; hundreds of eggs, no care, parents eat eggs |
| PL | Plant/substrate depositor | Needs plants, moss or flat surfaces; fewer, safer eggs |
| CV | Cave/pair spawner | Pair bond + cave or leaf/slate; parental care, small clutches, high fry survival |
| BN | Bubble-nester | Male builds nest, guards eggs; female must be removed or protected after spawning |
| AN | Annual/peat spawner | Eggs buried in substrate, need a dry/dormant period before hatching |
| HB | Hard-breed / trade-only | Hard to spawn without special triggers; mainly bought and resold |

| # | Species | Arch. | Price tier | Care |
| --- | --- | --- | --- | --- |
| 1 | Guppy | LB | T1 | Easy |
| 2 | Molly | LB | T1 | Easy |
| 3 | Platy | LB | T1 | Easy |
| 4 | Swordtail | LB | T1 | Easy |
| 5 | Endler Guppy | LB | T2 | Easy |
| 6 | Neon Tetra | SC | T1 | Medium |
| 7 | Cardinal Tetra | SC | T2 | Hard (soft, acidic water) |
| 8 | Ember Tetra | SC | T1 | Easy |
| 9 | Rummy Nose Tetra | SC | T2 | Hard |
| 10 | Zebra Danio | SC | T1 | Easy |
| 11 | Celestial Pearl Danio | PL | T3 | Medium |
| 12 | Harlequin Rasbora | PL | T1 | Medium |
| 13 | Chili Rasbora | SC | T2 | Medium |
| 14 | Betta | BN | T2 | Medium |
| 15 | Angelfish | CV | T2 | Medium |
| 16 | Corydoras | PL | T1 | Medium |
| 17 | Otocinclus | PL | T2 | Hard |
| 18 | Bristlenose Pleco | CV | T2 | Medium |
| 19 | Cherry Barb | SC | T1 | Easy |
| 20 | Tiger Barb | SC | T1 | Easy (fin-nipper) |
| 21 | Goldfish | SC | T1 to T3 (varieties) | Easy (needs large tank) |
| 22 | Discus | CV | T4 | Very hard |
| 23 | Killifish | AN | T3 | Medium to hard |
| 24 | White Cloud Mountain Minnow | SC | T1 | Easy |
| 25 | Rainbowfish | SC | T2 | Medium |
| 26 | German Blue Ram | CV | T3 | Hard |
| 27 | Apistogramma | CV | T3 | Hard |
| 28 | Gourami | BN | T2 | Medium |
| 29 | Kuhli Loach | HB | T2 | Medium |
| 30 | Siamese Algae Eater | HB | T2 | Medium |

**Per-species data sheet (data-driven JSON):** Vietnamese and English names; buy price (juvenile); base sell price; adult size; lifespan; maturity days; diet (type, preference); breeding archetype and clutch range; breeding conditions (temp, pH, hardness, plants/caves, ratio); care difficulty; aggression and compatibility tags; schooling size; commercial value tier; colour palette and pattern definitions; rarity.

**Design intent by tier:**

- **T1 (volume fish):** cheap, fast, forgiving, low margins that saturate quickly. Teach the loop.
- **T2 (specialty):** need a specific setup; moderate margin.
- **T3/T4 (premium):** slow, finicky, high capital and risk; high margin and prestige orders.
- **HB species:** a trader's play: buy, condition and resell, rather than breed.

The store sells **juveniles** at about 50 to 70 percent of maturity, with sex determined randomly at birth (50/50, with archetype exceptions below). Special cases to simulate: Betta males cannot share a tank; Gourami and Betta males guard nests; Apistogramma and Ram are harem or pair based; Goldfish need sex ratios of several males per female for spawning; Killifish pairs need the dormancy cycle.

### 6.4 Genetics and Mutation

A light, readable Mendelian model, deliberately simplified so players can reason about it.

- Each fish has **5 to 6 loci** (e.g., Base Hue, Pattern, Fin Form, Body Size, Vigor, plus one species-specific locus). Each locus has two alleles with defined dominance.
- **Inheritance:** each parent passes one random allele per locus. Recessive traits (e.g., albino, long-fin variants, gold morphs) can hide in carriers and reappear, so the player learns testcrossing.
- **Mutation:** \~1 to 2 percent per locus per birth creates a new allele; rare cosmetic mutations (metallic, albino, koi pattern, etc.) are the "jackpot" and carry high rarity value.
- **Phenotype = genes × environment:** colour intensity depends on diet (live food and colour-enhancing feed), light spectrum and health. Genes set the ceiling; care reaches it.
- **Inbreeding:** tracked from lineage; high inbreeding coefficient reduces vigor, fertility and survival and raises deformity chance. This forces occasional outcrossing and makes good stock valuable.
- **Genetic quality score (0 to 100):** shown to the player as a star rating; drives price and breeder value.
- **Strains (late game):** stabilize a trait for several generations to register a named **bloodline**, which grants a permanent price bonus and unlocks collector orders.
- **Cross-species:** only hybrids within compatible genus pairs (e.g., Platy × Swordtail, Guppy × Endler) are allowed, producing fertile or sterile offspring depending on pair. This is a post-MVP feature.

### 6.5 Breeding

**Gate conditions (all must pass):** both fish mature; male and female present in the same tank; satiety ≥ threshold; health ≥ threshold; no active disease; water inside species breeding range; archetype-specific requirement (cave, plants, bubble nest, dormancy).

**Breeding score:** each tick the fish computes a 0 to 1 `breedingCondition` from weighted factors (nutrition, water, temperature fit, light, shelter, live-food bonus, stress, sex ratio). Spawning attempt chance = species base rate × condition score. Good care shortens cycles and raises clutch size; poor care yields no spawn, not a punishment spiral.

**Livebearers:** conception → gestation (timer visible as a gravid belly) → birth of `clutchSize` fry, scaled by mother size, condition and species range. Adults may cannibalize fry unless plants, moss or a breeder box offer cover.

**Egg-layers:**

- Clutch → eggs with fertility roll (e.g., 60 to 90 percent) → hatch timer → fry.
- Unfertilised or fungused eggs turn white and spread fungus; the player can remove them.
- Parents of scatter species eat eggs; players can move parents out (**Spawning tank/mop**), or use dense moss.
- Fry start as **free-swimming larvae** that need first foods (see 6.6), otherwise survival drops sharply.

**Fry cohorts (design and performance):** fry are tracked as **cohorts** (genome samples + counts + age + shared state) until they become juveniles. At the juvenile "grading" moment they become individual fish with unique IDs. This keeps the screen readable and the simulation fast, while still honouring "every fish is an individual" for everything that can be sold or bred.

**Breeding statistics tracked:** number of breeding events, total fry, survival rate (egg → fry → juvenile → adult), mature fish count, fry production by species, best genetic scores, mutation log.

### 6.6 Food and Care

**Food categories**

| Category | Items | Primary effects |
| --- | --- | --- |
| Fry food | Powder, newly hatched Artemia, infusoria/micro-organisms, micro worms | Fry growth and survival, prevents stunting |
| Adult staples | Pellets, flakes, sinking granules, species-specific diets | Maintenance, steady growth, baseline breeding |
| Live/fresh | Moina, tubifex, adult Artemia, bloodworms | Condition, colour boost, breeding boost, higher sale value |

**Mechanics**

- **Inventory:** every food has limited stock; each unit has quality and (for live food) a **shelf life**. Running out stops growth and breeding; starvation causes health loss and eventual death.
- **Species diet:** each species has diet type (herbivore, omnivore, carnivore) and food preferences; wrong food gives reduced benefit (e.g., Otocinclus needs algae or veggie wafers; Plecos need wood and sinking food).
- **Feeding modes:** manual (precise portions, best results) or auto-feeder (an equipment purchase with portion settings and a fixed schedule; convenient but wastes food if misconfigured).
- **Overfeeding:** uneaten food becomes waste that raises ammonia and algae. The game shows leftover food on the substrate so the cause is visible.
- **Fry feeding:** needs correct particle size and frequency; neglected fry stunt (a permanent size penalty) rather than simply vanishing.

### 6.7 Tank and Environment

**Tank tiers**

| Tier | Name | Role |
| --- | --- | --- |
| 1 | Mini tank | Starter, \~20 L, a handful of small fish |
| 2 | Standard tank | \~60 L, first breeding setups |
| 3 | Large tank | \~150 L, community and large species |
| 4 | Professional tank | \~300 L+, premium species, advanced equipment |
| 5 | Multi-tank farm | Rack/room system with several tanks, shared logistics |

**Parameters:** water volume, capacity (bioload), temperature, cleanliness, oxygen, pH, hardness (optional later), filtration, light.

**Water quality model (simplified nitrogen cycle):**

- **Bioload** = sum of fish mass × feeding activity. **Waste** accumulates from bioload and uneaten food.
- **Filter** converts waste at a rate = filter capacity × **biofilter maturity** (a new filter starts at 0 and "cycles" over \~10 game days; a Quick-start additive can shorten this). This teaches the real cycle.
- **Water changes** reduce waste and nitrate but risk temperature or pH shock if the new water differs (needs conditioner, an item).
- **Overcrowding:** if bioload > capacity, waste grows faster than filtration can clean; tanks "crash" with visible warnings first.
- **Plants** absorb waste and add oxygen; **algae** grows with light and waste.

**Equipment**

- Filters: Basic → Hang-on-back → Canister → Overflow/Sump → Professional (capacity and maturity speed scale).
- Lighting: Basic LED → Aquatic LED (plant growth, colour bonus) → RGB decorative (aesthetic, small colour effect).
- Heater, air pump and thermometer as optional upgrades (heater is needed for tropical species).
- Equipment wears out: filter media and bulbs need replacement (a small, steady money sink).

**Effects on fish:** environment shifts health, growth, colour intensity and breeding chance through the formulas above; each effect is shown in the tank panel with green/yellow/red indicators.

### 6.8 Aquascaping and Decoration

- **Categories:** foreground, midground and background plants; moss; driftwood; rocks; sand and gravel substrate; caves and shelters; ornaments.
- **Placement:** free drag-and-drop in a tank grid with depth layers (foreground/mid/back); reposition or remove at any time.
- **Functional effects (not just cosmetic):**
  - Plants and moss: shelter for fry, spawning sites, waste absorption, stress reduction for shy species.
  - Caves and wood: territory and nests for cichlids and plecos; tannin effect lowers pH slightly.
  - Substrate: sand favours corydoras and loaches (barbel health); gravel suits plants.
  - Aesthetic score: a tank "beauty rating" gives small bonuses to **customer visits** and **sale price** in later stages (shop display).

### 6.9 Economy and Market

**Money sources:** open-market sales, customer orders, breeding pairs, show-quality or rare-mutation fish, bloodline premiums.

**Money sinks:** juveniles, food, plants/decor, equipment, upgrades, consumables (medicine, conditioner, filter media), daily operating costs (electricity per tank, later rent and staff).

**Sale price formula:** `Price = BasePrice × Size × Age × Colour × Rarity × Health × Genetics × Market`

- Size and age factors peak at the species "market size"; seniors depreciate.
- Colour factor rewards bright, saturated phenotypes; Rarity applies to mutations and bloodlines.
- Health below 70 percent reduces price; sick fish cannot be sold at all.
- **Market factor (0.4 to 1.5):** see below.

**Anti-exploit design (economic balancing)**

1. **Per-species demand saturation:** every sale lowers that species' demand by a percentage; demand recovers slowly over game days. Selling 50 Guppies in a day sharply cuts the price of the 51st.
2. **Market drift and trends:** each species has a volatile demand curve; random events ("Neon Tetra craze", "Discus show weekend") create opportunities.
3. **Capacity constraint:** space and bioload cap production regardless of money.
4. **Fry survival and attention cost:** large clutches need feeding, culling and grading time.
5. **Fixed costs scale with growth:** operating costs rise with tank tier, so size alone does not guarantee profit.
6. **Tier-based margins:** T1 fish are fast but saturate; T3/T4 fish pay more per fish but need rarer conditions.
7. **Diversity bonus:** orders and shop reputation reward a varied, healthy portfolio.

**Pacing targets (to be validated in playtests):**

| Milestone | Target time |
| --- | --- |
| First fish bought and fed | ≤ 2 min |
| First fry born | ≤ 15 min |
| First sale | ≤ 20 min |
| First tank upgrade | ≤ 45 min |
| Level 3 (breeder) | \~2 h |
| Level 6 (empire) | 20 to 30 h |

### 6.10 Customers and Orders

- **Customer archetypes:** hobbyist (small, flexible orders), pet shop (bulk, low price), collector (rare/colour, high price), aquarium or exhibition (premium, strict quality), exporter (very large volumes).
- **Order types:** quantity of a species and minimum size/quality; breeding pairs; colour or pattern request; "rare group" fish; bundles.
- **Rules:** each order has a deadline, a minimum health and quality, and a reward multiplier above market (to make orders the best-margin channel). Unfulfilled orders expire with a small reputation cost; completion raises reputation.
- **Board:** 3 to 6 active orders, refreshed on a schedule; higher levels unlock larger, more demanding customers.
- **Reputation:** drives order quality and the unlock of premium customers.

### 6.11 Progression

**XP sources:** sales value, successful breeding events, orders completed, mutations discovered, bloodlines established.

| Level | Title | Key unlocks |
| --- | --- | --- |
| 1 | Beginner fish keeper | Mini tank, basic filter, T1 livebearers and hardy fish |
| 2 | Hobbyist fish keeper | Standard tank, heater, more food types, T1 egg-layers |
| 3 | Ornamental fish breeder | Spawning gear, colour feeds, hobbyist customers, T2 species |
| 4 | Ornamental fish shop owner | Large tank, HOB/canister filters, pet shop customers, display tanks |
| 5 | Professional ornamental fish farm | Professional tank, sump, T3 species, collector orders, staff-lite automation |
| 6 | Ornamental fish empire | Multi-tank farm, T4 species, exporters, bloodline registry |

Each level also opens new decorations, equipment and higher-value orders. Unlocks are shown as a clear "next goals" panel so progress is always visible.

## 7. Interface and UX

**Main screen:** large central tank, fish swimming continuously, bubbles, light shafts, plant sway, day/night lighting. **Zoom and pan** (mouse wheel, pinch); tapping a fish focuses and follows it.

**Toolbar (8 tabs):** Tank · Fish Store · Food · Decorations · Upgrades · Fish Management · Statistics · Customers. Desktop: left or bottom dock; mobile: bottom bar with slide-up sheets.

**Fish info panel:** species (VN/EN), sex, age/stage, size, health, satiety, colour, breeding readiness, genetic stars, current value, lineage link, plus **Sell / Move / Rename / Cull** actions.

**Fish Management:** sortable, filterable roster (species, sex, health, value, readiness), bulk select and bulk sell, and a lineage viewer.

**HUD:** money, day/time, speed controls (pause, x1, x2, x4), tank water summary, alert bell.

**Notifications:** prioritized queue (critical, warning, info) for hunger, illness, breeding, hatching, maturity, order deadlines; click jumps to the relevant fish or tank; optional auto-pause on critical events.

**Onboarding:** a gentle first-hour tutorial (buy guppy pair → feed → water check → first fry → first sale), with systems introduced one at a time.

**Accessibility:** colour-blind-safe indicators (icon plus colour), scalable UI, reduced-motion option, keyboard and touch parity, bilingual Vietnamese/English with a string table.

## 8. Art and Audio Direction

- **Style:** vivid, deep 2D with layered parallax (background, midground, fish layer, foreground plants), soft gradients, caustic light overlays and subtle particle effects.
- **Fish rendering:** **procedural, parameterised sprites** (body-shape archetypes × palette × pattern × fin form), pre-rendered to texture atlases. This gives 30 distinct species plus genetic variation without hand-drawing every combination.
- **Animation:** swim cycle via body wave and fin flutter; state-based expressions (hunger, stress, display, spawning).
- **Audio:** ambient water, soft bubbles, calm music that shifts with day/night, clear UI feedback sounds (kept optional).

## 9. Technical Design

- **Stack:** HTML5 Canvas 2D (or PixiJS/WebGL for batching), vanilla TypeScript or a light framework for UI; no server dependency.
- **Architecture:** data-driven and modular: `data/` (species, items, orders as JSON), `core/` (simulation, no rendering), `render/`, `ui/`, `save/`. The simulation is deterministic and testable without a browser.
- **Single source of truth:** one game-state store (fish, cohorts, tanks, inventory, money, market, progression); UI and renderer read state, only systems write it.
- **Simulation vs render:** fixed-step life tick (hour) for biology and economy; per-frame steering for visuals only, with a spatial hash for neighbour queries.
- **Performance:** render only the focused tank at full fidelity; level-of-detail for distant fish; cap visible fry sprites (show representative cohort sprites); object pooling for bubbles and particles; staggered updates for large populations; target 60 fps on mid-range phones with \~150 visible fish.
- **Save/load:** versioned schema with migrations; IndexedDB (fallback localStorage); **autosave** every \~30 s and on key events; manual slots; export/import as JSON for backup.
- **Extensibility:** adding a species or item = adding a data entry (and optional palette/pattern); archetype behaviour is plug-in modules.
- **Responsive:** fluid layout, touch-first controls, safe-area support, lazy-loaded assets.
- **Testing:** headless simulation tests for economy and breeding invariants; automated "bot player" runs to detect dominant strategies and soft-locks.

## 10. Scope and Roadmap

### MVP (playable, stable)

In scope:

1. One tank with day/night, bubbles, plant sway and swimming fish.
2. Store with all 30 species (data-complete; procedural art), random-sex purchase.
3. Feeding, growth, satiety, health, starvation and unsuitable-environment death.
4. Breeding for the three core archetypes first: **LB, SC, PL** (the rest are data-flagged and added next).
5. Eggs, hatching, fry cohorts with first foods.
6. Selling (single and bulk) with the price formula and **market saturation**.
7. Food purchasing with limited stock; tank and filter upgrades.
8. Basic orders (3 to 6 simple orders), level 1 to 3 progression.
9. Autosave and manual save/load; pause and x1/x2/x4; notifications.

**Exit criteria:** a new player can reach Level 3 in \~2 hours with no crashes; no single-species strategy beats a mixed one by more than \~25 percent in bot runs; a 100-fish save runs at ≥ 50 fps on a mid-range phone.

### Post-MVP

- **Milestone 2:** CV, BN, AN, HB archetypes; disease and medicine; compatibility and aggression; full decoration and aquascaping effects.
- **Milestone 3:** full genetics (alleles, mutation log, inbreeding), grading UI, bloodlines.
- **Milestone 4:** multi-tank farm, staff/automation, customers tiers 4 to 5, exporters, events and market trends.
- **Milestone 5:** cross-species hybrids, achievements, endgame "empire" goals, content packs.

## 11. Balancing and Metrics

**Telemetry (local, anonymous, optional):** time to each milestone, money per game-day by tank tier, species mix at sale, fry survival rate, causes of death, notification response time.

**Balance levers (all in data files):** base prices, demand recovery rate, saturation per sale, clutch ranges, breeding base rates, mutation rate, operating costs, upgrade costs.

**Guardrails:**

- Income per tank-day must grow roughly linearly with tank tier, not exponentially.
- Top-3 species by revenue should differ across runs (diversity check).
- Death causes should be dominated by understandable factors (starvation, water) and rarely by randomness.

## 12. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Scope explosion (30 species × systems) | Archetype system; data-driven content; strict MVP cut |
| Too complex for newcomers | Staged unlocks, "why" tooltips, forgiving first tank |
| Idle/auto-income exploit | Saturation, capacity limits, no passive income |
| Genetics unreadable | Star rating, clear carrier hints, lineage viewer |
| Performance with many fish | Cohorts, LOD, spatial hash, capped visible sprites |
| Save corruption | Versioned schema, autosave slots, export backup |
| Frustration from deaths | Early warnings, readable causes, protected offline state |

## 13. Open Decisions for the Team

1. **Tone:** cozy and forgiving, or hardcore simulation? (This GDD assumes cozy-leaning with real depth.) => Cozy
2. **Real-time offline progress:** keep the protected 8-day cap, or fully pause when closed? => 8-day cap
3. **Disease depth in MVP:** include a minimal version (one common disease) or defer to Milestone 2? => included in MVP
4. **Currency and localisation:** VND or an abstract currency? Vietnamese and English at launch? => call it $FISH
5. **Hybrids and "fancy" varieties** (e.g., Goldfish types): MVP or later? in MVP
6. **Rendering tech:** pure Canvas 2D or PixiJS/WebGL? => decided later in architecture design

## Appendix A: Example Species Record

```json
{
  "id": "guppy",
  "name": { "en": "Guppy", "vi": "Cá bảy màu" },
  "archetype": "LB",
  "tier": 1,
  "buyPrice": 12, "sellBase": 18,
  "adultSizeCm": 4, "lifespanDays": 90, "maturityDays": 12,
  "diet": { "type": "omnivore", "prefers": ["flake", "microworm", "moina"] },
  "breeding": { "gestationDays": 5, "clutch": [8, 30], "cycleDays": 8, "needs": { "tempC": [24, 28], "ph": [6.8, 7.8], "cover": "plants" } },
  "temperament": { "aggression": 0.1, "school": 0, "layer": "mid" },
  "care": 1,
  "genes": ["hue", "pattern", "tail", "size", "vigor"]
}
```

## Appendix B: Core Formulas (starting values, to be tuned)

- **Growth/tick:** `Δsize = species.growth × (1 − size/adult) × foodQ × waterQ × tempFit × (1 − crowdPenalty)`
- **Health/tick:** `ΔH = regen(if fed & clean) − Σ stressors`; death at H ≤ 0
- **Breeding condition:** `0.30·nutrition + 0.25·water + 0.15·tempFit + 0.10·shelter + 0.10·liveFood + 0.10·(1 − stress)`
- **Demand after a sale:** `demand ← demand × (1 − 0.03)`; **recovery/day:** `demand += (1 − demand) × 0.08`
- **Genetic quality:** weighted sum of favourable alleles minus an inbreeding penalty, normalised to 0 to 100
