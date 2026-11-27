// pricing — BR16.1 eight-factor sale formula (W27).
// Every price read runs the same formula over live demand/trend, so the
// sell preview, the fulfil estimate, and the commerce-tick Fish.value
// cache refresh can never disagree. Pure: no mutation, no rng.
import type { Fish, Species } from '@aquarium/u1-sim-foundation/state';
import { alleleSum, type Genome } from '@aquarium/u3-fish';

/** Health below this line is sick: unsellable, skipped in bulk (BR16.2). */
export const SELL_HEALTH_GATE = 40;

/** sizeCm/adultSizeCm clamps (BR16.1). */
export const SIZE_FACTOR_MIN = 0.3;
export const SIZE_FACTOR_MAX = 1.2;

/** Market factor clamps (BR16.1). */
export const MARKET_FACTOR_MIN = 0.4;
export const MARKET_FACTOR_MAX = 1.5;

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** sizeF = clamp(sizeCm/adultSizeCm, 0.3, 1.2); stunting carries through sizeCm. */
export function sizeFactor(sizeCm: number, adultSizeCm: number): number {
  if (!(adultSizeCm > 0)) return SIZE_FACTOR_MIN;
  return clamp(sizeCm / adultSizeCm, SIZE_FACTOR_MIN, SIZE_FACTOR_MAX);
}

/** ageF = 0.6 juvenile / 1.0 adult / 0.7 senior. */
export function ageFactor(stage: Fish['stage']): number {
  if (stage === 'juvenile') return 0.6;
  if (stage === 'senior') return 0.7;
  return 1.0;
}

/** colourF = 0.8–1.2 from the hue locus sum. */
export function colourFactor(hueSum: 0 | 1 | 2): number {
  return 0.8 + 0.2 * hueSum;
}

/** rarityF = 1 + 0.1 per premium allele across the genome. */
export function rarityFactor(premiumAlleles: number): number {
  return 1 + 0.1 * premiumAlleles;
}

/** healthF = 1.0 at >= 70, 0.7 below (sick fish never reach the till). */
export function healthFactor(health: number): number {
  return health >= 70 ? 1.0 : 0.7;
}

/** geneticsF = 0.8 + 0.2 x genomeQuality. */
export function geneticsFactor(quality: number): number {
  return 0.8 + 0.2 * quality;
}

/** marketF = clamp(0.4 + 1.1 x demand + 0.1 x trend, 0.4, 1.5). */
export function marketFactor(demand: number, trend: number): number {
  return clamp(0.4 + 1.1 * demand + 0.1 * trend, MARKET_FACTOR_MIN, MARKET_FACTOR_MAX);
}

/** floor(product), minimum 1. */
export function formulaPrice(sellBase: number, factors: readonly number[]): number {
  let product = sellBase;
  for (const factor of factors) product *= factor;
  return Math.max(1, Math.floor(product));
}
export function isSellableHealth(health: number): boolean {
  return health >= SELL_HEALTH_GATE;
}

function asGenome(fish: Fish): Genome {
  return fish.genome as unknown as Genome;
}

/**
 * Full eight-factor price for one fish (W27, BR16.1). Pure; undefined when
 * the species entry is missing so callers reject UNKNOWN_ENTITY instead
 * of pricing against a guessed base.
 *
 * Deliberate triplication (review R-02): fastPriceForFish (commerce.ts) and the
 * inline loop in runCommerceTick repeat this arithmetic instead of calling
 * it, trading one canonical call path for the NFR1.1 hot-loop budget — the
 * tick loop additionally hoists per-species market terms out of the loop
 * and memoizes the immutable genome factor per Fish object (WeakMap), and
 * the fast path avoids per-fish calls entirely, so collapsing either onto
 * this canonical form would reintroduce per-fish helper calls in the
 * 40-fish x 24-ticks/day hot loop. All three copies must agree
 * factor-for-factor — enforced by tests/pricing.test.ts
 * 'canonical priceForFish, fastPriceForFish, and the tick inline loop
 * agree across a genome sweep'. Change one, change all three, then run
 * the sweep.
 */
export function priceForFish(
  fish: Fish,
  species: Species | undefined,
  demand: number,
  trend: number,
): number | undefined {
  if (species === undefined) return undefined;
  const genome = asGenome(fish);
  const hueSum = alleleSum(genome, 'hue');
  const premium =
    hueSum +
    alleleSum(genome, 'pattern') +
    alleleSum(genome, 'tail') +
    alleleSum(genome, 'size') +
    alleleSum(genome, 'vigor');
  // Inline product: the tick refresh prices every fish, so no per-fish array.
  const product =
    species.sellBase *
    sizeFactor(fish.sizeCm, species.adultSizeCm) *
    ageFactor(fish.stage) *
    colourFactor(hueSum) *
    rarityFactor(premium) *
    healthFactor(fish.health) *
    geneticsFactor(premium / 10) *
    marketFactor(demand, trend);
  return Math.max(1, Math.floor(product));
}
