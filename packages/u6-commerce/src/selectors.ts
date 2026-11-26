// selectors — U6-owned pure readers (BR16.1, BR17.2, BR18.2, BR19.3).
// U7 confirm screens and HUD read through these; nothing here mutates,
// so every preview is safe to call mid-tick.
import type {
  Fish,
  GameState,
  Notification,
  Species,
} from '@aquarium/u1-sim-foundation/state';
import { demandFor, trendFor } from './market.js';
import { fulfilReward } from './orders.js';
import { LEVEL_XP, MAX_LEVEL } from './progression.js';
import { priceForFish } from './pricing.js';

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

/** Confirm-screen projection of a bulk sale (U7): never mutates. */
export function bulkPreview(state: GameState, fishIds: readonly string[], speciesOf: SpeciesOf): BulkPreview {
  const items: BulkPreviewItem[] = [];
  const skipped: string[] = [];
  let total = 0;
  let sold = 0;
  for (const fishId of [...new Set(fishIds)]) {
    const fish: Fish | undefined = state.fish[fishId];
    const live =
      fish === undefined
        ? undefined
        : priceForFish(fish, speciesOf(fish.speciesId), demandFor(state, fish.speciesId), trendFor(state, fish.speciesId));
    if (live === undefined) {
      items.push({ fishId, price: null, skipped: true });
      skipped.push(fishId);
      continue;
    }
    items.push({ fishId, price: live, skipped: false });
    total += live;
    sold++;
  }
  return { items, sold, skipped, total };
}

/** Confirm-screen projection of a fulfil reward (U7): never mutates. */
export function orderRewardPreview(
  state: GameState,
  orderId: string,
  fishIds: readonly string[],
  speciesOf: SpeciesOf,
): number | undefined {
  const order = state.orders.find((o) => o.id === orderId);
  if (order === undefined) return undefined;
  let sum = 0;
  for (const fishId of [...new Set(fishIds)]) {
    const fish = state.fish[fishId];
    if (fish === undefined) return undefined;
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
