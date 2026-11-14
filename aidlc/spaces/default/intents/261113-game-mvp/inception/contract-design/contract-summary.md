# Contract Summary

> Upstream: `unit-of-work.md`, `unit-of-work-dependency.md`, `components.md` (14 components, 10 owned entity types), `requirements.md` (FR1–FR12, NFR1–NFR5). Answers come from `contract-design-questions.md` (Q1–Q8).

## Scope and external surface

The game is an offline-first browser app. **There is no external API, no HTTP boundary, and no service to call.** Every boundary below is an in-process TypeScript interface between units in one deployed bundle, except the save file, which is the only artifact that leaves the app and comes back.

- The exported JSON save is a **supported external contract**: documented here, versioned, and importable by later versions of the game. A backup written by an earlier version must load in a later one.
- No unit exposes an API to anything outside the app.
- The integration mechanism is the one fixed in Units Generation Q5: a single shared store, a command pattern, and a typed event bus.

## Contracts

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| C1 | U1 — Simulation Foundation | U2–U6 (read and write through the store); U7 (read-only) | In-process shared state schema (`GameState`, entity types) plus read-only selectors | U1 |
| C2 | U1 — Simulation Foundation | U2–U6 (each implements and registers systems, handlers and the notification mapper); U7 (composition root calls `register`) | In-process registry: `Registry`, `System`, `Phase`, `TickContext` | U1 |
| C3 | U1 (bus envelope, outcome type, and the `settings.update` command); the unit that handles each command (U1, U2, U3, U4, U6) | U7 (dispatches); U1–U6 (handlers) | In-process command bus: typed `CommandMap`, `CommandHandler`, `CommandOutcome` | U1 owns the envelope and outcome; each handling unit owns its command payloads, result values and handlers |
| C4 | U2–U6 (emitters) | U6 (notification mapper), U7 (UI and audio), U1 (kernel, drain) | In-process typed event buffer, one drain per tick and one per command | U1 owns the buffer, the union derivation and the drain; each unit owns its event variants; U6 owns the notification mapper |
| C5 | U1 — Simulation Foundation | U2, U3, U5, U6, U7 | Versioned JSON data files plus schema validation | U1 |
| C6 | U1 — Simulation Foundation | U7 (save/load menu, FR9.1–FR9.3); external: the player's exported JSON backup and browser storage | In-process persistence API over a versioned JSON document with a SHA-256 digest and timestamp | U1 |

## C1 — Shared state and selectors

U1 defines every entity type and the shape of the single store. A unit owns the behaviour over its entity; it never redefines another unit's type.

**Write authority is exhaustive.** Exactly three things write `GameState`:

1. a command handler, between ticks;
2. a registered system, during its phase of a tick;
3. U1's kernel operations — clock advance, catch-up start, save, load, and import.

Nothing else writes. U7 reads.

```ts
// u1-sim-foundation — state shape
export interface GameState {
  seed: number
  rngState: { seed: number; a: number }
  clock: GameClock
  money: number                    // $FISH, always >= 0, integer
  reputation: number               // integer
  progression: PlayerProgression
  tank: Tank                       // one tank in the MVP
  fish: Record<FishId, Fish>
  cohorts: Record<CohortId, FryCohort>
  food: Record<FoodItemId, FoodItem>
  market: Record<SpeciesId, MarketState>
  orders: Order[]
  notifications: Notification[]
  settings: Settings
}

export interface GameClock {
  gameDay: number
  gameHour: number                 // 0..23
  speed: 0 | 1 | 2 | 4             // 0 = paused
  paused: boolean
}

export type GameTime = { day: number; hour: number }
```

There is no `schemaVersion` inside `GameState`. The save envelope owns the version (C6).

