# Functional Design — Questions (u1-sim-foundation)

> Unit U1 owns the shared kernel: entity types + sim-event union, store, command bus (`CommandMap`, `CommandOutcome`), system registry + fixed 1-game-hour tick pipeline (feeding → water → fish → breeding → commerce → notify), seeded RNG, 30-species data, save/load + autosave, migrations, JSON export/import, offline catch-up (8 game-days, protected critical state). Contracts C1–C6 (`contract-summary.md`) fix the envelope; this design finalizes U1's own commands/events and closes R-09–R-15 risks carried from Contract Design.

## Q1. [Design] Which commands does U1 itself handle

U1 must own `settings.update` (C-summary). Time controls (pause/x1/x2/x4) and `seed`-level operations could be commands or direct kernel calls. This decides U1's command catalogue.

A. U1 handles `settings.update` + `clock.setSpeed` / `clock.setPaused` as commands (uniform path, version bump, events)
B. U1 handles `settings.update` only; speed/paused are direct store writes via U7 (no version bump, no events)
X. Other (please specify)

[Answer]: A

## Q2. [Design] Fish↔tank membership (R-13)

`GameState` carries `tank: Tank` (one tank MVP) and `fish: Record<FishId, Fish>`. Fish need a tank link for capacity checks and rendering. Options: `Fish.tankId` field, or `Tank.fishIds: FishId[]`, or both with an invariant.

A. `Tank.fishIds: FishId[]` is authoritative; `Fish` carries no tank link (one tank, no query need)
B. `Fish.tankId: TankId` is authoritative; tank capacity derives by scan
C. Both, with invariant (every fish id appears exactly once in tank list)
X. Other (please specify)

[Answer]: B

## Q3. [Design] `speed`/`paused` + `seed` duplication (R-15)

`GameClock` carries `speed: 0|1|2|4` and `paused: boolean` (overlap: speed 0 vs paused true). `GameState` carries `seed` and `rngState: { seed, a }` (seed twice). This decides the canonical shape before Code Generation.

A. Keep both with invariant documented (`paused` mirrors `speed === 0`; `rngState.seed` mirrors `seed` at boot)
B. Canonicalize: `paused` derived from `speed === 0` (remove field); `rngState` drops `seed` (keeps `a` only, seed lives on state)
X. Other (please specify)

[Answer]: A

## Q4. [Design] Save/slot semantics (R-12)

C6 defines `SlotRef` (auto 1|2|3 rotating, manual named), `SaveOutcome`/`LoadOutcome`, `SaveErrorCode`. Open: manual-slot limit (C6 says UI decides), save-during-pause, and whether `exportFile()` writes a slot.

A. Manual slots unbounded (name is key, overwrite replaces); saves allowed while paused; export writes no slot
B. Manual slots capped at 3 (like autos); saves allowed while paused; export writes no slot
X. Other (please specify)

[Answer]: A

## Q5. [Design] Version-bump and drain order (R-11)

Contract says: successful command bumps version once, runs C4 drain, marks dirty; tick runs phases then drain then bump. Exact order of version bump vs drain vs dirty-flag matters for subscriber re-reads.

A. Command: validate → mutate → append events → drain (mapper + deliver + clear) → bump version → mark dirty. Tick: phases → drain → bump → dirty.
B. Command: validate → mutate → bump version → drain → dirty. Tick: phases → bump → drain → dirty.
X. Other (please specify)

[Answer]: A

## Q6. [Design] Registration exhaustiveness check (R-09)

Development-time guarantee: every declared command has a handler; duplicate system/command/mapper fails loudly. Where does the check live so a missing registration fails the build/dev-boot but never crashes production.

A. Single test asserts registered-command set equals `keyof CommandMap` (compile error if a key missing + test failure if unregistered); boot duplicates throw in dev, log-and-ignore unknown species in prod (C5 rule)
B. Runtime check on every dispatch only; no dedicated test
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
