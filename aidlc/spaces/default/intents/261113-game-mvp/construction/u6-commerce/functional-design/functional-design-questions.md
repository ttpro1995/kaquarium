# Functional Design — Questions (u6-commerce)

> Unit U6 owns Market, Orders, Progression, Economy, Notifications: the money scalar, price formula, demand/saturation, order board, XP/levels/unlocks, and the notification mapper + queue. Implements US6.1–US6.3 (AC6.1.1–AC6.3.1), US7.1 (AC7.1.1–AC7.1.2), US8.1 (AC8.1.1–AC8.1.2), US12.1 (AC12.1.1); money side of US1.3/US2.1 (U2/U3 implement, U6 owns the scalar). Grounded in GDD §6.9–6.11 (price formula, saturation math, order rules, XP/levels) and FR6.1–FR8.1 + FR12.1. Rule groups BR16 (market/pricing/sales) + BR17 (orders) + BR18 (progression) + BR19 (notifications); U7 continues at BR20.

## Q1. [Model] Price formula factors (AC6.2.1, AC6.2.2)

GDD: Price = Base × Size × Age × Colour × Rarity × Health × Genetics × Market; <70% health reduces, sick unsellable.

A. sellBase × size(sizeCm/adult clamped 0.3–1.2) × age(juv 0.6/adult 1.0/senior 0.7) × colour(0.8–1.2 from hue locus) × rarity(1 + 0.1 × premium alleles) × health(1.0 ≥ 70, 0.7 at 40–69, unsellable < 40) × genetics(0.8 + 0.2 × genomeQuality) × market(0.4 + 1.1 × demand + 0.1 × trend, clamped 0.4–1.5)
B. Tune the bands — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Demand, saturation, trend (AC6.3.1)

GDD appendix: sale → demand × 0.97; recovery/day → demand += (1 − demand) × 0.08.

A. Exactly those numbers from demand 1.0; trend ∈ {−1,0,1} re-rolled per species every 3 game days via ctx.rng (weighted to 0); activeEvent stays null in the MVP (reserved)
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q3. [Model] Order board (AC7.1.1, AC7.1.2)

GDD: 3–6 active orders, deadline, min health/quality, reward multiplier above market, expiry costs reputation, completion raises it; customers hobbyist/pet shop/collector by level.

A. Day boundary: top up to 3, 25% chance to add while below 6; qty/health/multiplier by customer (hobbyist 1–2/40+/1.2, pet shop 3–6/50+/1.05, collector 1–2/70+/1.5, the last needs L3); reward = market value at fulfil × multiplier × (1 + min(rep,10) × 0.02); deadline 3–7 days; expiry → rep −2 (floor 0); fulfil → rep +1
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q4. [Model] XP, levels, unlocks (AC8.1.1, AC8.1.2)

GDD: XP from sales, breeding, orders; L1→L3 in ~2 h (playtest-validated); unlocks are species/equipment/customers.

A. XP = floor(price/5) per sale, +10 per fryHatched, +floor(reward/4) per order; L2 at 200, L3 at 600 (initial calibration, tuned in playtest for the 2 h target); species buyable iff tier ≤ level and egg-layers need L2+; equipment/customer unlocks per the GDD level table; unlocks accumulate in progression.unlocks
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q5. [Model] Operating costs (money sink)

GDD: daily electricity per tank scales with tier; money never negative (C1).

A. Midnight tick deducts tier electricity (5/12/25) via min(balance, cost) — shortfall ignored, no debt, no shutoff in the MVP
B. No operating costs in the MVP (simpler economy)
X. Other (please specify)

[Answer]: A

## Q6. [Model] Notification mapping and queue (AC12.1.1)

C4 fixes the event set; U6 owns the mapper and the queue. Mapper-per-event notifications could flood (100 fishSick); U2/U4 specs already require aggregation.

A. Mapper: fishDied→critical, fishSick/tankOvercrowded/orderExpired/foodOut→warn, everything else→info, moneyChanged→null; per-tick fishSick bursts collapse to one summary; queue cap 100 (drop oldest info first); `notifications.dismiss` command for U7; whileYouWereAway notified once by the notify system (mapper returns null for it)
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