```yaml
shared-schema:
  name: GameState
  owner: u1-sim-foundation
  rules:
    - U1 defines every entity type; a unit never redefines another unit's type.
    - Only the three writers above write; U7 is read-only over the store.
    - version bumps once per completed tick and once per accepted command; a rejected command does not bump it.
    - Render state (positions, steering, particles) never enters GameState and is never serialized.
  store-surface:
    state: "GameState — readable by every unit; writable only by the three writers"
    version: "integer, monotonically increasing; subscribers re-read state when it changes"
    selectors: "pure functions of GameState exported by U1 or by the owning unit, e.g. money, level, fishById, fishInTank, sellableFish, tankWater, notificationQueue"
    selector-rule: a screen adds a selector when it needs one; that never changes the state schema
```

### Entity types that cross a unit boundary

U1 defines the type. The named unit owns the behaviour and may add fields the table does not list; consumers ignore fields they do not know. Every field listed is required unless marked `?`.

| Entity | Owner (behaviour) | Cross-boundary fields | Boundary it crosses |
|---|---|---|---|
| `Fish` | U3 | `id`, `speciesId`, `tankId`, `sex`, `stage`, `ageDays`, `sizeCm`, `health`, `satiety`, `stress`, `genome`, `value`, `mature` | U7 renders and selects; U4 feeds; U5 breeds; U6 prices and sells |
| `Tank` | U2 | `id`, `tier`, `volumeL`, `water`, `equipment`, `bioload`, `biofilterMaturity` | U3 reads water quality; U7 renders and displays |
| `FoodItem` | U4 | `id`, `kind`, `qty`, `quality`, `shelfLifeDays` | U7's feeding panel reads stock; U4 is the only writer |
| `FryCohort` | U5 | `id`, `speciesId`, `tankId`, `bornDay`, `count`, `ageDays`, `genomePool`, `survivalFactor` | U7 renders a cohort; U3 matures it into `Fish` records |
| `MarketState` | U6 | `speciesId`, `demand`, `trend`, `activeEvent?` | U7's market screen; U6 prices fish from it |
| `Order` | U6 | `id`, `speciesId`, `quantity`, `deadline`, `minQuality`, `reward`, `status` (`open \| fulfilled \| expired`) | U7's order board; U6 fulfils or expires it |
| `PlayerProgression` | U6 | `level` (1–3), `xp`, `unlocks` (`string[]`); `xpToNext` is derived, never stored | U7's HUD and unlock gating; U6 advances it |
| `Notification` | U6 | `id`, `priority` (`info \| warn \| critical`), `kind`, `subjectId`, `message` | U7's queue and auto-pause; U6 produces it (C4) |
| `Settings` | U1 (type); U7 renders the controls | `reducedMotion`, `autoPauseCritical`, `volume` (`{ master: number; sfx: number }`) | U7 reads and edits; U1 persists (C6). `reducedMotion` answers NFR2 |
| `Species` | U1 (data) | see C5 | U2, U3, U5, U6, U7 read it |

There is no `Stats` entity in the MVP. No requirement asks for lifetime aggregates; the "while you were away" summary is computed from the catch-up event batch (C4), not from stored totals. If a stats screen is specified later it arrives as an additive field.

## C2 — System registry, tick context, and the tick pipeline

A unit exports `register(registry: Registry): void`. It registers its systems, its command handlers, and — for U6 only — the notification mapper. U1 sorts systems by the declared phase, never by registration sequence, so the order is identical for live play, autosave reload, and offline catch-up.

```ts
// u1-sim-foundation — the write path, in one copyable block
import type { GameState, GameTime } from './state'
import type { Rng } from './rng'
import type { SpeciesCatalog } from './species'
import type { SimEvent, Notification } from './events'
import type { CommandMap, CommandHandler } from './commands'

export type Phase = 'feeding' | 'water' | 'fish' | 'breeding' | 'commerce' | 'notify'

export interface TickContext {
  state: GameState              // mutable contents; a system mutates only entities its unit owns
  tick: number                  // monotonic tick counter
  now: GameTime                 // { day, hour }
  rng: Rng                      // the single seeded stream
  species: SpeciesCatalog       // read-only content
  events: SimEvent[]            // append-only during the tick; never read back to drive state
  catchUp: boolean              // true only for the offline advance
}

export interface System {
  id: string                    // '<unit>.<name>', unique across the app
  phase: Phase
  run(ctx: TickContext): void
}

export type NotificationMapper =
  (event: SimEvent, species: SpeciesCatalog) => Notification | null

export interface Registry {
  registerSystem(system: System): void
  registerCommand<K extends keyof CommandMap>(
    type: K,
    handler: CommandHandler<CommandMap[K]['payload'], CommandMap[K]['result']>,
  ): void
  registerNotificationMapper(map: NotificationMapper): void
}
```

