# Infrastructure Design — Questions (u7-presentation)

> Unit U7 is the `ui`-kind composition root: it owns the Vite build, the PWA shell, artifact retention/hosting, and the monitoring story. Produces: infrastructure-specification.md, monitoring-design.md, cicd-pipeline.md, traceability.json. This pass answers every deferred U7 codegen input from the sim units.

## Q1. [Model] Build and artifact (NFR1.x, NFR5.1)

Vite build (`tsc && vite build`) producing one versioned static artifact per commit SHA; `vite.config.ts` + `index.html` land at U7 codegen with the pinned deps (`pixi.js@^8.23.0`, `svelte@^5.59.1`, `vite-plugin-pwa@^2.0.0`); axe-core + keyboard walkthrough + snapshots in CI.

A. As stated: single versioned static artifact; codegen adds config + entry
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q2. [Model] Hosting, retention, rollback (team Deployment practice)

Static hosting with artifact retention (last N builds, N = 10); staging auto-deploys on merge, production promotes the same bytes on manual approval; rollback = redeploy the previous retained artifact (rebuild from tag only if retention is exhausted).

A. As stated
B. Tune — say how
X. Other (please specify)

[Answer]: A

## Q3. [Model] Monitoring (NFR2.1, NFR1.x, NFR5.1)

No backend APM (no servers): monitoring = CI gates (axe, coverage, benchmarks, snapshots) + in-app fault panel (tick abort → reload to last autosave) + version-bump health (soak Δversion assertions). No log aggregation, no tracing infra, no dashboards — the loading indicator and fault panel are the runtime surface.

A. Confirm: CI gates + in-app fault/loading surface; no backend observability stack
B. Tune — say how
X. Other (please specify)

[Answer]: A
