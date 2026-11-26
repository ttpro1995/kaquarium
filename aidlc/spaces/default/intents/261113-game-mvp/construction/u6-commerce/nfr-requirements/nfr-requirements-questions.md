# NFR Requirements — Questions (u6-commerce)

> Unit U6 owns Market, Orders, Progression, Economy, Notifications: price formula, demand/trend, order board, XP/levels, operating costs, notification mapper + queue. Inception NFRs: NFR1 (100-fish ≥ 50 fps), NFR2 (WCAG AA — bell/panels rendered by U7, queue owned by U6), NFR3 (seeded determinism), NFR4 (versioned saves + migrations), NFR5 (TDD, 80% line floor, CI).

## Q1. [Model] Commerce/notify phase budget (NFR1)

Frame split so far: water 4 + fish 2 + feeding 1 + breeding 0.5 = 7.5 of the ≤ 8 ms/frame total at x4. Commerce does price-cache refresh over fish, demand/trend updates over species, and day-boundary upkeep.

A. Commerce + notify ≤ 0.125 ms/tick (≤ 0.5 ms/frame worst case); the full-tick p95 ≤ 8 ms gate holds the 4 + 2 + 1 + 0.5 + 0.5 = 8 ms sum
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Market/order determinism (NFR3)

Trend re-rolls, order generation (species/customer/deadline draws), and reward math draw only through `ctx.rng` in stable iteration order (species catalogue order, then board order); replay reproduces every price, trend, and order.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q3. [Model] Save migration for commerce state (NFR4)

Built types predate U6: `MarketState` lacks `lastTrendDay`; `Order` lacks `customer/multiplier/minHealth/minSizeCm/deadlineDay`; `Notification.subjectId` is required, not optional. The v1 → v2 migration fills all of them (register rows amended; no load-defaulting path).

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q4. [Model] Tech stack for U6 (tech-stack-decisions)

TypeScript strict, Vitest + 80% line floor in CI, ESLint per repo config (no formatter configured in this repo); no new dependencies — pure logic over U1 types + `ctx.rng` + catalogue reads.

A. Confirm as stated
B. Tune — say how
X. Other (please specify)

[Answer]: A