```yaml
shared-schema:
  name: SystemRegistry
  owner: u1-sim-foundation
  phase_order: [feeding, water, fish, breeding, commerce, notify]
  rules:
    - U1 sorts by the phase order above; ties break by registration order.
    - One unit may register more than one system; U6 registers its commerce and notify systems.
    - A duplicate system id, command type or notification mapper is a development-time error.
    - Only U7's composition root calls register(); its call order imposes no simulation order.
    - No Math.random, Date.now or other ambient nondeterminism inside a system; all randomness goes through ctx.rng.
  tick:
    - One tick is one game hour; ticks are discrete and never partial.
    - Live play queues ticks from elapsed real time at pause / x1 / x2 / x4.
    - A tick runs every phase in order, then the drain sequence in C4, then bumps version and marks the state dirty.
    - Catch-up advances up to 8 game-days (192 ticks) through the same pipeline with catchUp=true, without rendering; 'coarse resolution' means the hourly simulation step with no per-frame rendering and one aggregated summary, not a different step size.
    - After the cap the clock stops; remaining wall-clock time is discarded.
    - U3 suppresses lethal health transitions while catchUp is true and leaves affected fish in the protected critical state (health floor 10).
    - A system throwing is a bug: the tick aborts, U7 surfaces the fault, and the store is not rolled back. The last successful autosave is the recovery point.
```

## C3 — Command bus and command results

Every player action reaches the store as a command. A unit declares its command types by augmenting U1's `CommandMap`, and registers the matching handler in its `register()`. Type augmentation is type-only, so the runtime handler registration is the other half of the same contract, and C2's owner rules make it checkable (§ Development-time guarantees below).

```ts
// u1-sim-foundation — command contract
import type { GameState, GameTime } from './state'
import type { Rng } from './rng'
import type { SpeciesCatalog } from './species'
import type { SimEvent } from './events'

export interface CommandMap {}        // open; each unit augments it

export interface CommandContext {
  now: GameTime
  rng: Rng
  species: SpeciesCatalog
  events: SimEvent[]                  // append-only; the only way a command produces events
}

export type CommandOutcome<V> =
  | { ok: true; value: V }
  | { ok: false; error: CommandError }

export type CommandHandler<P, V> =
  (state: GameState, payload: P, ctx: CommandContext) => CommandOutcome<V>

export interface CommandError {
  code: CommandErrorCode
  message: string                     // safe to show the player
}

export type CommandErrorCode =
  | 'INSUFFICIENT_FUNDS' | 'TANK_FULL' | 'FISH_UNSELLABLE' | 'INVALID_QUANTITY'
  | 'UNKNOWN_ENTITY' | 'NOT_AVAILABLE' | 'INVALID_SETTING' | 'UNKNOWN_COMMAND'

export interface GameStore {
  state: GameState                    // U7 reads; it never writes
  version: number
  dispatch<K extends keyof CommandMap>(
    type: K,
    payload: CommandMap[K]['payload'],
  ): CommandOutcome<CommandMap[K]['result']>
  subscribe(listener: (events: SimEvent[]) => void): () => void
}
```

A handler validates, then mutates, then returns. Every mutation path returns before it writes, so a rejection leaves the store untouched by construction rather than by rollback.

