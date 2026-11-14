# Logical Components — u1-sim-foundation

> Upstream: `functional-spec.md`, `rules.md`, `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `contract-summary.md` (C1–C6). Bridges NFR design decisions with Infrastructure Design: where each NFR pattern lives.

```yaml
components:
  - name: Store
    responsibility: Single GameState container; read-only selectors; version counter; dirty flag.
    nfr: NFR4.6 (drain-scoped observability); NFR3.1 (replay input)
    failure_domain: kernel
  - name: TickPipeline
    responsibility: Phase-ordered tick runner (feeding → water → fish → breeding → commerce → notify); halt on system throw.
    nfr: NFR1.1, NFR1.2, NFR1.3 (tick budget + benchmark); NFR4.2 (halt containment)
    failure_domain: kernel
  - name: Rng
    responsibility: Single seeded stream; boot-time seed mirror; cursor advance per draw.
    nfr: NFR3.1, NFR3.2
    failure_domain: kernel
  - name: CommandBus
    responsibility: Handler resolution; validate-then-mutate; UNKNOWN_COMMAND for undeclared types; drain-then-bump-then-dirty.
    nfr: NFR4.6 (command drains)
    failure_domain: kernel
  - name: EventDrain
    responsibility: Single buffer for tick and command paths; mapper → deliver → clear; subscriber isolation.
    nfr: NFR4.6
    failure_domain: kernel
  - name: Registry
    responsibility: System/command/mapper registration; phase sort; dev-boot duplicate detection; exhaustiveness test gate.
    nfr: NFR3.1 (identical order everywhere)
    failure_domain: kernel
  - name: SpeciesCatalog
    responsibility: Content loading + validation (fail build/dev-boot, exclude-and-log in prod).
    nfr: NFR4.2 graceful degradation
    failure_domain: content
  - name: Persistence
    responsibility: Slots (3 auto rotating + unbounded named), save/load, JSON export/import, SHA-256 digest utility over the pinned canonicalJson form, import pipeline (parse → shape+clock-invariant → version → checksum → migrate → rollback).
    nfr: NFR4.1, NFR4.3, NFR4.4, NFR4.5, NFR1.4
    failure_domain: storage
  - name: FaultDescriptor
    responsibility: Memory-only fault record { tick, systemId, message } exposed via getFault(); polled by U7; never persisted.
    nfr: NFR4.2
    failure_domain: kernel
  - name: BenchmarkHarness
    responsibility: Test-only headless tick/scale/autosave probes under the NFR1.1 protocol; not shipped.
    nfr: NFR1.1, NFR1.2, NFR1.3, NFR1.4
    failure_domain: test-only
```

## Boundaries and blast radius

- **Kernel failure domain** (Store, TickPipeline, Rng, CommandBus, EventDrain, Registry, FaultDescriptor): a throw halts the loop and discards memory state; recovery is always reload-last-autosave. No partial degradation — deterministic halt beats limping on.
- **Storage failure domain** (Persistence): write failures retry once, fall back to localStorage, then disable autosave with a warning; reads never mutate the active save until every import check passes.
- **Content failure domain** (SpeciesCatalog): invalid entries degrade (exclude + log), never crash.
- **Shared resources**: the single RNG stream and the single event buffer — both owned by U1, both synchronous, neither shared across tabs (one game instance per tab; concurrent-tab behavior is out of MVP scope).
- **Test-only** (BenchmarkHarness): ships no code to players; gates the Bolt 1 and Bolt 5 checkpoints.
