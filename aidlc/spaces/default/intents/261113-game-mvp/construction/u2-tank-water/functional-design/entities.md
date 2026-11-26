# Entities — u2-tank-water

> Upstream: `unit-of-work.md` (U2 owns Tank behaviour), `components.md` (TankEnvironment), `contract-summary.md` (C1 Tank cross-boundary fields, C5 catalogue), `stories.md` (US1.2, US1.3), `requirements.md` (FR1.2, FR1.3). Answers from `functional-design-questions.md` (Q1–Q6, summary `Looks correct`).
> U1's `entities.md` declares the kernel types; cross-unit full declarations live here for `Tank` and its sub-objects. U1's implemented `Tank` shape must match this file — superseded note: the built `types.ts` predates U2 by more than one additive field (water chemistry, equipment structure, tier volumes, latches), so alignment is the explicit breaking change registered in `construction/u2-tank-water/nfr-requirements/tech-stack-decisions.md` (schemaVersion 1 → 2 with migration), executed at U2 codegen. The old "U1 adds the field when U2 lands, additive and safe" expectation no longer holds.

```yaml
entities:
  - name: Tank
    owner: u2-tank-water
    description: The single MVP tank; tier, volume, water chemistry, equipment, and derived load.
    attributes:
      - { name: id, type: TankId, required: true }
      - { name: tier, type: integer, required: true, min: 1, max: 3 }
      - { name: volumeL, type: number, required: true, note: "20 / 60 / 150 by tier 1 / 2 / 3; set only by tank.upgradeTier" }
      - { name: water, type: WaterChemistry, required: true }
      - { name: equipment, type: Equipment, required: true }
      - { name: bioload, type: number, required: true, min: 0, note: "cached load recomputed every water tick (BR8.6); never written by U4–U6" }
      - { name: biofilterMaturity, type: number, required: true, min: 0, max: 1, note: "0 new, 1 cycled; resets to 0 when the filter level changes (BR8.3)" }
      - { name: prevQualityBand, type: string, required: true, allowed: [good, fair, poor], note: "edge-trigger for fishSick; updated to the current band every tick, initial good; absent on old saves derives from current numbers (BR8.6)" }
      - { name: overcrowdLatch, type: boolean, required: true, note: "true while a tankOvercrowded episode is open; absent on old saves derives as bioload > volumeL (BR8.6)" }
      - { name: tempPoorLatch, type: boolean, required: true, note: "true while a temperature-stress episode is open; absent on old saves derives as any fish tempFit < 0.5 (BR8.5)" }
    constraints:
      - "tier 1 / 2 / 3 implies volumeL 20 / 60 / 150; any other pairing fails validation on load"
    relationships:
      - { to: Fish, cardinality: "1:N", direction: contains, note: "membership is Fish.tankId (U1 Q2-B); capacity is a scan, never a list" }
      - { to: FryCohort, cardinality: "1:N", direction: contains, note: "cohorts contribute nursery bioload (BR8.6)" }

  - name: WaterChemistry
    owner: u2-tank-water
    description: Simplified nitrogen cycle plus temperature (Q1-A; pH and oxygen deferred post-MVP).
    attributes:
      - { name: waste, type: number, required: true, min: 0, max: 100, note: "from bioload and feeding (BR8.1); lowered by filter and water changes" }
      - { name: nitrate, type: number, required: true, min: 0, max: 100, note: "rises as the filter converts waste; only water changes remove it (BR8.2)" }
      - { name: tempC, type: number, required: true, min: 10, max: 35, note: "heater holds 26; otherwise drifts toward ambient 22 (BR8.5)" }

  - name: Equipment
    owner: u2-tank-water
    description: Installed gear. Filter drives conversion, heater drives temperature, light is renderer-fed (no sim effect in the MVP), autoFeeder device is U4-programmed (W18).
    attributes:
      - { name: filter, type: FilterSpec, required: true }
      - { name: heater, type: HeaterSpec, required: true }
      - { name: autoFeeder, type: AutoFeederDevice, required: true, note: "U4 data completion: installed flag for the auto-feeder device (W18)" }
      - { name: light, type: LightSpec, required: true }

  - name: FilterSpec
    owner: u2-tank-water
    description: Conversion capacity scales with level; effective rate is capacity × maturity (BR8.2).
    attributes:
      - { name: level, type: integer, required: true, min: 1, max: 3, note: "1 Basic (starter), 2 Hang-on-back, 3 Canister" }
      - { name: conversionRate, type: number, required: true, min: 0, note: "waste units converted per tick at maturity 1; 2 / 5 / 9 by level" }

  - name: HeaterSpec
    owner: u2-tank-water
    description: Tropical species need warm water (AC1.3.2).
    attributes:
      - { name: installed, type: boolean, required: true }

  - name: AutoFeederDevice
    owner: u2-tank-water
    description: Installed auto-feeder device; the program itself is U4's FeedingSchedule (W18).
    attributes:
      - { name: installed, type: boolean, required: true }

  - name: LightSpec
    owner: u2-tank-water
    description: Lighting tier; consumed by U7's renderer for the day/night blend. No simulation effect in the MVP.
    attributes:
      - { name: level, type: integer, required: true, min: 1, max: 3, note: "1 Basic LED (starter), 2 Aquatic LED, 3 RGB decorative" }

  - name: SpeciesTempNeed
    owner: u1-sim-foundation
    description: Additive catalogue data U2 reads (Q6-A; U1 data completion, safe additive field per C5).
    attributes:
      - { name: tempRangeC, type: "[number, number]", required: false, note: "optional [min, max]; absent means tolerant 20–28" }
```

## Summary

U2 fully declares `Tank` (tier/volume, `WaterChemistry` waste + nitrate + temperature, `Equipment` filter/heater/light, cached `bioload`, `biofilterMaturity`, and the deterministic episode latches `prevQualityBand` / `overcrowdLatch` / `tempPoorLatch`) plus the `tempRangeC` catalogue need it reads from U1's species data. Fish and cohorts stay referenced by `tankId`; U2 never redefines them. The developer codes the `Tank` type from U1's `packages/u1-sim-foundation/src/types.ts` (the single shared definition per unit-of-work.md); this file is the behavioural spec that definition must satisfy. Load rule for pre-U2 saves: absent latch fields derive deterministically from current numbers (band from max(waste, nitrate); latches from the episode conditions below), so old saves behave identically to fresh ones at equal numbers.
