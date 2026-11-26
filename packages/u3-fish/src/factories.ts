// factories — U3 pure fish factories (BR11.1, W13, W15).
// spawnFish builds a store-bought juvenile; inheritGenome mixes parental
// genomes for U5. Both are pure: they mutate nothing, emit nothing, and
// draw all randomness from the passed rng (BR3.1/NFR3.1). The caller owns
// insertion and events (U6's buyFish handler, U5's birth path).
// Draw order is part of the contract (sex, size, genome loci in key
// order, then id) so a fixed seed plus call order replays exactly.
import type { Fish, FishId, GameState, Species } from '@aquarium/u1-sim-foundation/state';
import type { Rng } from '@aquarium/u1-sim-foundation';
import { validateSpeciesEntry } from '@aquarium/u1-sim-foundation';

export type Allele = 0 | 1;

/** One diploid locus: two 0/1 alleles. */
export type LocusPair = [Allele, Allele];

/** Full MVP genome (Q7-B): exactly these five loci, key order stable. */
export interface Genome {
  hue: LocusPair;
  pattern: LocusPair;
  tail: LocusPair;
  size: LocusPair;
  vigor: LocusPair;
  /** Index signature keeps Genome assignable to U1's Record<string, unknown> genome slot. */
  [locus: string]: LocusPair;
}

/** Loci in stable key order — draw, serialise, and iterate in this order. */
export const GENOME_LOCI = ['hue', 'pattern', 'tail', 'size', 'vigor'] as const;

export type GenomeLocus = (typeof GENOME_LOCI)[number];

/**
 * A fish as built at spawn. `parents` is null for store-bought fish and
 * set by U5 at birth from breeding (entities.md load rule); it rides
 * alongside U1's shared Fish shape so the buy/birth paths never disagree.
 */
export interface SpawnedFish extends Fish {
  parents: null | readonly [FishId, FishId];
}

/** Allele-1 probability per roll at spawn (BR11.1). */
export const SPAWN_PREMIUM_P = 0.3;

/** Juvenile size window as a fraction of adultSizeCm (BR11.1). */
export const SPAWN_SIZE_MIN = 0.5;

export const SPAWN_SIZE_SPAN = 0.2;

/** New fish arrive well-fed but not full (BR11.1). */
export const SPAWN_SATIETY = 80;

/**
 * Build a store-bought juvenile (BR11.1, BR11.4). Pure: reads
 * state.tank.id and the species entry, advances rng, returns the Fish.
 * Rejects catalogue-invalid species as UNKNOWN_ENTITY so the sale
 * listing (valid catalogue) and spawning can never disagree.
 */
export function spawnFish(state: GameState, species: Species, rng: Rng): SpawnedFish {
  const violations = validateSpeciesEntry(species as unknown as Record<string, unknown>);
  if (violations.length > 0 || species.id.length === 0) {
    throw new Error(`spawnFish: UNKNOWN_ENTITY species '${species.id}' (${violations.join('; ')})`);
  }
  const sex: 'male' | 'female' = rng.next() < 0.5 ? 'male' : 'female';
  const sizeCm = species.adultSizeCm * (SPAWN_SIZE_MIN + rng.next() * SPAWN_SIZE_SPAN);
  const genome: Genome = {
    hue: [rollAllele(rng), rollAllele(rng)],
    pattern: [rollAllele(rng), rollAllele(rng)],
    tail: [rollAllele(rng), rollAllele(rng)],
    size: [rollAllele(rng), rollAllele(rng)],
    vigor: [rollAllele(rng), rollAllele(rng)],
  };
  const id = `fish-${rng.nextInt(0, 0xffffffff).toString(16).padStart(8, '0')}`;
  // Stable key order matches U1's Fish declaration, parents last.
  return {
    id,
    speciesId: species.id,
    tankId: state.tank.id,
    sex,
    stage: 'juvenile',
    ageDays: 0,
    sizeCm,
    health: 100,
    satiety: SPAWN_SATIETY,
    stress: 0,
    genome,
    stunted: false,
    value: species.buyPrice,
    mature: false,
    parents: null,
  };
}

function rollAllele(rng: Rng): Allele {
  return rng.next() < SPAWN_PREMIUM_P ? 1 : 0;
}

/**
 * Mix one allele per locus from each parent (W15, Q7-B). Pure; no
 * mutation in the MVP — stunting is U5's size penalty, not a gene
 * change. Locus order follows GENOME_LOCI; per locus the sire
 * allele is drawn first, then the dam allele.
 */
export function inheritGenome(rng: Rng, sire: Genome, dam: Genome): Genome {
  const pick = (pair: LocusPair): Allele => pair[rng.next() < 0.5 ? 0 : 1] as Allele;
  const child = {} as Record<GenomeLocus, LocusPair>;
  for (const locus of GENOME_LOCI) child[locus] = [pick(sire[locus]), pick(dam[locus])];
  // Key order follows GENOME_LOCI: rebuild literal in the stable order.
  return {
    hue: child.hue,
    pattern: child.pattern,
    tail: child.tail,
    size: child.size,
    vigor: child.vigor,
  };
}
