# Domain Design — Questions

## Q1. [Architecture] Component granularity

How fine-grained should the logical components be?

A. One component per simulation system — tank/environment, fish, species catalogue, breeding, feeding, market, orders, progression, economy, clock, persistence, notifications (12)
B. Fewer, grouped components (say how you'd group them)
C. Not yet defined
X. Other (please specify)

[Answer]:A

## Q2. [Architecture] Money and economy

Where should money and operating costs live?

A. A separate Economy component — money is cross-cutting (store, selling, orders, and daily costs all touch it)
B. Fold money into Market and Progression (no separate component)
C. Not yet defined
X. Other (please specify)

[Answer]:A

## Q3. [Architecture] Rendering and UI in the domain catalogue

Should the rendering and UI layers be domain components?

A. No — the domain catalogue covers the simulation core only; rendering and UI are separate layers (per the architecture doc)
B. Yes — include UI/rendering components
C. Not yet defined
X. Other (please specify)

[Answer]:B

---

## Consolidated Summary Confirmation

- Granularity: one component per simulation system — 12 core components (Q1)
- Economy: a separate Economy component (money is cross-cutting) (Q2)
- Rendering/UI: include as domain components (TankRenderer and UI, alongside the 12 simulation components) (Q3)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
