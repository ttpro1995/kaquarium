# Reliability Requirements — u1-sim-foundation

> Upstream: `functional-spec.md` (W1–W6), `rules.md` (BR1.1–BR1.3, BR2.1, BR4.1, BR6.1–BR6.4, BR7.1), `requirements.md` (NFR3 determinism, NFR4 save integrity), `contract-summary.md` (C2 tick, C6 slots/packaging).

| ID | Requirement | Target | Verdict |
|---|---|---|---|
| NFR3.1 | Same seed plus same ordered command sequence reproduces the same state, across live play, reload, and catch-up. | Replay test: fixed seed + scripted commands → byte-identical state digest | Golden-state replay test in CI |
| NFR3.2 | No ambient nondeterminism inside systems or handlers. | Banned: `Math.random`, `Date.now`, `performance.now`, `new Date()`, `crypto.getRandomValues`, `crypto.randomUUID`; all randomness flows through `ctx.rng`. Enforced by an ESLint `no-restricted-properties` + `no-restricted-globals` rule in the repo eslint config, with review as backstop | Lint config check + review check |
| NFR4.1 | A save the read-back cannot verify is never swapped to active; durability order is IndexedDB primary, localStorage fallback. | Write → read-back verify → swap; retry once → localStorage; failure warns and disables autosave until next success (Q2-A) | Fault-injection tests (failing store, corrupt payload) |
| NFR4.2 | The last successful autosave is always a valid recovery point: a tick that throws aborts without rolling back into a half-written state. | Containment: the tick loop halts (no further ticks queue), the half-mutated in-memory store is discarded, U7 surfaces the fault and offers reload-last-autosave; abort leaves the last autosave loadable | Abort-path test that resumes from the abort via reload |

Graceful degradation: production boot excludes invalid species entries (log + keep catalogue) instead of crashing (BR5.1). No SLA/SLO applies beyond these file-level guarantees — single-user offline app.