```ts
// u6-commerce/src/commands.ts — type side and runtime side in one file
declare module '@aquarium/u1-sim-foundation/commands' {
  interface CommandMap {
    'commerce.buyFish': { payload: { speciesId: SpeciesId }; result: { fishId: FishId; price: number } }
    'commerce.sellFish': { payload: { fishId: FishId }; result: { price: number } }
  }
}

export function register(registry: Registry): void {
  registry.registerCommand('commerce.buyFish', buyFish)
  registry.registerCommand('commerce.sellFish', sellFish)
}

const buyFish: CommandHandler<{ speciesId: SpeciesId }, { fishId: FishId; price: number }> =
  (state, payload, ctx) => {
    const species = ctx.species.get(payload.speciesId)
    if (!species) return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: 'Unknown species.' } }
    const occupancy = Object.values(state.fish).filter(f => f.tankId === state.tank.id).length
    if (occupancy >= capacity(state.tank)) {
      return { ok: false, error: { code: 'TANK_FULL', message: 'The tank is full.' } }
    }
    if (state.money < species.buyPrice) {
      return { ok: false, error: { code: 'INSUFFICIENT_FUNDS', message: 'Not enough $FISH.' } }
    }
    const fish = spawnFish(state, species, ctx.rng)
    state.money -= species.buyPrice
    ctx.events.push({ kind: 'fishBought', fishId: fish.id, speciesId: species.id, price: species.buyPrice })
    ctx.events.push({ kind: 'moneyChanged', delta: -species.buyPrice, balance: state.money })
    return { ok: true, value: { fishId: fish.id, price: species.buyPrice } }
  }
```

```yaml
shared-schema:
  name: CommandBus
  owner: "u1-sim-foundation for the envelope and outcome; the handling unit for each command"
  guarantees:
    - The bus resolves the handler, then executes it. An unknown command type returns UNKNOWN_COMMAND and changes nothing.
    - A rejected command changes no state, emits no event, and does not bump version. This is a per-command test obligation.
    - An expected rejection is a returned outcome, never an exception; an unexpected exception is a bug and propagates.
    - A successful command bumps version once, runs the C4 drain sequence, and marks the state dirty for autosave.
    - Commands execute only between ticks. The seed plus the ordered command sequence is the determinism input.
    - The result carries the handler's value only. It never carries events; events reach the caller through the drain (C4).
    - The bus owns no rollback. Handlers validate before mutating.
```

## C4 — Simulation events and the per-tick buffer

Systems append to `ctx.events`; command handlers append to `ctx.events`. Nothing dispatches from inside a system or a handler. One buffer serves both paths, one drain empties it, and every subscriber sees every event exactly once.

**Drain sequence** — U1 runs it after a tick's `notify` phase, and immediately after a command returns:

1. apply the registered `NotificationMapper` to each buffered event and append the returned `Notification` entities to `state.notifications`;
2. deliver the whole buffered batch, as one array, to every subscriber in registration order;
3. clear the buffer.

**Who may act on an event.** The mapper is a pure function: it returns a `Notification` and mutates nothing. Applying it is U1's kernel write. Inside a tick, U6's `notify` system may also append `Notification` entities (its own type) for end-of-tick summaries such as `whileYouWereAway`. Subscribers — U7's audio and UI included — are read-only: an event never causes them to write the store. That is the full set of event consumers.

Events are declared through an open map, so the union derives itself and each unit augments its own variants:

```ts
// u1-sim-foundation — event contract
export interface SimEventMap {}       // open; each producing unit augments it

export type SimEvent = {
  [K in keyof SimEventMap]: { kind: K } & SimEventMap[K]
}[keyof SimEventMap]

// u4-feeding/src/events.ts
declare module '@aquarium/u1-sim-foundation/events' {
  interface SimEventMap {
    fed: { foodId: FoodItemId; portion: number }
    overfed: { wasteDelta: number }
    foodOut: { foodId: FoodItemId }
  }
}
```

The MVP target catalogue — every variant is `{ kind }` plus the fields below, all required unless marked `?`:

