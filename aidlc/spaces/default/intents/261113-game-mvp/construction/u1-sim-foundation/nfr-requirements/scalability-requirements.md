# Scalability Requirements — u1-sim-foundation

> Upstream: `functional-spec.md` (W2, W6), `requirements.md` (NFR1 design point: 100-fish save). The MVP is a single-device offline sim with fixed scope (one tank); there is no multi-user load, no data partitioning, and no scaling trigger in this unit.

| ID | Requirement | Target | Verdict |
|---|---|---|---|
| NFR1.3 | Tick cost grows at most linearly with live-fish count up to the MVP cap, so the NFR1.1 budget holds across the playable range. | 1-, 10-, 50-, 100-fish benchmark points under the NFR1.1 protocol; least-squares fit with R² ≥ 0.90 and the 100-fish point ≤ 8 ms | Headless benchmark curve recorded at the Bolt 1 checkpoint |

No horizontal/vertical scaling surface exists in U1: one store, one tick loop, one device. Capacity planning beyond the 100-fish cap is post-MVP work and needs no requirement here.
