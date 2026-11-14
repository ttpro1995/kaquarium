# Rules — u1-sim-foundation

> Upstream: `unit-of-work.md`, `unit-of-work-story-map.md`, `stories.md` (AC9.1.1–AC11.1.1), `requirements.md` (FR9–FR11, NFR3, NFR4), `components.md`, `contract-summary.md` (C1–C6). Answers from `functional-design-questions.md` (Q1–Q6, summary `Looks correct`).

```yaml
rules:
  - id: BR1.1
    statement: One tick advances the game clock by exactly one game hour through every pipeline phase in fixed order.
    category: policy
    applies_to: GameClock
    trigger: A queued tick fires at the current speed.
    logic: IF a tick fires THEN advance gameHour by 1 (rolling into gameDay) AND run phases feeding → water → fish → breeding → commerce → notify in that order, THEN run the drain sequence, THEN bump version once and mark dirty (Q5-A).
    violation: A tick that skips a phase or runs phases out of order is a bug; the tick aborts and the last autosave is the recovery point.
    source: FR10.2

  - id: BR1.2
    statement: Speed controls queue ticks; pause stops queuing without changing state.
    category: validation
    applies_to: GameClock
    trigger: A `clock.setSpeed` / `clock.setPaused` command (Q1-A).
    logic: IF speed is 0 or paused is true THEN no ticks queue AND the store is unchanged; IF speed is 1/2/4 THEN ticks queue at that rate AND paused is false; IF paused is set false THEN speed becomes 1 (deterministic; no prior-speed restore).
    violation: Rejected with NOT_AVAILABLE; state untouched, no event, no version bump.
    source: FR10.1

  - id: BR1.3
    statement: Speed and paused stay in sync under a documented invariant.
    category: constraint
    applies_to: GameClock
    trigger: Any clock command or boot.
    logic: IF speed is set to 0 THEN paused becomes true; IF speed is set to 1/2/4 THEN paused becomes false; IF paused is set true THEN speed becomes 0 (Q3-A keeps both fields).
    violation: A state with paused != (speed == 0) fails validation on load with INVALID_SHAPE.
    source: FR10.1

  - id: BR2.1
    statement: All simulation randomness flows through the single seeded stream; the same seed plus command sequence reproduces the same state.
    category: policy
    applies_to: RngState
    trigger: Any system or command handler needing randomness.
    logic: IF randomness is needed THEN draw from ctx.rng AND advance cursor a; IF the same seed and ordered command sequence replay THEN the state matches exactly.
    violation: Use of ambient nondeterminism (Math.random, Date.now) inside a system is a bug.
    source: FR10.2

  - id: BR3.1
    statement: U1's command catalogue is settings plus clock; every command validates before mutating and a rejection changes nothing.
    category: validation
    applies_to: GameState
    trigger: Dispatch of `settings.update`, `clock.setSpeed`, or `clock.setPaused` (Q1-A).
    logic: IF payload is invalid THEN return { ok: false } with a named code AND emit no event AND bump no version; IF valid THEN mutate, append events, drain (mapper → deliver → clear), bump version once, mark dirty (Q5-A).
    violation: An expected rejection is a returned outcome, never an exception; an unexpected exception is a bug and propagates.
    source: FR10.1

  - id: BR4.1
    statement: Systems run in declared-phase order, never registration order, identically for live play, reload, and catch-up.
    category: policy
    applies_to: Registry
    trigger: Tick execution and offline catch-up.
    logic: IF systems register with a phase from the U1 enum THEN U1 sorts by [feeding, water, fish, breeding, commerce, notify] AND ties break by registration order.
    violation: A duplicate system id, command type, or notification mapper is a development-time error (Q6-A).
    source: FR10.2

  - id: BR4.2
    statement: Every declared command has a registered handler; the halves are checked, not hoped for.
    category: validation
    applies_to: Registry
    trigger: Build / dev boot (Q6-A).
    logic: IF the registered-command set differs from keyof CommandMap THEN the build or dev boot fails naming the missing entry; IF a duplicate registers THEN dev boot throws.
    violation: Missing registration fails the test; duplicates fail dev boot loudly.
    source: FR10.2

  - id: BR5.1
    statement: Species catalogue entries validate at build and degrade safely in production.
    category: validation
    applies_to: Species
    trigger: Build, dev boot, production boot.
    logic: IF an entry is invalid THEN fail the build; IF dev boot finds one THEN fail loudly naming file and field; IF production boot finds one THEN exclude it, log it, and keep the catalogue.
    violation: A missing required field is INVALID_SHAPE at build/dev; never a crash in production.
    source: FR10.2

  - id: BR6.1
    statement: Autosave rotates three slots about every 30 seconds and on key events, including while paused.
    category: policy
    applies_to: SaveEnvelope
    trigger: Timer or key event (Q4-A allows saves while paused).
    logic: IF autosave fires THEN serialize current state, write the oldest auto slot (1|2|3), read back to verify, and swap to active.
    violation: Write failure retries once, falls back to localStorage, then warns and disables autosave until the next successful write.
    source: FR9.1

  - id: BR6.2
    statement: Manual slots are unbounded and name-keyed; export writes no slot and never disturbs the current save.
    category: policy
    applies_to: SlotInfo
    trigger: saveToSlot(name), load(ref), exportFile(), importFile(text) (Q4-A).
    logic: IF saving to an existing name THEN replace it; IF exporting THEN serialize without writing any slot; IF importing THEN run parse → shape → version → checksum → migrate → rollback checks AND only replace state when every step passes.
    violation: CORRUPT_JSON, INVALID_SHAPE, UNSUPPORTED_VERSION, CHECKSUM_MISMATCH, MIGRATION_FAILED, STALE_SAVE — each leaves the current save untouched.
    source: FR9.2, FR9.3

  - id: BR6.3
    statement: Saves migrate forward and roll back safely; the digest covers the envelope except itself.
    category: constraint
    applies_to: SaveEnvelope
    trigger: Load or import.
    logic: IF schemaVersion is older THEN migrate forward through the pure-function chain; IF newer THEN reject UNSUPPORTED_VERSION; IF savedAt predates lastSeenSaveAt THEN return STALE_SAVE unless confirmStale.
    violation: MIGRATION_FAILED or CHECKSUM_MISMATCH rejects with a named error; the current save is untouched.
    source: FR9.1, FR9.2, FR9.3

  - id: BR6.4
    statement: Slot deletes are explicit and never touch loaded state.
    category: policy
    applies_to: SlotInfo
    trigger: deleteSlot(ref).
    logic: IF the slot does not exist THEN return SLOT_NOT_FOUND AND change nothing; IF it exists THEN remove it AND leave the loaded in-memory state untouched.
    violation: A delete that alters loaded state or silently ignores a missing slot.
    source: FR9.2

  - id: BR7.1
    statement: Offline catch-up advances at most 8 game-days through the same pipeline with catchUp=true, then stops and summarizes.
    category: policy
    applies_to: GameClock
    trigger: Return after being closed.
    logic: IF wall-clock absence exceeds 8 game-days THEN advance 192 ticks coarsely (hourly step, no rendering, one aggregated summary) AND stop the clock AND discard remaining time; U3 suppresses lethal transitions under catchUp (protected critical state, health floor 10).
    violation: Advancing past the cap or killing fish while away violates the rule; the summary must still report hatched/matured/diedOfOldAge/ordersExpired.
    source: FR11.1
```

