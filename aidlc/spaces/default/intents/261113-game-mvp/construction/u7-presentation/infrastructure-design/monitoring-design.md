# Monitoring Design — u7-presentation

> Upstream: `nfr-requirements/performance-requirements.md` (NFR1.1–1.3 gates), `nfr-requirements/security-requirements.md` (NFR2.1, NFR5.1), `nfr-design/performance-design.md` (pipeline + soak mapping), `frontend-components.md` (bell, HUD, modals). Answers from `infrastructure-design-questions.md` (Q3 Confirm).
> No backend APM exists or is needed: monitoring = CI gates + in-app fault/loading surface.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| p95 frame time | benchmark + soak probes | ≤ 20 ms at x1 and x4 | 50 fps player-visible contract. |
| Render-only p95 | speed-0 probe | ≤ 12 ms | Isolates the render share of the frame. |
| Full-tick p95 | sim benchmark | ≤ 8 ms | Enforces the sim share (water 4 + fish 2 + feeding 1 + breeding 0.5 + commerce/notify 0.5). |
| Version delta | x4 soak | exactly 240 per 60 s, zero dropped ticks | Scheduler + drain integrity. |
| Axe violations | axe-core on shell DOM | zero serious/critical | WCAG AA gate. |
| Coverage | v8 report | 80% lines floor | TDD floor gate. |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| CI red on `main` | any blocking gate fails post-merge | critical | Team channel; fix-forward or revert before next merge. |
| `perf-regression` follow-up | any benchmark probe exceeds its NFR1.x cap | warn | Tracked issue; repeat failures escalate to blocking. |
| In-app fault panel | tick abort at runtime | critical (player-visible) | Reload to last autosave (no rollback by design). |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| Crash-free session | 100% of milestone playtest sessions with zero tick-abort fault panels | each playtest milestone (L3 run-through) |
| Save integrity | 100% of corrupt/unsupported/stale imports rejected with named errors, current save untouched | every CI run (import suite) + each playtest milestone |

## Logs & Tracing

No log aggregation, no distributed tracing, no dashboards — deliberately out of scope for a client-only bundle (nothing to aggregate to). Diagnostics surface: benchmark/soak probes in CI, the in-app fault panel + loading indicator at runtime, and the AI-DLC audit trail during development. Correlation needs do not arise (single-process sim + renderer).
