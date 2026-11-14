# Observability Requirements — u1-sim-foundation

> Upstream: `functional-spec.md` (C4 drain, W6 summary), `contract-summary.md` (C4 event buffer + drain). The MVP is a single-user offline app: no metrics pipeline, no dashboards, no alerting thresholds in this unit. Observability is the event/notification surface the game itself renders.

| ID | Requirement | Target | Verdict |
|---|---|---|---|
| NFR4.6 | Every state change through a tick or command drain is observable exactly once: one batch per tick and per command, delivered to all subscribers. Load and import replacement happen outside any drain and emit no events; U7 re-reads state after either. | Drain order mapper → deliver → clear; a throwing subscriber never stops delivery to the others | Drain-order and isolation tests |
| NFR4.7 | The offline catch-up produces one aggregated `whileYouWereAway` summary (elapsed days, hatched, matured, died of old age, expired orders) for the U7 summary view. | Summary present after every catch-up advance, including zero-elapsed returns | Catch-up summary tests |

No SLI/SLO, log-retention, or tracing requirement applies to U1: player-visible notifications are specified per unit (U6 mapper, U7 bell) and the kernel keeps no telemetry store.
