<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-11-14T09:06:29Z — Q3's per-tick buffer was extended to the command path: a command's events are drained immediately after it returns, and a tick's events after the notify phase; commands never run during a tick, so the two drains never interleave.
- 2026-11-14T09:06:29Z — Q5-B's module augmentation is type-only, so the contract pairs it with runtime handler registration: each unit's `register(registry)` registers both its systems and its command handlers.
- 2026-11-14T09:06:29Z — "coarse resolution" for catch-up is defined as the hourly simulation step with no rendering and one aggregated summary, not a larger step; this keeps catch-up identical to live play and closes the wording tension flagged against units-generation.
- 2026-11-14T11:59:30Z — on the human's instruction the write path is pinned as mutable state handed to systems and handlers (`ctx.state`, `handler(state, payload, ctx)`); per-unit ownership of entity slices stays a review rule rather than a type rule, because TypeScript cannot cheaply enforce it.
- 2026-11-14T11:59:30Z — a rejection is a returned `CommandOutcome` union, so validate-then-mutate is the shape of every handler and "a rejected command changes nothing" is asserted per command rather than trusted to a rollback.
- 2026-11-14T11:59:30Z — one buffer and one drain for both paths: tick events and command events take the identical route, the mapper is a pure function U1 applies before each drain, and `CommandOutcome` carries the value only, never events.
- 2026-11-14T11:59:30Z — `SimEvent` is derived from an open `SimEventMap` (`{ [K in keyof SimEventMap]: { kind: K } & SimEventMap[K] }[keyof SimEventMap]`) rather than declared as a union, because a union alias cannot be extended by module augmentation.
- 2026-11-14T11:59:30Z — `schemaVersion` moved out of `GameState` into the save envelope alone; the digest now covers `schemaVersion + savedAt + playtimeMs + state`, so a hand-edited timestamp invalidates the file.
- 2026-11-14T11:59:30Z — persistence is a U1 API that U7 calls directly rather than a command: it must work while the clock is paused and is not a simulation action, and it keeps one error vocabulary (`SaveErrorCode`) instead of a second one in `CommandErrorCode`.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-11-14T09:06:29Z — the source architecture doc's §5.3 sketches catch-up as 24-hour aggregated day steps; this contract keeps the hourly pipeline instead. The MVP state is small enough that 192 hourly ticks are cheap, and the exact replay preserves the "same pipeline" promise the units artifacts already make.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-14T09:06:29Z — chose the SHA-256 digest plus rollback flag (Q8-B) over a per-install HMAC: in a client-only game the key would sit next to the data, so the extra key management buys no real protection while binding saves to one install.
- 2026-11-14T09:06:29Z — summarised six contracts keyed by interface rather than one per DAG edge: the eleven edges share the same store, registry, command bus and event bus, so per-edge rows would repeat one spec five times.
- 2026-11-14T11:59:30Z — dropped the `Stats` entity instead of inventing a shape for it: no MVP requirement asks for lifetime aggregates and the "while you were away" summary comes from the catch-up event batch, so the field can return additively if a stats screen is ever specified.
- 2026-11-14T11:59:30Z — kept the `notify` phase from units-generation rather than removing it: U6 still needs a place to emit end-of-tick summary events (`whileYouWereAway`), while the event-to-notification mapping itself moved to a pure mapper U1 applies on both the tick and command paths.
- 2026-11-14T11:59:30Z — made the notification mapper a registered pure function instead of letting a consumer write state from an event: it resolves the contradiction between the drain rule and U6 writing `Notification` entities, and keeps the "events never change the store" rule literally true.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-11-14T09:06:29Z — the definitive command and event catalogue per unit is left to each unit's Functional Design; the envelope, channel and drain rule are fixed in C3/C4.
- 2026-11-14T09:06:29Z — the selector list is a family rather than an exhaustive list; U7 adds selectors as screens are built.
- 2026-11-14T09:06:29Z — per-species gene loci and palette tokens are content work from the GDD appendix, not a contract change.
