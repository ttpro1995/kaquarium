# Entities — u1-sim-foundation

> Upstream: `unit-of-work.md` (U1 owns shared kernel: types, store, command bus, tick registry, species data, save/load), `unit-of-work-story-map.md` (US9.1–US9.3, US10.1, US10.2, US11.1), `stories.md`, `requirements.md` (FR9–FR11, NFR3, NFR4), `components.md` (Clock, SpeciesCatalog, Persistence), `contract-summary.md` (C1–C6). Answers from `functional-design-questions.md` (Q1–Q6, summary `Looks correct`).

U1 defines every entity TYPE in the shared schema; each sim unit owns the behaviour over its entity and never redefines another unit's type (C1 ownership rule). This file fully declares the kernel types (`GameState`, `GameClock`, `RngState`, `Species`, `Settings`, `SaveEnvelope`, `SlotInfo`). The full attribute declarations of cross-unit entities (`Tank`, `Fish`, `FoodItem`, `FryCohort`, `MarketState`, `Order`, `PlayerProgression`, `Notification`) live in the owning unit's `entities.md`; their cross-boundary fields are contracted in the C1 table of `contract-summary.md`. Per Q2-B, fish↔tank membership is `Fish.tankId` (authoritative; capacity derives by scan — no `Tank.fishIds`). Per Q3-A, `GameClock.paused` mirrors `speed === 0` and `RngState.seed` mirrors `GameState.seed` at boot (invariants, not removed fields).

