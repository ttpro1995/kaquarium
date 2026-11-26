# Entities — u3-fish

> Upstream: `unit-of-work.md` (U3 owns Fish behaviour), `components.md` (FishPopulation), `contract-summary.md` (C1 Fish cross-boundary fields, C2–C4), `stories.md` (US2.1, US2.2, US4.1–US4.3, US11.1), `requirements.md` (FR2.2, FR4.1–FR4.3), U2 `entities.md`/`rules.md`/`functional-spec.md` (waterQuality, tempFitFor, projectedBioload, episode causes). Answers from `functional-design-questions.md` (Q1–Q7, summary `Looks correct`).
> U1's `entities.md` declares the kernel types; cross-unit full declarations live here for `Fish` and its sub-objects. The developer codes the `Fish` type from U1's `packages/u1-sim-foundation/src/types.ts` (the single shared definition); this file is the behavioural spec that definition must satisfy. Load rule for pre-U3 saves: absent `parents` derive as null; absent `mature` derives from `stage` (true for adult/senior, false for juvenile) — never a blanket false, which would break the mature-mirrors-stage invariant on first load.

```yaml
entities:
  - name: Fish
    owner: u3-fish
    description: One individual fish; the unit of care, sale, and breeding.
    attributes:
      - { name: id, type: FishId, required: true }
      - { name: speciesId, type: SpeciesId, required: true }
      - { name: tankId, type: TankId, required: true, note: "authoritative membership (U1 Q2-B); the single MVP tank" }
      - { name: sex, type: string, required: true, allowed: [male, female], note: "50/50 via seeded RNG at spawn (FR2.2)" }
      - { name: stage, type: string, required: true, allowed: [juvenile, adult, senior] }
      - { name: ageDays, type: number, required: true, min: 0, note: "game days since birth; old-age death at lifespanDays" }
      - { name: sizeCm, type: number, required: true, min: 0, note: "saturating growth toward adultSizeCm (BR10.1)" }
      - { name: health, type: number, required: true, min: 0, max: 100, note: "regen minus stressors; 0 is death (BR10.3–BR10.4)" }
      - { name: satiety, type: number, required: true, min: 0, max: 100, note: "decays per tick; restored only by U4 feeding (BR10.2, BR11.3)" }
      - { name: stress, type: number, required: true, min: 0, max: 100, note: "display aggregate: 25 × largest active stressor magnitude, 0 when none" }
      - { name: genome, type: Genome, required: true }
      - { name: stunted, type: boolean, required: true, note: "U5 data completion: permanent first-food penalty; false default, spawnFish sets false, grading sets per BR15.2" }
      - { name: value, type: integer, required: true, min: 0, note: "$FISH cache; initial buyPrice at spawn, refreshed by U6's commerce system (BR11.3)" }
      - { name: mature, type: boolean, required: true, note: "true for adult/senior; false for juvenile" }
      - { name: parents, type: "[FishId, FishId]", required: false, note: "null for store-bought; set by U5 at birth from breeding" }
    constraints:
      - "stage matches age: juvenile below maturityDays, adult to 70% lifespanDays, senior after"
      - "sick means health < 40 — the line U6 enforces for unsellable and U5 for breeding gates"
    relationships:
      - { to: Species, cardinality: "N:1", direction: reads, note: "size, lifespan, maturity, diet, archetype" }
      - { to: Tank, cardinality: "N:1", direction: lives-in, note: "via tankId; reads waterQuality + tempFitFor" }

  - name: Genome
    owner: u3-fish
    description: Full MVP genome (Q7-B): five loci × two 0/1 alleles. Keys ratified against the GDD appendix (hue, pattern, tail, size, vigor). U5 mixes via inheritGenome; U6 prices via genomeQuality; U7 renders from hue/pattern/tail. No sixth species-specific locus in the MVP: exactly these five are carried and inherited; a species needing more is out of scope.
    attributes:
      - { name: hue, type: "[0|1, 0|1]", required: true, note: "colour intensity ceiling; U7 rendering + U6 colour factor" }
      - { name: pattern, type: "[0|1, 0|1]", required: true, note: "pattern presence; rendering + rarity" }
      - { name: tail, type: "[0|1, 0|1]", required: true, note: "fin/tail length; rendering" }
      - { name: size, type: "[0|1, 0|1]", required: true, note: "adult-size multiplier 0.95 / 1.0 / 1.05 by allele sum 0 / 1 / 2" }
      - { name: vigor, type: "[0|1, 0|1]", required: true, note: "allele sum adds +0 / +0.5 / +1 to health regen" }
```

## Summary

U3 fully declares `Fish` (identity, sex, stage/age/size, health/satiety/stress, full five-locus `Genome`, cached `value`, `mature`, optional `parents`) against U1's shared type. The genome representation plus the pure `spawnFish` and `inheritGenome` factories are U3's integration surface for U6 (buying, pricing) and U5 (breeding); `value` and `satiety` accept the two documented cross-unit writes (U6 refresh, U4 feeding).
