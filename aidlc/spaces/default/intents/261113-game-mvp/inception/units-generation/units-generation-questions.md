# Units Generation — Questions

## Q1. [Architecture] Unit boundary strategy

How should the 14 components be grouped into units of work?

A. By domain — group related components (sim foundation, tank/water, fish, breeding, commerce, presentation)
B. By component — one unit per component (14 units)
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q2. [Architecture] Unit granularity

How coarse or fine should the units be?

A. Coarse — ~6–7 units, each grouping 1–3 related components
B. Fine — one unit per component
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q3. [Architecture] Dependency ordering

How should unit dependencies be treated?

A. A strict dependency DAG (a unit builds only on the units it depends on); independent units may build in parallel
B. A flat list — everything builds together
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q4. [Architecture] Deployment model

How are the units deployed?

A. Monolithic — one browser app; units are implementation boundaries, not separate deployables
B. Independent deployment per unit
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q5. [Architecture] Integration between units

How do units integrate?

A. A single shared state store (the source of truth) with a command pattern and a typed event bus
B. Explicit APIs/contracts between each pair of units
C. Not yet defined
X. Other (please specify)

[Answer]: A

---

## Consolidated Summary Confirmation

- Grouping: by domain — sim foundation, tank/water, fish, breeding, commerce, presentation (Q1)
- Granularity: coarse — ~6–7 units, each grouping 1–3 components (Q2)
- Dependencies: a strict DAG; independent units may build in parallel (Q3)
- Deployment: monolithic browser app — units are implementation boundaries (Q4)
- Integration: a single shared state store + command pattern + typed event bus (Q5)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