| `kind` | Producer | Fields |
|---|---|---|
| `fishBought` | U6 | `fishId: FishId`, `speciesId: SpeciesId`, `price: number` |
| `fishSold` | U6 | `fishId: FishId`, `price: number` |
| `fishSpawned` | U3 | `fishId: FishId`, `speciesId: SpeciesId`, `tankId: TankId` |
| `fishDied` | U3 | `fishId: FishId`, `cause: 'oldAge' \| 'starvation' \| 'waterQuality'` |
| `fishMatured` | U3 | `fishId: FishId`, `stage: 'adult' \| 'senior'` |
| `fed` | U4 | `foodId: FoodItemId`, `portion: number` |
| `overfed` | U4 | `wasteDelta: number` |
| `foodOut` | U4 | `foodId: FoodItemId` |
| `waterChanged` | U2 | `wasteDelta: number` |
| `equipmentUpgraded` | U2 | `equipment: string` |
| `fishSick` | U2 | `fishId: FishId`, `cause: 'waterQuality'` |
| `breedingStarted` | U5 | `fishIds: [FishId, FishId]` |
| `fryHatched` | U5 | `cohortId: CohortId`, `count: number` |
| `cohortGraded` | U5 | `cohortId: CohortId`, `count: number` |
| `orderFulfilled` | U6 | `orderId: OrderId`, `reward: number` |
| `orderExpired` | U6 | `orderId: OrderId` |
| `levelUp` | U6 | `level: number` |
| `moneyChanged` | U6 | `delta: number`, `balance: number` |
| `whileYouWereAway` | U1 | `elapsedDays: number`, `hatched: number`, `matured: number`, `diedOfOldAge: number`, `ordersExpired: number` |

```yaml
shared-schema:
  name: SimulationEvent
  owner: "u1-sim-foundation owns the buffer, the union derivation and the drain; each unit owns its variants; U6 owns the mapper"
  delivery:
    - Every event is delivered exactly once, in one batch per drain, to every subscriber.
    - A subscriber that throws cannot stop delivery to the others; U1 isolates each call.
    - subscribe() returns an unsubscribe function; a subscriber registered after a drain sees only later events.
  rules:
    - Events are facts about what already happened. No consumer reads an event to change any entity except Notification.
    - The notification mapper is pure and is the only event-to-state mapping; U1 applies it before every drain.
    - Command-produced events and tick-produced events take the same path, so a command's events reach U7 once.
    - The buffer is cleared after every drain; nothing accumulates between ticks.
```

## C5 — Species catalogue data contract

The catalogue is content, not code: one JSON file per species, validated at build time and at boot. It is the only content contract shared by four units.

```yaml
shared-schema:
  name: SpeciesCatalogue
  owner: u1-sim-foundation
  format: JSON
  catalogue_version: 1
  location: src/data/species/<id>.json
  required_fields:
    id: "stable slug, unique"
    name: "object keyed by locale (English only in the MVP)"
    archetype: "livebearer | scatter | plant | cave | bubbleNester | annual | hardBreed (only the first three breed in the MVP)"
    tier: "1 | 2 | 3"
    care: "1-5"
    buyPrice: "integer >= 0"
    sellBase: "integer >= 0"
    adultSizeCm: "number > 0"
    lifespanDays: "integer > 0"
    maturityDays: "integer > 0"
    juvenileDays: "integer > 0"
    diet: "{ type, firstFoodRequired: boolean }"
    genes: "locus map for genetics"
    palette: "colour tokens for procedural rendering"
    pattern: "pattern token"
    fin: "fin token"
    schooling: "number 0-1"
    territorial: "number 0-1"
    layer: "top | middle | bottom"
  validation:
    - Build time: an invalid entry fails the build.
    - Development boot: an invalid entry fails loudly, naming the file and the field.
    - Production boot: exclude the invalid species, log it, and keep the rest of the catalogue; never crash the app.
  versioning:
    - catalogueVersion bumps when a required field changes meaning.
    - Additive fields are ignored by readers that do not know them.
```

## C6 — Save file and the persistence surface

The save file is the only thing a player can keep outside the app. It is also, deliberately, not a command: it must work while the clock is paused, and it is not a simulation action. U1 owns the whole surface and U7 calls it directly.

