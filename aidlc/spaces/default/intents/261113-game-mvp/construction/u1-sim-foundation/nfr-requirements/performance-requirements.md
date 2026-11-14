# Performance Requirements — u1-sim-foundation

> Upstream: `functional-spec.md` (W2 fixed tick, BR1.1), `rules.md` (BR1.1, BR2.1), `requirements.md` (NFR1: 100-fish save ≥ 50 fps on Meizu Lucky 08), `contract-summary.md` (C2 tick pipeline). Answers from `nfr-requirements-questions.md` (Q1-B, summary `Looks correct`).

| ID | Requirement | Target | Verdict |
|---|---|---|---|
| NFR1.1 | One 100-fish simulation tick completes within budget on the reference device. | ≤ 8 ms, p95 over 300 timed ticks after 50 warmup ticks, production build, Meizu Lucky 08, headless (no rendering), screen on, no debugger attached | Headless tick benchmark; device gate at Bolt 1 and Bolt 5 checkpoints |
| NFR1.2 | The tick benchmark runs as a regression check so tick cost cannot creep silently. | Headless 100-fish benchmark using the NFR1.1 protocol runs in CI (timing informational on CI runners) and as a device gate (≤ 8 ms) at the Bolt 1 and Bolt 5 checkpoints | Benchmark exists from Bolt 1; device gate recorded at checkpoints |
| NFR1.4 | The autosave path (serialize + digest + write + read-back verify) never causes visible jank. | ≤ 50 ms wall time on the reference device for a 100-fish save, measured with the NFR1.1 device conditions | Autosave latency probe at the Bolt 1 checkpoint |

Notes: NFR1's full proof (rendered scene ≥ 50 fps) belongs to U7; U1 owns the sim-side share only. Tick cost scales with live-fish count; the 100-fish design point is the MVP cap (see `scalability-requirements.md`).