## Rules summary

| ID | Rule | Source |
|---|---|---|
| BR1.1 | Fixed 1-hour tick, phase order, drain-then-bump | FR10.2 |
| BR1.2 | Speed queues ticks; pause queues none | FR10.1 |
| BR1.3 | speed/paused mirror invariant | FR10.1 |
| BR2.1 | Single seeded RNG; replay reproduces state | FR10.2 |
| BR3.1 | U1 commands validate-then-mutate; rejections touch nothing | FR10.1 |
| BR4.1 | Phase-order execution, identical everywhere | FR10.2 |
| BR4.2 | Registration exhaustiveness checked at build/dev-boot | FR10.2 |
| BR5.1 | Species validation: fail build/dev, exclude+log in prod | FR10.2 |
| BR6.1 | Autosave rotates 3 slots ~30s, works while paused | FR9.1 |
| BR6.2 | Manual slots unbounded; export writes no slot; import never clobbers | FR9.2, FR9.3 |
| BR6.3 | Forward migrations; checksum + STALE_SAVE rollback guard | FR9.1, FR9.2, FR9.3 |
| BR6.4 | Slot deletes explicit; loaded state untouched | FR9.2 |
| BR7.1 | Catch-up capped at 8 game-days, no neglect deaths, summary | FR11.1 |
