# Logical Components — u7-presentation

> Component-level view of where the NFR patterns apply; bridges to Infrastructure Design (Vite build + PWA packaging + CI gates).

```yaml
components:
  - name: TankCanvas
    owns: [sprite pool, steering/particle integration, tint lighting, reduced-motion freeze]
    failure_domain: render loop (rAF; outside ticks)
    blast_radius: "render faults never touch the store; FaultBoundary surfaces the fault panel; sim keeps ticking unless the tick itself threw"
    perf_budget: "≤ 12 ms/frame render-only; p95 frame ≤ 20 ms at x1 and x4"
  - name: Shell
    owns: [HUD, toolbar (8 tabs incl. Feeding + Settings), panels, bell, modals, backlog loading indicator, away summary]
    failure_domain: UI event handlers (dispatch only; never write the store)
    blast_radius: "a rejected command changes nothing (validate-first upstream); UI errors are local"
    perf_budget: "selector reads on version bumps only; no polling"
  - name: CompositionRoot
    owns: [store factory, register() wiring, event-bus subscriptions, boot validation, PWA shell]
    failure_domain: boot
    blast_radius: "boot failure fails loudly in dev, fault panel in production; invalid species excluded per C5"
    perf_budget: "not frame-bound; one-time cost"
  - name: RenderDeterminism
    owns: [local RNG seeding per mount (crypto.getRandomValues), no ctx.rng in renderer modules]
    failure_domain: none (visual-only)
    blast_radius: none
```

## Isolation strategy

- U7 never writes `GameState`; all intent flows through `dispatch`; SaveLoadApi called directly (never dispatched).
- Render state transient and unserialized; sim determinism independent of renderer on/off.
- PWA shell caches the artifact; no runtime server dependency.
