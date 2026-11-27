// selectors — U6-owned pure readers (BR16.1, BR17.2, BR18.2, BR19.3).
// U7 confirm screens and HUD read through these; nothing here mutates,
// so every preview is safe to call mid-tick.
import type {
  Fish,
  GameState,
  Notification,
  Species,
} from '@aquarium/u1-sim-foundation/state';
import { demandFor, trendFor, SATURATION_PER_SALE } from './market.js';
import { fulfilReward } from './orders.js';
import { LEVEL_XP, MAX_LEVEL } from './progression.js';
import { isSellableHealth, priceForFish } from './pricing.js';

export type SpeciesOf = (speciesId: string) => Species | undefined;

/** Live formula price for one fish, or undefined when fish/species is unknown. */
export function sellPrice(state: GameState, fishId: string, species: Species | undefined): number | undefined {
  const fish = state.fish[fishId];
  if (fish === undefined) return undefined;
  return priceForFish(fish, species, demandFor(state, fish.speciesId), trendFor(state, fish.speciesId));
}

export interface BulkPreviewItem {
  fishId: string;
  price: number | null;
  skipped: boolean;
}

export interface BulkPreview {
  items: BulkPreviewItem[];
  sold: number;
  skipped: string[];
  total: number;
}

/** Confirm-screen projection of a bulk sale (U7): never mutates.
 * Exact mirror of sellBulk pricing and eligibility (BR16.2/BR16.3): sick
 * fish (health < 40) list as skipped, and each sold fish prices at the
 * sequentially saturated demand (x0.97 per fish, per species), so the
 * preview total equals the real sale total. Unknown fish and
 * catalogue-missing species skip the same way. U7 shows this total
 * verbatim — it is exact, not approximate.
 */
export function bulkPreview(state: GameState, fishIds: readonly string[], speciesOf: SpeciesOf): BulkPreview {
  const items: BulkPreviewItem[] = [];
  const skipped: string[] = [];
  const simulatedDemand = new Map<string, number>();
  let total = 0;
  let sold = 0;
  for (const fishId of [...new Set(fishIds)]) {
    const fish: Fish | undefined = state.fish[fishId];
    if (fish === undefined || !isSellableHealth(fish.health)) {
      items.push({ fishId, price: null, skipped: true });
      skipped.push(fishId);
      continue;
    }
    let demand = simulatedDemand.get(fish.speciesId);
    if (demand === undefined) {
      demand = demandFor(state, fish.speciesId);
      simulatedDemand.set(fish.speciesId, demand);
    }
    const live = priceForFish(fish, speciesOf(fish.speciesId), demand, trendFor(state, fish.speciesId));
    if (live === undefined) {
      items.push({ fishId, price: null, skipped: true });
      skipped.push(fishId);
      continue;
    }
    items.push({ fishId, price: live, skipped: false });
    total += live;
    sold++;
    simulatedDemand.set(fish.speciesId, demand * SATURATION_PER_SALE);
  }
  return { items, sold, skipped, total };
}

/** Confirm-screen projection of a fulfil reward (U7): never mutates.
 * Exact mirror of fulfil pricing and eligibility (BR17.2): unknown order,
 * unknown fish, sick fish (health < 40), a past-deadline or non-open order,
 * and count/species/health/size mismatches all yield undefined — the same
 * selections fulfil rejects as UNKNOWN_ENTITY, FISH_UNSELLABLE, or
 * INVALID_SETTING — and catalogue-missing species is unpriceable, so U7
 * never shows a reward for an unfulfillable order. The eligible preview
 * total equals the real fulfil reward. Check order mirrors fulfil's
 * precedence: unknown fish, then the health gate, then deadline/status/
 * count, then per-fish order terms.
 */
export function orderRewardPreview(
  state: GameState,
  orderId: string,
  fishIds: readonly string[],
  speciesOf: SpeciesOf,
): number | undefined {
  const order = state.orders.find((o) => o.id === orderId);
  if (order === undefined) return undefined;
  const deduped = [...new Set(fishIds)];
  for (const fishId of deduped) {
    if (state.fish[fishId] === undefined) return undefined;
  }
  for (const fishId of deduped) {
    const fish = state.fish[fishId] as Fish;
    if (!isSellableHealth(fish.health)) return undefined;
  }
  if (state.clock.gameDay > order.deadlineDay) return undefined;
  if (order.status !== 'open' || deduped.length !== order.quantity) return undefined;
  let sum = 0;
  for (const fishId of deduped) {
    const fish = state.fish[fishId] as Fish;
    if (fish.speciesId !== order.speciesId || fish.health < order.minHealth || fish.sizeCm < order.minSizeCm) {
      return undefined;
    }
    const price = priceForFish(
      fish,
      speciesOf(fish.speciesId),
      demandFor(state, fish.speciesId),
      trendFor(state, fish.speciesId),
    );
    if (price === undefined) return undefined;
    sum += price;
  }
  return fulfilReward(sum, order.multiplier, state.reputation);
}

/** Store gating + HUD: tier <= level and egg-layers need L2+. */
export function buyableSpecies(state: GameState, catalog: readonly Species[]): Species[] {
  return catalog.filter(
    (s) =>
      s.tier <= state.progression.level &&
      !((s.archetype === 'scatter' || s.archetype === 'plant') && state.progression.level < 2),
  );
}

export interface LevelProgress {
  level: number;
  xp: number;
  xpToNext: number | null;
  unlocks: string[];
}

/** HUD progress: xpToNext is derived, never stored (BR18.1). */
export function levelProgress(state: GameState): LevelProgress {
  const next = (state.progression.level + 1) as 2 | 3;
  return {
    level: state.progression.level,
    xp: state.progression.xp,
    xpToNext: state.progression.level >= MAX_LEVEL ? null : LEVEL_XP[next] - state.progression.xp,
    unlocks: [...state.progression.unlocks],
  };
}

/** Capped visible queue for U7 (BR19.3). */
export function notificationQueue(state: GameState): readonly Notification[] {
  return state.notifications;
}