**One version authority.** `schemaVersion` lives in the envelope only. `GameState` has none. Import reads the envelope's version, migrates the payload forward, and writes the new version on the next save.

```ts
// u1-sim-foundation — the API U7's save/load menu calls
export type SlotRef =
  | { kind: 'auto'; index: 1 | 2 | 3 }      // rotating autosave slots (FR9.1)
  | { kind: 'manual'; name: string }        // named slots (FR9.2)

export interface SlotInfo {
  ref: SlotRef
  savedAt: string                           // ISO-8601 UTC
  level: number
  money: number
  playtimeMs: number
}

export interface SaveLoadApi {
  autosave(): SaveOutcome
  saveToSlot(name: string): SaveOutcome
  listSlots(): readonly SlotInfo[]
  load(ref: SlotRef, opts?: { confirmStale?: boolean }): LoadOutcome
  deleteSlot(ref: SlotRef): void
  exportFile(): string                      // the serialized save, for download (FR9.3)
  importFile(text: string): LoadOutcome     // alongside the current save, never over it (FR9.3)
}

export type SaveOutcome =
  | { ok: true; ref: SlotRef; savedAt: string }
  | { ok: false; error: SaveError }

export type LoadOutcome =
  | { ok: true; ref: SlotRef; stale: boolean }
  | { ok: false; error: SaveError }

export interface SaveError {
  code: SaveErrorCode
  message: string                           // safe to show the player
}

export type SaveErrorCode =
  | 'CORRUPT_JSON' | 'INVALID_SHAPE' | 'UNSUPPORTED_VERSION'
  | 'CHECKSUM_MISMATCH' | 'MIGRATION_FAILED' | 'STORAGE_UNAVAILABLE'
  | 'SLOT_NOT_FOUND' | 'STALE_SAVE'
```

```yaml
shared-schema:
  name: SaveFile
  owner: u1-sim-foundation
  external: true
  schema_version: 1
  envelope:
    schemaVersion: integer          # the only version authority
    savedAt: "ISO-8601 UTC timestamp"
    playtimeMs: integer
    checksum: { algorithm: SHA-256, scope: "schemaVersion + savedAt + playtimeMs + state", value: "lowercase hex" }
    state: GameState                # no schemaVersion inside
  integrity:
    - The digest covers the canonical UTF-8 JSON of every envelope field except checksum itself: keys sorted, no insignificant whitespace, numbers in shortest round-trip form.
    - Import recomputes the digest; a mismatch rejects the import with CHECKSUM_MISMATCH.
    - Because savedAt is inside the digest, a hand-edited timestamp invalidates the file.
    - Rollback detection compares savedAt with lastSeenSaveAt kept in browser storage. An older save returns STALE_SAVE unless the caller passes confirmStale, and U7 asks the player before retrying.
    - The digest detects corruption and casual editing. It is not anti-cheat: the algorithm is public and the app runs in the player's browser, so anyone determined can recompute it.
  import_order:
    - Parse the JSON.
    - Validate the envelope shape and required fields.
    - Check the envelope schemaVersion is known and not newer than this build.
    - Verify the checksum.
    - Migrate the payload forward through the chain.
    - Run the rollback check.
    - Replace the state, leaving the current save untouched until every step passes.
  errors:
    CORRUPT_JSON: "the file is not JSON"
    INVALID_SHAPE: "required fields are missing or the wrong type"
    UNSUPPORTED_VERSION: "the schemaVersion is unknown or newer than this build"
    CHECKSUM_MISMATCH: "the payload or envelope was altered or truncated"
    MIGRATION_FAILED: "a migration step refused the data"
    STORAGE_UNAVAILABLE: "neither IndexedDB nor localStorage could be written"
    SLOT_NOT_FOUND: "the named slot holds no save"
    STALE_SAVE: "the save predates the newest one this install has seen; retry with confirmStale"
  slots:
    auto: "three rotating autosave slots; autosave writes the oldest (FR9.1, ~30 s and on key events)"
    manual: "named slots, created on demand; a name is the key, and saving over an existing name replaces it (FR9.2)"
    export: "exportFile() serializes the current state; no slot is written (FR9.3)"
  packaging:
    unknown_fields: "ignored on read and dropped on the next write — additive changes stay safe"
    migration: "forward-only chain v1 -> v2 -> ...; each step is a pure function; every bump ships with a round-trip test"
    write: "serialize -> write a temporary key -> read back to verify -> swap to the active key; retry once; fall back to localStorage; if both fail, warn and disable autosave until the next successful write"
    newer_version: "rejected with UNSUPPORTED_VERSION; the current save is untouched"
    corrupt_import: "rejected with a named error; the current save is untouched"
```

