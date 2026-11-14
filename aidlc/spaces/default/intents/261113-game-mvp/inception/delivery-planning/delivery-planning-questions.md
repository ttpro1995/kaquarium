# Delivery Planning — Questions

> Units Generation already fixed what depends on what: the shared kernel (U1) comes first, the five simulation units (U2–U6) build on it and are independent of each other, and the presentation layer (U7) wires them together last. That is the geometry. What it cannot tell us is the economic order — what to build first so we learn the most, and how big each build step should be. A **Bolt** is one build pass over a piece of the work, ending in something that runs.

## Q1. [Delivery] What decides the build order

Your affirmed practice is a **walking skeleton**: the smallest slice that runs the whole way through, built before the features that flesh it out. This asks what governs the order once that first slice exists.

A. Skeleton first, then risk-first — after the skeleton, build whatever could most change our minds about the design
B. Skeleton first, then value-first — after the skeleton, build whatever earns $FISH or XP fastest
C. Skeleton first, then plain dependency order (kernel, then the simulation units, then the interface) with no further weighting
D. No skeleton ceremony — build in plain dependency order and treat the first unit as the skeleton
X. Other (please specify)

[Answer]: A

## Q2. [Delivery] How big one Bolt is

A. One Bolt per Unit of Work — seven Bolts, each small and independently verifiable
B. Bundle related Units into one Bolt when they share an integration point — fewer, larger Bolts
C. Thin slices that cut across Units, each delivering one player-visible behaviour end to end
X. Other (please specify)

[Answer]: A

## Q3. [Delivery] Do Bolts run one at a time

The recorded construction setting is unit-major and serial: one Unit finishes its design and its code before the next starts, and each completed Unit is checked before the next begins. That suits a solo build with one machine.

A. Keep serial — one Bolt at a time, each verified before the next starts
B. Allow parallel Bolts where the dependency graph permits — several Units built at once, then integrated
X. Other (please specify)

[Answer]: B

## Q4. [Delivery] How to rank the work after the skeleton

A. Plain judgement, recorded as a one-line reason per Bolt — right for a solo build of this size
B. WSJF, a Weighted Shortest Job First score: (value + urgency + risk reduction) divided by size, highest first
C. Risk only — order by what is most likely to break
X. Other (please specify)

[Answer]: B

## Q5. [Delivery] What the walking skeleton's first checkpoint actually is

The build order is one Unit at a time, so the first checkpoint lands on the shared-kernel unit (U1) — the store, the tick loop, the system registry, the species data and save/load. The buy-a-fish, feed-it, watch-it-grow demo from Units Generation spans six Units and can only be shown once the presentation layer (U7) is built. This asks which slice the first checkpoint proves.

A. The first checkpoint proves the kernel end to end, headlessly — boot the kernel, advance ticks, drive it through the command bus, save and reload; the rendered buy/feed/grow demo is the checkpoint at the presentation unit (U7)
B. Revisit Units Generation so the first Unit is the whole end-to-end slice (kernel through interface, minus breeding), and the first checkpoint shows the rendered demo
C. Build the kernel plus a minimal presentation shell against placeholder simulation units, so the rendered demo runs at the second checkpoint
X. Other (please specify)

[Answer]: A 

## Q6. [Delivery] The proposed Bolt breakdown

The plan groups the seven Units into Bolts. Confirm it, or say what to change.

- **Bolt 1 — kernel**: the shared-kernel unit (U1) in full: entity types, sim-event union, seeded RNG, tick loop, system registry, species data, save/load and autosave. Skeleton marker.
- **Bolt 2 — care loop**: the tank-and-water unit (U2), the fish-lifecycle unit (U3), the feeding unit (U4) and the money logic of the commerce unit (U6) — the fish live, eat, grow and can be bought and sold.
- **Bolt 3 — depth of the care loop**: equipment upgrades (U2), growth/health/death depth (U3), food stock and the auto-feeder (U4).
- **Bolt 4 — breeding**: the breeding unit (U5) and the cohort-to-fish maturation handoff in the fish unit (U3).
- **Bolt 5 — commerce depth**: market demand, orders, reputation and levels (U6), plus the store, roster, orders, statistics and customers screens (U7).
- **Bolt 6 — persistence and interface finish**: schema migrations, JSON export/import and offline catch-up (U1), plus the save/load menu and the notification bell (U7).

A. Confirm this breakdown
B. Change it — say which Units move between Bolts
X. Other (please specify)

[Answer]: A

## Q7. [Delivery] Anything outside this build that could hold it up

The game is offline-first with no backend, so nothing should depend on another team, an API or an approval. Confirm that, or name what could block a Bolt and when.

A. Nothing external — the whole MVP is built and run on this machine
B. Something external — name it, who owns it, how long it takes, which Bolt it blocks, and what we do if it slips
X. Other (please specify)

[Answer]: A

## Q8. [Delivery] What worries you most about this build

The plan puts the thing you most fear early, so a wrong assumption is cheap. What is it?

A. Performance — 100 fish at 50 fps on a mid-range phone
B. Balance — reaching Level 3 in about 2 hours, and no single-species strategy dominating
C. Simulation correctness — determinism, save integrity, offline catch-up
D. Scope — the MVP growing while we build
X. Other (please specify)

[Answer]: A

## Q9. [Delivery] Resolve Bolt size — one per Unit or the proposed six

Q2 says one Bolt per Unit of Work (seven Bolts), but Q6 confirms the six-Bolt breakdown where Bolt 2 bundles the tank-and-water, fish-lifecycle and feeding units plus the money logic of commerce, and later Bolts also bundle. Both cannot hold — the plan needs one grouping.

A. Keep the six-Bolt breakdown from Q6 (bundled care loop, depth, breeding, commerce, finish)
B. Switch to strict one-Bolt-per-Unit (seven Bolts, each Unit alone)
X. Other (please specify)

[Answer]: A

## Q10. [Delivery] What parallel Bolts means for a solo serial build

Q3 chooses parallel Bolts where the graph permits, but the recorded construction setting is one Unit at a time, each verified before the next starts, which suits a solo build on one machine. Parallel here can only mean overlapping the plan on paper, or changing the build to run Units together.

A. Keep the build serial — parallel means the plan may overlap on paper only, the build stays one Unit at a time
B. Change the build to run Units together where the graph permits
X. Other (please specify)

[Answer]: B

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
