// selectors — U3-owned pure readers (BR11.3). Other units read fish
// through these instead of reaching into state; U7 tooltips name the
// limiting factor from growthCondition before any U2 episode opens,
// and U6 prices from genomeQuality plus the colour/rarity factors.
// Nothing here mutates; every function is safe to call mid-tick.
import type { Fish, GameState, Species } from '@aquarium/u1-sim-foundation/state';
import { tempFitFor, waterQuality } from '@aquarium/u2-tank-water';
import type { Genome, GenomeLocus } from './factories.js';
import { GENOME_LOCI } from './factories.js';

/** Below this health the fish reads sick (U6 unsellable, U5 gate). */
export const SICK_BELOW = 40;

/** Below this health the fish reads critical. */
export const CRITICAL_BELOW = 15;

export type HealthBand = 'healthy' | 'sick' | 'critical';

/** Pure band of a health number (entities.md constraints). */
export function healthBand(health: number): HealthBand {
  if (health < CRITICAL_BELOW) return 'critical';
  if (health < SICK_BELOW) return 'sick';
  return 'healthy';
}

/** Health of one fish, or undefined when the id is unknown. */
export function healthOf(state: GameState, id: string): number | undefined {
  return state.fish[id]?.health;
}

/**
 * Shared overcrowding predicate (W12): bioload past the tier volume.
 * U2's water phase refreshes the cached bioload before the fish phase
 * runs, so this reads the current tick's number.
 */
export function overcrowded(state: GameState): boolean {
  return state.tank.bioload > state.tank.volumeL;
}

/** Growth crowd multiplier (BR10.1): halves growth while overcrowded. */
export function crowdFactor(state: GameState): 1 | 0.5 {
  return overcrowded(state) ? 0.5 : 1;
}

/**
 * The W12 growth-condition product (BR10.1), shared with U7 tooltips:
 * (satiety/100) x (waterQuality/100) x tempFit x crowdFactor.
 * Zero while starving, so growth stalls (Q1-A). The species entry is
 * optional: unknown species resolve tempFit against the tolerant
 * default, matching U2's fallback.
 */
export function growthCondition(state: GameState, fish: Fish, species?: Species | undefined): number {
  return (
    (fish.satiety / 100) * (waterQuality(state) / 100) * tempFitFor(state, species) * crowdFactor(state)
  );
}

/** Allele sum 0..2 for one locus; drives every phenotype mapping. */
export function alleleSum(genome: Genome, locus: GenomeLocus): 0 | 1 | 2 {
  // Tolerant read: fixtures and foreign writers may carry a partial
  // genome; a missing locus contributes 0 instead of crashing the tick.
  const pair = (genome as Partial<Record<GenomeLocus, unknown>>)[locus];
  if (!Array.isArray(pair)) return 0;
  let sum = 0;
  for (const allele of pair as unknown[]) {
    if (allele === 1) sum++;
  }
  return Math.min(2, sum) as 0 | 1 | 2;
}

/** Adult-size multiplier from the size locus (W15). */
export function sizeMultiplier(genome: Genome): 0.95 | 1 | 1.05 {
  const sum = alleleSum(genome, 'size');
  if (sum === 0) return 0.95;
  if (sum === 1) return 1;
  return 1.05;
}

/** Regen bonus from the vigor locus (W15, BR10.3). */
export function vigorBonus(genome: Genome): 0 | 0.5 | 1 {
  const sum = alleleSum(genome, 'vigor');
  if (sum === 0) return 0;
  if (sum === 1) return 0.5;
  return 1;
}

/**
 * Premium-allele count / 10 (W15): U6's genetics price input.
 * A premium allele is a 1; ten loci slots total across five loci.
 */
export function genomeQuality(genome: Genome): number {
  let premium = 0;
  for (const locus of GENOME_LOCI) premium += alleleSum(genome, locus);
  return premium / 10;
}

/**
 * Colour price input (W15): the hue sum lifts the base. U6 owns the
 * final price formula; this is the documented U3-provided factor.
 */
export function colourFactor(genome: Genome): number {
  return 1 + 0.15 * alleleSum(genome, 'hue');
}

/**
 * Rarity price input (W15): pattern + tail presence lifts the base.
 * U6 owns the final price formula; this is the documented factor.
 */
export function rarityFactor(genome: Genome): number {
  return 1 + 0.25 * (alleleSum(genome, 'pattern') + alleleSum(genome, 'tail'));
}