## Contract ownership rules

- **U1 owns C1, C2, C3's envelope and outcome, C4's buffer, derivation and drain, C5 and C6.** U1 writes the base types once; no other unit edits U1's core declaration files.
- **Each simulation unit owns its own commands and events.** It declares its command payloads, result values and event variants in its own folder and adds them to the open maps by TypeScript module augmentation (Q5-B). It registers the runtime handlers and systems in its `register(registry)`.
- **U6 owns the notification mapper and the `Notification` type's contents**; U1 defines the type's shape and applies the mapper.
- **U1 handles `settings.update`**, because `Settings` is a kernel type and U7 never writes the store.
- **Additive changes are always safe**: a new command, a new event variant, a new optional field, or a new selector. Consumers ignore unknown fields.
- **Breaking changes** (rename, removal, or a change of meaning) are made in one commit across the provider and U7, and recorded in this summary. A breaking change to the save payload bumps `schemaVersion` and ships with a migration. Commands and events carry no version field in the MVP because there is one consumer and one deployed bundle.
- **This summary is the living contract record.** A change that alters a boundary updates this file in the same change; a change that only adds a command or event variant does not need an edit here, because both maps are open by construction.

### Development-time guarantees

An open map that nobody registers is a runtime surprise, so two checks make the halves meet:

1. **Augmentation is loaded.** Each unit's `index.ts` re-exports its augmentation modules, and U7's composition root imports every unit's `index.ts`. No unit's `CommandMap` or `SimEventMap` keys can be missing at a dispatch site.
2. **Every declared command has a handler.** A single test asserts that the set of registered command types equals `keyof CommandMap`, written as a `satisfies Record<keyof CommandMap, true>` object so a missing entry is a compile error and a missing registration is a test failure. Registration itself runs at boot, and a duplicate or missing handler fails the boot in development.

## Error, timeout, and retry behaviour

- **In-process boundaries have no timeout and no retry.** A command returns an outcome; a system runs synchronously inside the tick; an event is delivered synchronously by the drain.
- **Rejected commands** return `{ ok: false, error }`, emit nothing, and leave the store untouched. U7 shows `error.message` and maps `error.code` to the relevant screen.
- **Event subscribers** are isolated: one subscriber throwing does not stop delivery to the others.
- **Save and import** are the only failure-prone boundaries, and they speak one vocabulary: `SaveErrorCode`. U7 never sees a second one. Their retry and fallback behaviour is in C6: one write retry, localStorage fallback, and a named import error that leaves the current save intact.
- **Catch-up** is capped, not retried: up to 8 game-days, then the clock stops.

## Open questions

| Contract | Question | Blocks |
|---|---|---|
| C3, C4 | The per-unit command and event catalogue is finalized in each unit's Functional Design. The envelope, the open maps, the drain rule and the version bump are fixed here. | U2–U6 Functional Design |
| C1 | The selector list is a family, not an exhaustive list: a screen adds a selector when it needs one, without changing the state schema. | U7 Functional Design |
| C5 | The exact gene loci and palette tokens per species come from the GDD appendix; filling them is content work, not a contract change. | U1 data completion |
| C6 | The manual-slot limit is a UI decision (the architecture allows N). U7's save/load screen fixes the number; the API does not care. | U7 Functional Design |
