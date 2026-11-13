# Aquarium Tycoon — Technical Architecture Design

**Version:** 1.0 · **Date:** 2026-11-14 · **Status:** Proposed (pre-production)
**Companion doc:** GDD v0.1 — this document translates GDD §6–§9 into buildable modules, interfaces, and decisions.

---

## 0. Executive Summary of Decisions

| # | Decision | Choice | Rationale (short) |
|---|----------|--------|-------------------|
| D1 | Rendering tech (GDD open #6) | **PixiJS v8 (WebGL2, WebGL fallback)** behind a `TankRenderer` interface | 150 animated fish + particles + parallax + caustics at 60 fps on mid-range mobile needs GPU batching; Canvas 2D cannot hold that draw budget. Sim stays 100% renderer-agnostic, so swap cost is bounded. |
| D2 | UI framework | **Svelte 5** (runes); fallback Preact + signals if team prefers React | Compiles away → tiny bundle; fine-grained reactivity is a perfect fit for dozens of live-updating stat panels; no VDOM diff of a 500-fish roster. |
| D3 | Language/build | **TypeScript (strict) + Vite**, Vitest for tests | Headless sim tests must run in Node, so the sim core must be DOM-free TS. |
| D4 | State model | **Single mutable store + Command pattern + typed event bus** (not Redux/immutable) | Immutable updates of a 5,000-fish state every game-hour tick is pure waste; mutation + version counters + selectors is faster and simpler. Commands give us logging, replay, save diffing, and testability for free. |
| D5 | Simulation step | **Fixed 1 game-hour tick**, deterministic, single seeded RNG (`mulberry32`) | Required for offline catch-up, bot-player balance tests, and bug repro from a save. |
| D6 | Persistence | **IndexedDB** (tiny custom wrapper, ~100 LoC) with `localStorage` fallback + JSON export/import; versioned schema + migration functions | GDD §9 requirement. idb-keyval is acceptable but a 100-LoC wrapper avoids a dep. |
| D7 | Concurrency | Sim on main thread for MVP; **clean `SimWorker` boundary** reserved | 150 fish × hourly tick is trivial; offline catch-up (≤8 days) is ~192 ticks, still sub-50 ms. Move to Worker only if profiling shows jank. |
| D8 | Fish storage | **AoS plain objects** (not SoA typed arrays) for MVP; fry as **cohorts** | Readability wins until population > ~3,000 adults; cohorts already bound the hot count. SoA is a documented migration path. |
| D9 | Networking | **None.** Offline-first PWA (service worker + manifest). | GDD: no backend, offline-capable. |

---

## 1. Architectural Goals & Non-Goals

**Goals (driven by GDD pillars):**
1. **Deterministic, headless-testable simulation** — the economy, breeding, and genetics must be provable without a browser (GDD §9, §11 guardrails).
2. **Renderer swappable** — the "tank worth watching" pillar may demand a tech change; the cost of changing renderer must be one module.
3. **Content is data** — adding a species = one JSON file + optional palette entry (GDD §9 extensibility).
4. **Survive a 5,000-fish, 20-tank late game at 60 fps** on mid-range mobile.
5. **No save corruption** — versioned, migrated, autosaved, exportable.

**Non-goals (explicitly out):**
- Multiplayer / server authority.
- Real-time per-frame physics for fish (visual steering is render-only, never affects sim).
- Full ECS (we use "ECS-lite": plain data records + stateless system functions).

---

## 2. Layered Architecture & Dependency Rule

```
┌─────────────────────────────────────────────────────────────┐
│  ui/          Svelte panels, HUD, toolbar, dialogs          │  reads store, emits Commands
├─────────────────────────────────────────────────────────────┤
│  render/      PixiJS tank renderer, procedural sprites      │  reads store (read-only) + render events
├─────────────────────────────────────────────────────────────┤
│  audio/       Web Audio ambient mixer + SFX                 │  subscribes to events
├─────────────────────────────────────────────────────────────┤
│  core/        Simulation: store, systems, commands, events  │  ◄── single writer of state
├─────────────────────────────────────────────────────────────┤
│  data/        JSON content + schema validators              │  imported by core (and render for palettes)
├─────────────────────────────────────────────────────────────┤
│  platform/    save/, i18n/, input/, clock/, pwa/            │  wrap browser APIs
└─────────────────────────────────────────────────────────────┘
```

**Hard dependency rule (enforced by `eslint-plugin-boundaries`):**
- `core` imports **only** `data` and `platform/clock` (and `util`). Never `render`, `ui`, `audio`, or DOM.
- `render` and `ui` import `core` **read-only** (types + selectors + `commandBus`). They never mutate state.
- `data` imports nothing from the app.
- Circles are build errors.

This rule is what makes D1 (renderer swap) and D7 (Worker move) cheap.

---

## 3. Directory Structure

```
src/
├── main.ts                  # bootstrap: load save → create store → mount UI + renderer
├── config.ts                # tunable constants (tick durations, autosave interval, caps)
├── core/
│   ├── store.ts             # GameState + root store object + version counter
│   ├── types.ts             # all domain types (Fish, Tank, Cohort, Order, ...)
│   ├── rng.ts               # seeded mulberry32, serializable state
│   ├── clock.ts             # GameClock: real-time → tick scheduling, speed control
│   ├── commands/            # one file per command: buyFish, feed, sell, setHeater, ...
│   │   ├── index.ts         # CommandBus + execute() + validation + event emission
│   │   └── *.ts
│   ├── events.ts            # typed event union + EventBus (tiny pub/sub)
│   ├── systems/             # one file per sim system (§5.2), each: fn(state, ctx) → events
│   │   ├── waterSystem.ts
│   │   ├── feedingSystem.ts
│   │   ├── healthSystem.ts
│   │   ├── growthSystem.ts
│   │   ├── breedingSystem.ts
│   │   ├── genetics.ts      # pure functions: crossover, mutation, quality, inbreeding
│   │   ├── diseaseSystem.ts
│   │   ├── aggressionSystem.ts
│   │   ├── cohortSystem.ts  # fry cohort aging, survival, grading trigger
│   │   ├── deathSystem.ts
│   │   ├── marketSystem.ts  # demand saturation, drift, trends
│   │   ├── orderSystem.ts   # order board refresh, expiry, reputation
│   │   ├── progressionSystem.ts # XP, level-ups, unlocks
│   │   └── economySystem.ts # daily operating costs
│   ├── engine.ts            # SimulationEngine: ordered tick pipeline + offline coarse mode
│   ├── selectors.ts         # pure read functions: fishValue(tank, fish), tankWaterSummary...
│   └── formulas.ts          # GDD Appendix B formulas, pure, unit-tested
├── data/
│   ├── species/*.json       # one file per species (Appendix A shape)
│   ├── items.json           # food, medicine, consumables
│   ├── equipment.json       # filters, heaters, lights, tanks
│   ├── decorations.json
│   ├── orders.json          # customer archetype definitions + order templates
│   ├── genetics.json        # loci, alleles, dominance, mutation table
│   ├── strings.en.json / strings.vi.json
│   └── validate.ts          # JSON-schema (or zod) validation at build + boot
├── render/
│   ├── TankRenderer.ts      # interface + PixiJS impl
│   ├── camera.ts            # pan/zoom, pointer mapping, safe-area
│   ├── sprites/
│   │   ├── FishSpriteFactory.ts   # procedural fish → pre-rendered atlas frames
│   │   ├── palette.ts             # phenotype → palette resolution, quantization
│   │   ├── PlantSprite.ts
│   │   └── atlas.ts               # texture atlas packing, cache keyed by phenotype hash
│   ├── layers/              # background, midground, fish, foreground plants, particles, caustics, light
│   ├── steering.ts          # render-only boids; spatial hash for neighbour queries
│   ├── particles.ts         # object-pooled bubbles/food/particles, capped counts
│   └── RenderEvents.ts      # one-shot visual triggers (spawn burst, death, hatch flash)
├── ui/
│   ├── App.svelte
│   ├── hud/                 # money, clock, speed, alert bell
│   ├── panels/              # fish info, roster/management, store, food, decor, upgrades, stats, customers
│   ├── notifications/       # prioritized queue, click-to-jump, auto-pause hook
│   ├── onboarding/          # tutorial state machine
│   ├── widgets/             # sliders, gauges, star ratings, colour-blind-safe indicators
│   └── store-bindings.ts    # Svelte runes wired to core store version + selectors
├── save/
│   ├── schema.ts            # current SaveSchema version
│   ├── migrations/          # vN→vN+1 pure functions, chained on load
│   ├── serializer.ts        # state ↔ save JSON (strips transient render state)
│   ├── storage.ts           # IndexedDB wrapper + localStorage fallback
│   ├── autosave.ts          # debounced 30 s + on visibilitychange/beforeunload
│   └── offlineCatchup.ts    # coarse-resolution replay, 8-day cap, protected-state clamp
├── audio/
│   ├── mixer.ts             # ambient bed + SFX bus, mute/persist volume
│   └── sfxMap.ts            # event → sound
├── input/
│   ├── pointer.ts           # unified mouse/touch/pen, tap vs drag detection, pinch
│   └── keyboard.ts          # hotkeys, pause, speed
├── platform/
│   ├── i18n.ts              # string table, VN/EN switch, persisted
│   ├── visibility.ts        # tab hidden/shown → pause + autosave + offline catchup trigger
│   └── pwa/                 # service worker registration, manifest, update prompt
└── tests/
    ├── unit/                # Vitest: formulas, genetics, systems, commands, save roundtrip
    ├── bot/                 # headless bot-player harness + strategies + balance assertions
    └── perf/                # benchmark scene: 150 fish fps, 5000-fish tick time
```

---

## 4. State Model, Commands, and Events

### 4.1 GameState shape (single source of truth)

```ts
interface GameState {
  schemaVersion: number;
  seed: number;                 // RNG seed; rngState serialized alongside
  clock: { gameDay: number; gameHour: number; speed: 0|1|2|4; paused: boolean };
  money: number;                // $FISH
  reputation: number;
  xp: number; level: number;
  tanks: Record<TankId, Tank>;
  fish: Record<FishId, Fish>;           // adults + juveniles (post-grading)
  cohorts: Record<CohortId, FryCohort>; // fry, pre-grading
  inventory: Record<ItemId, { qty: number; quality?: number; expiresAtDay?: number }>;
  market: { demand: Record<SpeciesId, number>; trend: Record<SpeciesId, number>; activeEvent?: MarketEvent };
  orders: Order[];
  notifications: Notification[];
  stats: Stats;                 // cumulative: sales, fry, deaths by cause, mutations log, bloodlines
  settings: { locale: 'en'|'vi'; reducedMotion: boolean; autoPauseCritical: boolean; volume: {...} };
}
```

Transient render state (fish pixel positions, steering velocities, particle pools) lives **only** in `render/` and is never serialized. This keeps saves small and deterministic.

### 4.2 Command pattern (every mutation is a Command)

```ts
interface Command<T = unknown> {
  type: string;
  validate(state: GameState): string | null;   // null = ok, else error key
  execute(state: GameState, ctx: Ctx): { result: T; events: SimEvent[] };
}
```

- UI never touches `state` directly. UI → `commandBus.execute(new BuyFishCommand(...))`.
- `CommandBus` runs validate → execute → appends events → bumps `store.version` → marks dirty for autosave.
- Commands are serializable (JSON) → we can record a command log per session for bug repro; replay is a first-class debug tool.
- **Money guard:** any command that spends money validates `state.money >= cost`; negative money is impossible by construction (tested invariant).

### 4.3 Typed event bus

```ts
type SimEvent =
  | { kind: 'fishSpawned'; fishId: FishId; speciesId: SpeciesId; tankId: TankId }
  | { kind: 'fryHatched'; cohortId: CohortId; count: number }
  | { kind: 'fishDied'; fishId: FishId; cause: DeathCause }
  | { kind: 'mutation'; fishId: FishId; locus: string; allele: string }
  | { kind: 'diseaseOutbreak'; tankId: TankId; disease: DiseaseId }
  | { kind: 'orderExpired'; orderId: OrderId }
  | { kind: 'levelUp'; level: number }
  | /* ... ~30 kinds, exhaustive union */ ;
```

Subscribers: notification queue, audio SFX, render one-shot effects, stats, achievements (later), autosave. The event log (last N) is shown in the statistics panel.

---

## 5. Simulation Core

### 5.1 Clock & tick model

- **1 tick = 1 game hour.** `GameClock` accumulates real ms; at x1, 10 real s → 1 tick. x2 = 5 s, x4 = 2.5 s. Pause = 0.
- Ticks are **discrete and queued**: if a frame is slow, we run up to N catch-up ticks (max 4 per frame) and drop the rest with a "slow device" notice — never partial ticks, preserving determinism.
- **Daily systems** (market drift, order refresh, operating costs, order expiry) run on the hour-0 tick of each game day, not every hour.
- **RNG:** one `mulberry32` instance, state `{ seed, a }` serialized in save. Every random draw routes through `ctx.rng`. No `Math.random` anywhere in `core/` (lint rule).

### 5.2 Tick pipeline (fixed order, each system = pure-ish fn)

```
for each tick:
  1. clockSystem        — advance hour/day, fire day-rollup flag
  2. equipmentSystem    — heater → temp target; filter → biofilterMaturity; wear/consumables
  3. waterSystem        — waste += bioload + uneatenFood; filter converts waste→ammonia→nitrite→nitrate; O2; pH drift; plants absorb; water-change residual
  4. feedingSystem      — satiety decay; auto-feeder schedule; food consumption; uneaten→waste; live-food shelf-life expiry
  5. aggressionSystem   — sampled pair checks (bullying, fin-nipping, territory); updates per-fish stress deltas
  6. diseaseSystem      — transmission rolls, progression, recovery with medicine
  7. healthSystem       — ΔH = regen − Σ stressors (hunger, ammonia, nitrite, O2, temp/pH fit, crowding, stress, disease); clamp; death flag
  8. growthSystem       — Δsize formula (GDD App B); fry stunting check; stage transitions (fry→juvenile = cohort grading event; juvenile→adult)
  9. breedingSystem     — per mature pair: condition score → spawn roll; archetype handler (LB/SC/PL in MVP) → eggs or gestation → cohort creation
 10. cohortSystem       — cohort age, survival (first-food check), grading when age ≥ juvenileThreshold → emit `cohortReadyToGrade` (pauses? no — creates individual fish, opens grading UI via event)
 11. deathSystem        — process death flags: remove fish, emit `fishDied` with cause, update stats, memorial note for seniors
 12. economySystem      — (daily) operating costs; (on sale events) revenue
 13. marketSystem       — (daily) demand recovery, drift, trend events; (on sale) saturation ×0.97
 14. orderSystem        — (daily) refresh board, expire old, reputation deltas
 15. progressionSystem  — XP from events this tick; level-up → unlocks
 16. notificationSystem — convert events into prioritized notifications; auto-pause if critical & enabled
```

Each system receives `(state, ctx)` where `ctx = { rng, data, now: {day,hour}, events: SimEvent[] }`. Systems push events into `ctx.events`; they do not call subscribers directly.

### 5.3 Offline / background catch-up (`save/offlineCatchup.ts`)

On tab visible / app reopen:
1. Compute `elapsedGameHours = min(8 days × 24, realElapsed × x1-equivalent)`.
2. Run the tick pipeline in **coarse mode**: aggregate every 24 ticks into one "day step" using averaged water parameters (no per-hour oscillation). Same RNG sequence continuity.
3. **Protected-state clamp:** during offline replay, health is floored at 10 (cannot die from neglect); starvation stops at satiety 0 but health loss is capped. On return, fish are in "critical" state with a clear notification.
4. Emit a `whileYouWereAway` summary: fry hatched, fish matured, sales? (no sales while away — market is player-driven), deaths (only old-age, which is allowed), orders expired.
5. Cap: beyond 8 days, time stops (no infinite idle income — anti-goal).

### 5.4 Determinism invariants (tested)
- Same seed + same command sequence → identical state after N ticks.
- Save → load → 1 tick → state equals no-reload path.
- Every `Math.random`/`Date.now` in `core/` is a lint failure.

---

## 6. Entity & Data Model (key contracts)

### 6.1 Fish (post-grading individual)

```ts
interface Fish {
  id: FishId;
  speciesId: SpeciesId;
  name?: string;
  sex: 'M' | 'F' | 'H';          // H = hermaphrodite (none in MVP)
  birthDay: number;
  parentIds: [FishId?, FishId?];  // lineage; undefined for store-bought
  genome: Genome;                 // see 6.3
  stage: 'juvenile' | 'adult' | 'senior';
  ageDays: number;
  sizeCm: number;
  health: number;                 // 0..100
  satiety: number;                // 0..100
  stress: number;                 // 0..100, derived each tick, stored for UI
  diseases: DiseaseId[];
  mature: boolean;
  lastSpawnDay?: number;
  gestationDaysLeft?: number;     // LB archetype
  gravid: boolean;
  // derived (cached, recomputed on change): phenotypeHash, geneticQuality, value
  phenotypeHash: string;          // → render texture lookup
  geneticQuality: number;         // 0..100 → stars
  value: number;                  // cached sale price at current market; recomputed on market tick
  inbreedingCoeff: number;        // computed at birth from lineage depth-limited pedigree
}
```

### 6.2 FryCohort (performance + UX design, GDD §6.5)

```ts
interface FryCohort {
  id: CohortId;
  speciesId: SpeciesId;
  tankId: TankId;
  bornDay: number;
  count: number;
  genomePool: Genome[];           // 8–16 sampled genomes representing the distribution
  avgHealth: number; avgSatiety: number;
  survivalFactor: number;         // cumulative first-food/water penalty
  motherId?: FishId; fatherId?: FishId;
  archetypeState: unknown;        // e.g., AN dormancy timer, BN nest owner
}
```

At grading (age ≥ species.juvenileDays): for each of `count` fry, sample a genome from `genomePool` (with mutation roll per locus), roll sex, create individual Fish, then open the grading UI (bulk keep/sell/cull). Unsold juveniles can be held. Cohort genome pool is sampled at hatch from parents via `genetics.ts`; this preserves Mendelian distribution without storing hundreds of full genomes.

### 6.3 Genome & genetics (`core/systems/genetics.ts`, pure)

```ts
type Allele = string;                       // e.g. "H_wild", "H_albino"
type Genome = Record<LocusId, [Allele, Allele]>;

function crossover(m: Genome, f: Genome, rng): Genome   // one random allele per locus from each parent
function mutate(g: Genome, rate: number, rng): { g: Genome; mutations: MutationEvent[] }
function phenotype(g: Genome, speciesId): Phenotype     // dominance resolution → colour/pattern/fin/size
function geneticQuality(g: Genome, inbreedingCoeff): number  // 0..100
function inbreedingCoeff(pedigree): number              // depth-limited (≤6 gen) Wright's F approximation
```

- Mutation rate 1–2%/locus (GDD §6.4), data-driven per locus.
- Phenotype is **quantized** for rendering: hue → 12 buckets, pattern → defined set, fin → defined set. `phenotypeHash` = `species|hueBucket|pattern|fin|sizeBucket`. This bounds the number of procedural textures (see §7.2).

### 6.4 Tank

```ts
interface Tank {
  id: TankId; tier: 1|2|3|4|5; volumeL: number;
  water: { tempC: number; ph: number; hardness: number; o2: number;
           ammonia: number; nitrite: number; nitrate: number; waste: number;
           biofilterMaturity: number; lightLevel: number; algae: number };
  equipment: { filterId?: ItemId; heaterId?: ItemId; lightId?: ItemId; airPump?: boolean; autoFeeder?: AutoFeederConfig };
  decor: DecorItem[];             // placed, with grid position + layer
  plants: PlantInstance[];        // growth state, waste absorption rate
  fishIds: FishId[]; cohortIds: CohortId[];
  bioload: number;                // cached: Σ fish mass × feeding
  beautyRating: number;           // cached, drives shop-display bonus
}
```

---

## 7. Rendering Architecture (the "tank worth watching" layer)

### 7.1 `TankRenderer` interface (swap boundary)

```ts
interface TankRenderer {
  init(canvas: HTMLCanvasElement): void;
  setTank(tankId: TankId): void;          // focused tank; others render as thumbnails (1 Hz)
  onStateChange(state: GameState): void;  // cheap: syncs entity list, phenotype→texture binding
  frame(interpAlpha: number): void;       // per-frame: steering + draw
  pick(x, y): FishId | null;              // tap a fish
  camera: CameraController;               // pan/zoom
  destroy(): void;
}
```

Only this interface is known to `main.ts` and `ui/`. The PixiJS implementation lives behind it.

### 7.2 Procedural fish sprites (GDD §8)

- **Generation:** at boot (or lazily on first encounter), for each `phenotypeHash` in use, render N swim frames (default 6) to an offscreen canvas: body-shape archetype (ellipse/elongated/compressed) × palette × pattern mask × fin form. Pack frames into a Pixi `Texture` atlas. Cache by hash; cap total textures (LRU, e.g., 256 phenotypes × 6 frames).
- **Animation:** `AnimatedSprite` with frame swap; body wave achieved by frame differences (pre-baked) — no per-vertex deformation per fish. This is the single biggest perf win: 150 fish = 150 batched draw calls (Pixi batches same-texture sprites into one draw).
- **State cues:** hungry → tint slightly pale + surface-seeking steering; sick → slower frame rate + clamped-fin frame variant; breeding-display → brighter tint + courtship steering. All via texture/tint/steering, no per-fish logic in sim.
- **Plants:** pre-rendered sprites with a sway shader (one fullscreen-ish pass) or cheap rotation oscillation per plant group. Foreground plants in a separate layer above fish.
- **Caustics / light shafts / bubbles:** layered, capped particle counts, object-pooled. Reduced-motion setting disables caustics and halves particles.

### 7.3 Steering (render-only)

- `SpatialHash` rebuilt each frame (or every 2 frames) for the focused tank.
- Per-species steering params (schooling weight, territorial radius, layer preference) from `data/species`.
- Fish positions are **render state**, not sim state. Sim only knows tank membership. This is deliberate: boids are cosmetic and must never affect breeding/health.
- **LOD:** focused tank → full steering + animation. Non-focused tanks (multi-tank view) → static thumbnail refreshed at 1 Hz with a count badge. Fry cohorts → max 20 representative sprites + "×N" label.

### 7.4 Performance budget (MVP exit criteria, GDD §10)

| Metric | Budget | How enforced |
|--------|--------|--------------|
| Sim tick (150 fish, 1 tank) | < 2 ms | automated perf test in CI |
| Sim tick (5,000 fish, 20 tanks) | < 20 ms | perf benchmark scene |
| Frame time, mid-range phone, 150 fish | ≤ 16 ms (60 fps) | Pixi batching + sprite-sheet animation |
| Save size, 5,000 fish | < 500 KB gzipped | cohorts + strip transient state |
| Texture memory | < 32 MB | phenotype quantization + LRU atlas cap |

---

## 8. UI Architecture

- **Svelte 5 runes** for reactivity. The core store exposes `store.version` (a monotonic counter bumped on every command/tick). UI components subscribe: `$effect(() => { store.version; const fish = selectors.fishById(state, id); ... })`. For heavy lists (roster with 500 fish), use a memoized sorted slice + virtualized list (windowing).
- **Panels** map 1:1 to the 8 GDD toolbar tabs. Each panel reads via selectors only; writes via commands.
- **Fish info panel** reads one fish + derived selectors (`fishValue`, `lineage`). Sell/Move/Rename/Cull are commands.
- **Notifications** are a prioritized queue fed by the event bus; click → `uiStore.focusFish(id)` / `focusTank(id)` → renderer camera animates to it. Auto-pause on critical events hooks `notificationSystem`.
- **Onboarding:** a small state machine (`onboarding/`) that listens to events and advances; highlights UI elements with a spotlight overlay. Never blocks sim.
- **i18n:** `platform/i18n.ts` reads `strings.{locale}.json`; all UI strings via `t('key')`. Species names come from species JSON `name.en/vi`.
- **Accessibility:** every status indicator = icon + text label (not colour alone); reduced-motion disables particle/caustics; scalable UI via rem base; touch targets ≥ 44 px.

---

## 9. Save / Load / Offline

- **`SaveSchema`** = `{ schemaVersion, savedAt, playtimeMs, state: GameState }`. Transient render state is stripped by `serializer.ts`.
- **Migrations:** `migrations/v1-to-v2.ts`, ..., chained in order on load. Each is a pure function `(raw) => raw`. Every schema bump requires a migration + a roundtrip test.
- **Storage:** IndexedDB object store with 3 autosave slots + N manual slots. Write flow: serialize → write to temp key → verify read-back → swap to active key (atomic-ish). `localStorage` fallback if IndexedDB unavailable.
- **Autosave:** debounced 30 s after last mutation; plus immediate on `visibilitychange` (hidden) and `beforeunload`. Export/import JSON with schema validation on import (corrupt import → error, never clobbers current save).
- **Offline catch-up:** see §5.3. The 8-day cap and protected-state clamp are constants in `config.ts`.

---

## 10. Content Pipeline (data-driven)

- All content as JSON under `src/data/`. **Zod schemas** (or JSON Schema + `ajv`) validate at build time (Vite plugin) and at boot (dev only, stripped in prod).
- Adding a species: drop `species/<id>.json` (Appendix A shape + genes list + palette/pattern refs) → appears in store, breeding, market, render (procedural). No code change.
- Adding an archetype (beyond the 7): one handler module in `core/systems/breeding/archetypes/` registered by code; species JSON references it by code.
- **Genetics content:** `genetics.json` defines loci, alleles, dominance, mutation table, and phenotype mapping. Phenotype→palette resolution in `render/sprites/palette.ts`.
- **Balance levers** (GDD §11) are all in data files; a `tests/bot/` run asserts the guardrails after any data change.

---

## 11. Audio, Input, Platform

- **Audio:** Web Audio API. One ambient loop (crossfades day/night), SFX bus mapped from events (`sfxMap.ts`). Volume persisted in `settings`. All audio lazy-loaded; muted until first user gesture (browser autoplay policy).
- **Input:** unified pointer (mouse/touch/pen) with tap-vs-drag threshold; pinch-to-zoom; wheel zoom. Keyboard: space=pause, 1/2/4=speed, F=feed. Camera clamps to tank bounds + safe-area insets.
- **PWA:** service worker (Vite `vite-plugin-pwa`) precaches app shell + content JSON; manifest; "update available" prompt. No background sync (offline progress is handled by catch-up on reopen, not by SW).

---

## 12. Testing & Balance Strategy

**Unit (Vitest, headless, no DOM):**
- `formulas.test.ts` — growth, health, breeding condition, price formula (GDD App B).
- `genetics.test.ts` — Mendelian ratios over 10k crosses; mutation rate within tolerance; inbreeding coeff known-pedigree check; quality bounds [0,100].
- `systems/*.test.ts` — each system with a hand-built minimal state; e.g., waterSystem: overfeeding → ammonia rises → filter matures → converts.
- `commands/*.test.ts` — validation rejects invalid (insufficient funds, full tank); execute produces expected events.
- `save/` — roundtrip equality; each migration forward-then-back? (forward only + golden-file fixtures per version).
- **Invariants suite:** money never negative; fish count consistent (tank.fishIds ⊆ state.fish); demand ∈ [0.4,1.5]; no two fish share an id.

**Bot player (`tests/bot/`):**
- Headless engine runner. Strategies: `GuppySpamBot`, `MixedCommunityBot`, `T3SpecialistBot`, `OrderFulfillerBot`.
- Run 4 simulated hours each (≈ 2400 ticks), assert:
  - No soft-lock (money never hits 0 with no sellable fish — detect & fail).
  - GuppySpam revenue ≤ 1.25 × Mixed (GDD §10 exit criterion).
  - Top-3 revenue species differ across bot runs (diversity check).
  - Milestone pacing: first fry ≤ 15 min-equivalent, Level 3 ≤ 2 h-equivalent.
- Runs in CI on every data change.

**Perf (`tests/perf/`):** benchmark scene with 150 fish (fps) and 5,000-fish tick time; thresholds gate releases.

---

## 13. Build & Tooling

- **Vite** + TypeScript strict + `tsconfig` path aliases (`@core`, `@data`, `@render`, `@ui`).
- **ESLint** + `eslint-plugin-boundaries` (dependency rule §2) + custom rule: no `Math.random`/`Date.now` in `core/`.
- **Prettier.** **Husky/lint-staged** optional.
- **Code splitting:** `core` + `data` in main chunk; `render` lazy-loaded after UI shell; content packs (post-MVP) lazy dynamic imports.
- **CI:** typecheck → lint → unit tests → bot runs → perf benchmarks → build.

---

## 14. ADR Log (Architecture Decision Records)

**ADR-001 — PixiJS over Canvas 2D.** (D1) WebGL batching required for 150 animated fish + particles at 60 fps on mid-range mobile. Mitigations: renderer behind `TankRenderer` interface; sim has zero render dependency; procedural sprites pre-baked to atlases so GPU load is texture-bound, not draw-call-bound.

**ADR-002 — Mutable store + Commands over Redux/immutable.** (D4) Hourly tick mutates thousands of fields; immutable copies would GC-thrash. Commands give us the audit/replay/testability benefits of immutable patterns without the cost. UI freshness via version counter + selectors.

**ADR-003 — Fry as cohorts, not individuals.** (GDD §6.5) Bound sim + render cost of hundreds of fry; genetics preserved via sampled genome pool; individuality restored at grading (the moment fish become sellable/breedable, which is exactly when "every fish matters" kicks in).

**ADR-004 — No backend, offline-first PWA.** (GDD) All state local; telemetry (GDD §11) is opt-in, local-only export, never required.

**ADR-005 — Svelte 5 for UI.** (D2) Fine-grained reactivity + tiny compiled output. Acceptance criterion: if no team member knows Svelte within one spike week, fall back to Preact + signals; the `ui/store-bindings.ts` boundary contains the swap.

**ADR-006 — Sim on main thread, Worker boundary reserved.** (D7) Tick cost is trivial; adding Worker serialization now is premature. The `core/` import boundary (no DOM) means moving `engine` into a Worker later is a one-day task with `postMessage` + `Transferable` snapshots.

---

## 15. Phased Build Roadmap (maps to GDD §10)

### Phase 0 — Skeleton (week 1)
Vite+TS+Svelte+Pixi boot; empty store; clock with pause/x1/x2/x4; one empty tank rendering; autosave stub; CI with typecheck+lint+empty test.

### Phase 1 — Core loop vertical slice (weeks 2–4)
- `core`: store, command bus, clock, waterSystem, feedingSystem, healthSystem, growthSystem, deathSystem.
- `data`: 5 species (guppy, neon tetra, corydoras, betta, bristlenose — cover LB, SC, PL, BN, CV archetypes early).
- `render`: fish sprites procedural (2 archetypes), swim, basic tank background, tap-to-select.
- `ui`: HUD (money, clock, speed), fish info panel, feed button, store (buy), sell (single).
- `save`: full autosave + load + offline catch-up (8-day cap, protected state).
- **Exit:** buy guppy → feed → watch grow → sell → money increases; reload preserves state.

### Phase 2 — Breeding + economy (weeks 5–8) — **MVP feature-complete**
- breedingSystem with LB, SC, PL archetypes; eggs, gestation, fry cohorts, first foods, grading UI.
- marketSystem (saturation + recovery + drift), orderSystem (3–6 simple orders), progressionSystem levels 1–3.
- Food inventory with stock + shelf life; tank + filter upgrades; biofilter cycle.
- Notifications, onboarding tutorial, i18n VN/EN.
- Bot player + balance pass to hit GDD §10 exit criteria.
- **Exit:** GDD §10 MVP exit criteria met (Level 3 in ~2 h, no dominant strategy >25%, 100-fish ≥50 fps mid-phone).

### Phase 3 — Polish + release candidate (weeks 9–10)
Accessibility pass, audio, PWA, performance profiling, save migration test, beta balancing.

### Post-MVP (GDD Milestones 2–5) — architecture already accommodates:
- Archetypes CV/BN/AN/HB → add handler modules (§10).
- Disease/aggression → systems already stubbed in pipeline order.
- Full genetics/bloodlines → `genetics.ts` extension + UI panel.
- Multi-tank farm → `state.tanks` is already a map; renderer thumbnail mode designed in.
- Hybrids → genetics crossover extension, no architecture change.

---

## 16. Risks Specific to Architecture (with mitigations)

| Risk | Mitigation |
|------|-----------|
| Procedural sprite explosion (too many phenotypes → VRAM) | Phenotype quantization (12 hue buckets) + LRU atlas cap (§7.2); monitor texture memory in perf test |
| Save bloat in late game | Cohorts for fry; strip transient render state; gzip; benchmark 5,000-fish save < 500 KB |
| Determinism drift from hidden `Math.random` | Lint rule + CI check; bot replay test (same seed → same state) |
| PixiJS context loss on mobile | `renderer.on('contextlost')` → restore textures from atlas cache; show brief "recovering" overlay |
| Svelte 5 team unfamiliarity | ADR-005 fallback to Preact+signals; one-week spike gate |
| Offline catch-up produces unfair results | Protected-state clamp + 8-day cap + full "while you were away" transparency; no sales while away |

---

## 17. Open Questions for the Team

1. **Svelte 5 vs Preact+signals** — confirm team familiarity (ADR-005 gate).
2. **Zod vs JSON Schema** for content validation — pick one; Zod gives TS types for free.
3. **Telemetry** (GDD §11): local-only export, or opt-in remote? (Affects whether we add any network code — currently none.)
4. **Mod support** post-launch? If yes, content JSON should be loadable from external sources now (small extra cost).
5. **Save cloud sync** (e.g., Google Drive import/export)? Export/import JSON already covers manual; automatic sync adds auth — out of scope unless requested.

---

*End of architecture design. Next step: Phase 0 skeleton + spike on procedural fish sprite generation (the highest-unknown rendering item).*
