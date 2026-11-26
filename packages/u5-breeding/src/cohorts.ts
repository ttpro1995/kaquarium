// cohorts — U5 FryCohort data model (BR14.3, BR14.4, BR15.2).
// Eggs-or-fry cohorts tracked as one unit until juvenile grading. Pure
// factories over U1's shared FryCohort shape plus the seeded clutch and
// fertility draws. Breeding parameters resolve per species with validated
// fallbacks, so the catalogue grows them additively without U1 changes.
import type { FryCohort, Species } from '@aquarium/u1-sim-foundation/state';
import type { Rng } from '@aquarium/u1-sim-foundation';

/** Per-species breeding parameters (U1 data completion, read additively). */
export interface BreedingParams {
  clutchMin: number;
  clutchMax: number;
  gestationDays: number;
  hatchDays: number;
  cycleDays: number;
  speciesBaseRate: number;
}

/** Defaults when the catalogue carries no breeding row (≈0.3/day base). */
export const DEFAULT_BREEDING_PARAMS: BreedingParams = {
  clutchMin: 10,
  clutchMax: 30,
  gestationDays: 7,
  hatchDays: 3,
  cycleDays: 3,
  speciesBaseRate: 0.3,
};

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Resolve the breeding row for a species: known catalogue extras win per
 * field, anything missing or malformed falls back to the default (never
 * throws — an unknown species simply breeds on defaults once paired).
 */
export function breedingParamsFor(species: Species | undefined): BreedingParams {
  const extra = (species ?? {}) as unknown as Record<string, unknown>;
  const clutch = extra.clutch;
  let clutchMin = DEFAULT_BREEDING_PARAMS.clutchMin;
  let clutchMax = DEFAULT_BREEDING_PARAMS.clutchMax;
  if (
    Array.isArray(clutch) &&
    isInt(clutch[0]) &&
    isInt(clutch[1]) &&
    (clutch[0] as number) >= 1 &&
    (clutch[1] as number) >= (clutch[0] as number)
  ) {
    clutchMin = clutch[0] as number;
    clutchMax = clutch[1] as number;
  }
  const day = (field: string, fallback: number): number => {
    const value = extra[field];
    return isInt(value) && (value as number) >= 1 ? (value as number) : fallback;
  };
  const rate = extra.speciesBaseRate;
  const speciesBaseRate =
    typeof rate === 'number' && Number.isFinite(rate) && rate > 0
      ? rate
      : DEFAULT_BREEDING_PARAMS.speciesBaseRate;
  return {
    clutchMin,
    clutchMax,
    gestationDays: day('gestationDays', DEFAULT_BREEDING_PARAMS.gestationDays),
    hatchDays: day('hatchDays', DEFAULT_BREEDING_PARAMS.hatchDays),
    cycleDays: day('cycleDays', DEFAULT_BREEDING_PARAMS.cycleDays),
    speciesBaseRate,
  };
}

/** Fresh cohort id from the seeded stream (same hex pattern as U3/U4 ids). */
export function nextCohortId(rng: Rng): string {
  return `cohort-${rng.nextInt(0, 0xffffffff).toString(16).padStart(8, '0')}`;
}

/** Seeded uniform clutch draw in [clutchMin, clutchMax] (BR14.3). */
export function drawClutch(rng: Rng, params: BreedingParams): number {
  return rng.nextInt(params.clutchMin, params.clutchMax);
}

/** Fertility roll for egg-layers: uniform in 0.6–0.9 (BR14.4). */
export function rollFertility(rng: Rng): number {
  return 0.6 + rng.next() * 0.3;
}

/**
 * Livebearer brood scale (BR14.3): seeded clutch × mother-size × condition,
 * clamped to the catalogue range.
 */
export function scaledBroodCount(args: {
  clutch0: number;
  motherSizeCm: number;
  adultSizeCm: number;
  condition: number;
  params: BreedingParams;
}): number {
  const { clutch0, motherSizeCm, adultSizeCm, condition, params } = args;
  const sizeFrac = adultSizeCm > 0 ? motherSizeCm / adultSizeCm : 1;
  const count = Math.round(clutch0 * (0.5 + sizeFrac * 0.5) * (0.5 + condition * 0.5));
  return Math.min(params.clutchMax, Math.max(params.clutchMin, count));
}

/** Egg-layer clutch (BR14.4): seeded clutch × fertility × condition. */
export function eggClutchCount(clutch0: number, fertility: number, condition: number): number {
  return Math.max(0, Math.round(clutch0 * fertility * (0.5 + condition * 0.5)));
}

/**
 * The permanent stunt test (BR15.2): fewer fed days than half the juvenile
 * window stunts every fish graded from this cohort.
 */
export function stuntedAtGrading(
  cohort: Pick<FryCohort, 'firstFoodDays'>,
  juvenileDays: number,
): boolean {
  return cohort.firstFoodDays < juvenileDays / 2;
}

export interface CohortSeed {
  id: string;
  speciesId: string;
  tankId: string;
  bornDay: number;
  count: number;
  sireGenome: Record<string, unknown>;
  damGenome: Record<string, unknown>;
  sireId: string;
  damId: string;
}

/**
 * genomePool carries the parents' genomes (U3 inheritGenome input) plus the
 * sire/dam ids, so grading sets Fish.parents even after the pair dissolves
 * (BR15.4) — all inside U1's free-form Record<string, unknown> slot.
 */
function genomePoolOf(seed: CohortSeed): Record<string, unknown> {
  return { sire: seed.sireGenome, dam: seed.damGenome, sireId: seed.sireId, damId: seed.damId };
}

/** Fry-stage cohort at birth (BR14.3): counters zeroed, survival starts at 1. */
export function makeFryCohort(seed: CohortSeed): FryCohort {
  return {
    id: seed.id,
    speciesId: seed.speciesId,
    tankId: seed.tankId,
    bornDay: seed.bornDay,
    count: seed.count,
    ageDays: 0,
    genomePool: genomePoolOf(seed),
    survivalFactor: 1,
    stage: 'fry',
    firstFoodDays: 0,
    lastFryFedDay: 0,
  };
}

/** Eggs-stage cohort at laying (BR14.4): hatches at hatchDay, never decays. */
export function makeEggsCohort(seed: CohortSeed & { hatchDay: number }): FryCohort {
  return {
    id: seed.id,
    speciesId: seed.speciesId,
    tankId: seed.tankId,
    bornDay: seed.bornDay,
    count: seed.count,
    ageDays: 0,
    genomePool: genomePoolOf(seed),
    survivalFactor: 1,
    stage: 'eggs',
    hatchDay: seed.hatchDay,
    firstFoodDays: 0,
    lastFryFedDay: 0,
  };
}