```yaml
entities:
  - name: GameState
    description: Single shared store contents; the only mutable simulation state. Written only by command handlers, registered systems, and U1 kernel ops (C1).
    attributes:
      - { name: seed, type: integer, required: true, constraints: ">= 0; fixed at boot; determinism input with command sequence" }
      - { name: rngState, type: RngState, required: true }
      - { name: clock, type: GameClock, required: true }
      - { name: money, type: integer, required: true, min: 0, constraints: "$FISH, never negative" }
      - { name: reputation, type: integer, required: true }
      - { name: progression, type: PlayerProgression, required: true, references: "defined by U6; type declared here" }
      - { name: tank, type: Tank, required: true, references: "defined here; behaviour owned by U2" }
      - { name: fish, type: "map<FishId, Fish>", required: true, references: "defined here; behaviour owned by U3; each Fish carries tankId (Q2-B)" }
      - { name: cohorts, type: "map<CohortId, FryCohort>", required: true, references: "behaviour owned by U5" }
      - { name: food, type: "map<FoodItemId, FoodItem>", required: true, references: "behaviour owned by U4" }
      - { name: market, type: "map<SpeciesId, MarketState>", required: true, references: "behaviour owned by U6" }
      - { name: orders, type: "Order[]", required: true, references: "behaviour owned by U6" }
      - { name: notifications, type: "Notification[]", required: true, references: "produced by U6 mapper; applied by U1 drain" }
      - { name: settings, type: Settings, required: true }
    constraints:
      - "No schemaVersion inside GameState; the save envelope owns the version (C6)."
      - "Render state never enters GameState and is never serialized."

  - name: GameClock
    description: Game time, speed, and pause. One game hour per tick; speeds pause/x1/x2/x4 (FR10.1).
    attributes:
      - { name: gameDay, type: integer, required: true, min: 0 }
      - { name: gameHour, type: integer, required: true, min: 0, max: 23 }
      - { name: speed, type: enum, required: true, allowed_values: [0, 1, 2, 4], constraints: "0 = paused" }
      - { name: paused, type: boolean, required: true, constraints: "INVARIANT (Q3-A): paused == (speed == 0); clock commands keep both in sync" }
    constraints:
      - "Ticks are discrete game hours, never partial; speed only changes how fast real time queues them."

  - name: RngState
    description: Single seeded RNG stream (NFR3 determinism). All randomness inside systems goes through it; no Math.random/Date.now in systems.
    attributes:
      - { name: seed, type: integer, required: true, constraints: "INVARIANT (Q3-A): mirrors GameState.seed; set once at boot, never mutated after" }
      - { name: a, type: integer, required: true, constraints: "stream cursor; advances on every draw" }

  - name: Species
    description: One data-complete species entry (30 species; only livebearer/scatter/plant breed in MVP). Content, not code (C5).
    attributes:
      - { name: id, type: string, required: true, unique: true, constraints: "stable slug" }
      - { name: name, type: "map<locale, string>", required: true, constraints: "English in MVP" }
      - { name: archetype, type: enum, required: true, allowed_values: [livebearer, scatter, plant, cave, bubbleNester, annual, hardBreed] }
      - { name: tier, type: integer, required: true, min: 1, max: 3 }
      - { name: care, type: integer, required: true, min: 1, max: 5 }
      - { name: buyPrice, type: integer, required: true, min: 0 }
      - { name: sellBase, type: integer, required: true, min: 0 }
      - { name: adultSizeCm, type: number, required: true, constraints: "> 0" }
      - { name: lifespanDays, type: integer, required: true, constraints: "> 0" }
      - { name: maturityDays, type: integer, required: true, constraints: "> 0" }
      - { name: juvenileDays, type: integer, required: true, constraints: "> 0" }
      - { name: diet, type: object, required: true, constraints: "{ type, firstFoodRequired: boolean }" }
      - { name: genes, type: object, required: true, constraints: "locus map for genetics" }
      - { name: palette, type: object, required: true, constraints: "colour tokens for procedural rendering" }
      - { name: pattern, type: string, required: true }
      - { name: fin, type: string, required: true }
      - { name: schooling, type: number, required: true, min: 0, max: 1 }
      - { name: territorial, type: number, required: true, min: 0, max: 1 }
      - { name: layer, type: enum, required: true, allowed_values: [top, middle, bottom] }
    constraints:
      - "Build time: invalid entry fails the build. Dev boot: loud failure naming file+field. Prod boot: exclude + log, keep catalogue (C5)."

  - name: Settings
    description: Kernel-owned player settings (U1 type; U7 renders controls). Answers NFR2 reduced-motion.
    attributes:
      - { name: reducedMotion, type: boolean, required: true, default: false }
      - { name: autoPauseCritical, type: boolean, required: true, default: true }
      - { name: volume, type: object, required: true, constraints: "{ master: number; sfx: number }" }

  - name: SaveEnvelope
    description: Versioned outer document for slots, autosave, and export (C6). Sole version authority.
    attributes:
      - { name: schemaVersion, type: integer, required: true, constraints: "only version authority; GameState carries none" }
      - { name: savedAt, type: string, required: true, constraints: "ISO-8601 UTC; inside checksum scope" }
      - { name: playtimeMs, type: integer, required: true, min: 0 }
      - { name: checksum, type: object, required: true, constraints: "sub-fields: { algorithm: literal 'SHA-256', scope: fixed string 'schemaVersion + savedAt + playtimeMs + state', value: lowercase hex string }; covers canonical UTF-8 JSON of every envelope field except checksum itself" }
      - { name: state, type: GameState, required: true }

  - name: SlotInfo
    description: Slot directory entry for the save/load menu (C6).
    attributes:
      - { name: ref, type: SlotRef, required: true, constraints: "auto { kind: auto; index: 1|2|3 } | manual { kind: manual; name: string }" }
      - { name: savedAt, type: string, required: true }
      - { name: level, type: integer, required: true, min: 1, max: 3 }
      - { name: money, type: integer, required: true, min: 0 }
      - { name: playtimeMs, type: integer, required: true, min: 0 }

relationships:
  - { from: GameState, to: GameClock, cardinality: "1:1", direction: contains }
  - { from: GameState, to: RngState, cardinality: "1:1", direction: contains }
  - { from: GameState, to: Species, cardinality: "1:N", direction: references-readonly, note: "species catalogue is content read via catalog, not stored per save" }
  - { from: GameState, to: Settings, cardinality: "1:1", direction: contains }
  - { from: GameState, to: Fish, cardinality: "1:N", direction: contains, note: "each Fish.tankId points at the single tank (Q2-B)" }
  - { from: SaveEnvelope, to: GameState, cardinality: "1:1", direction: contains }
  - { from: SlotInfo, to: SaveEnvelope, cardinality: "N:1", direction: summarizes }
```

## Summary

U1's entity set is the kernel: `GameState` (the single store), `GameClock` (day/hour/speed/paused with the Q3-A mirror invariant), `RngState` (seed mirror + cursor), `Species` (30 data-complete entries), `Settings`, and the persistence pair `SaveEnvelope`/`SlotInfo`. Cross-unit types are referenced from `GameState` (e.g. each `Fish` carries `tankId` per Q2-B, so capacity is always a scan, never a second list to keep in sync); their full declarations live in the owning units' `entities.md` with cross-boundary fields contracted in C1.
