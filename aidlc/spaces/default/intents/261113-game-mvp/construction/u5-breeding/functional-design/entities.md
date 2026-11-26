# Entities — u5-breeding

> Upstream: `unit-of-work.md` (U5 owns FryCohort behaviour), `components.md` (Breeding), `contract-summary.md` (C1 FryCohort cross-boundary fields, C4 breedingStarted/fryHatched/cohortGraded), `stories.md` (US5.1–US5.3), `requirements.md` (FR5.1–FR5.3), U3 design (spawnFish, inheritGenome, Fish field rules, projectedBioload requirement), U4 design (feedFry, firstFoodDays/lastFryFedDay). Answers from `functional-design-questions.md` (Q1–Q6, summary `Looks correct`).
> Full declarations live here for `FryCohort` and the U5-owned `BreedingPair`. The developer codes the types from U1's `packages/u1-sim-foundation/src/types.ts` (single shared definition); this file is the behavioural spec. `firstFoodDays`/`lastFryFedDay: integer` types are fixed here for U4's writer.

```yaml
entities:
  - name: FryCohort
    owner: u5-breeding
    description: Eggs or fry tracked as one unit until juvenile grading.
    attributes:
      - { name: id, type: CohortId, required: true }
      - { name: speciesId, type: SpeciesId, required: true }
      - { name: tankId, type: TankId, required: true }
      - { name: bornDay, type: integer, required: true, min: 1, note: "game day of laying/birth" }
      - { name: count, type: integer, required: true, min: 0, note: "surviving number; cohort removed at 0" }
      - { name: ageDays, type: number, required: true, min: 0, note: "since bornDay (laying) through both stages; grading at juvenileDays measures since laying" }
      - { name: genomePool, type: "{ sire: Genome, dam: Genome }", required: true, note: "parents' genomes; offspring rolled per fish at grading via inheritGenome" }
      - { name: survivalFactor, type: number, required: false, note: "last computed daily keep, diagnostic for panels" }
      - { name: stage, type: string, required: true, allowed: [eggs, fry], note: "eggs don't eat and don't decay; fry do both" }
      - { name: hatchDay, type: integer, required: false, note: "set for eggs; fry stage begins at hatchDay" }
      - { name: firstFoodDays, type: integer, required: true, min: 0, note: "distinct game days with ≥1 fry feeding; written by U4 feedFry (types fixed here)" }
      - { name: lastFryFedDay, type: integer, required: true, min: 0, note: "0 = never; day idempotency key (types fixed here)" }
    constraints:
      - "eggs carry no feeding state; firstFoodDays accrues only in fry stage"

  - name: BreedingPair
    owner: u5-breeding
    description: Player-formed pair bond; all pregnancy/cooldown state lives here, never on Fish. STORE HOME: U1 data completion — `GameState.pairs: Record<PairId, BreedingPair>` with save/load round-trip and migration coverage; the type and collection land in U1's types with U5's implementation via the v1 → v2 migration (pre-U5 saves gain pairs = {} from the migration, not from a load-time default — U5 NFR4.1).
    attributes:
      - { name: id, type: PairId, required: true }
      - { name: femaleId, type: FishId, required: true }
      - { name: maleId, type: FishId, required: true }
      - { name: speciesId, type: SpeciesId, required: true }
      - { name: state, type: string, required: true, allowed: [paired, gravid, cooling] }
      - { name: readyDay, type: integer, required: true, note: "birth due (gravid) or cooldown end (cooling); attempts run while paired" }
    constraints:
      - "one live pair per female; pairing an already-paired female replaces the bond"
      - "pairs dissolve silently when a member is sold, dies, or grades away — no event"
```

## Summary

U5 fully declares `FryCohort` (eggs-or-fry stage, count/age, parent genome pool, first-food counters with fixed integer types) and the U5-owned `BreedingPair` (pregnancy and cooldown live here so Fish stays untouched). Grading creates Fish records per U3's field rules with `parents` set and the `stunted` flag from the first-food test (U3 data completion: `Fish.stunted` + growth-formula factor).
