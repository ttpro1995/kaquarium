<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-11-14T01:45:40Z — grouped the 14 components into 7 domain units (6 library + 1 ui). Economy landed in u6-commerce (not u1-foundation) because the domain design's depends_on ties Economy to Market/Orders/TankEnvironment, so it cannot be a foundation leaf.
- 2026-11-14T01:45:40Z — the walking skeleton resolves as the U1→U2→U3 chain plus the U7 shell (buy a fish, see it swim, feed it, watch it grow), the smallest slice that runs end to end.
- 2026-11-14T02:32:20Z — revised the DAG to a strict shared-kernel shape: every entity type and the sim-event union live in U1, so every unit depends only on u1-sim-foundation. The person asked for the fixes to be made with judgement, and the reviewer had flagged the earlier U2↔U3 mediation notes as contradicting the edges.
- 2026-11-14T02:32:20Z — expanded the skeleton slice to U1+U2+U3+U4+U6-money+U7 after the person said "R11 add both to demo"; the demo now buys, feeds, and grows a fish rather than overclaiming what U1/U2/U3/U7 could run.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-11-14T02:32:20Z — edited `refined-mockups/mockups.md` during this stage while resolving R-05 (added a Fish Store wireframe and its states), because the buy surface was missing from the approved mockups and the person asked to revisit the mockup for the buy-a-fish step. The stage's own outputs are unchanged in scope; the mockup edit is a downstream-artifact correction.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-14T02:32:20Z — accepted a single-edge DAG (every unit → U1) over modelling true per-unit data dependencies: code dependencies are what the DAG is for, and the shared store + tick registry mediate data flow, so cross-edges would only add false serialization.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-11-14T02:32:20Z — the composition root (app bootstrap that registers the systems and mounts the UI) has no owning unit; Contract Design should decide whether it belongs to U1 or is implicit app wiring.
- 2026-11-14T02:42:15Z — resolved: U7 owns the composition root (store construction, `register(registry)` calls, app mount) and produces the monolithic app artifact; u7 now depends on u2–u6. Open follow-up: which unit declares the fixed tick ORDER that the registry applies (U1 owns the order, but no artifact yet says how a system declares its position), so Contract Design must pin the `System` contract's ordering field.
