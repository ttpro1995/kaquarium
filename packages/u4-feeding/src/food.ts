// food — U4 stock data model (BR12.1–BR12.4).
// Pure helpers over U1's shared FoodItem shape: the fixed three-kind
// catalogue, game-day expiry, and oldest-first usable order. No
// mutation here; handlers and the feeding system own the writes.
import type { FoodItem, FoodTarget, GameState } from '@aquarium/u1-sim-foundation/state';
import type { Rng } from '@aquarium/u1-sim-foundation';

export type FoodKind = 'flakes' | 'pellets' | 'liveFirst';

export interface FoodCatalogueRow {
  pricePerUnit: number;
  quality: number;
  shelfLifeDays: number;
  target: FoodTarget;
}

/** BR12.1: the fixed MVP catalogue — price, quality, target, expiry. */
export const FOOD_CATALOG: Record<FoodKind, FoodCatalogueRow> = {
  flakes: { pricePerUnit: 2, quality: 0.7, shelfLifeDays: 0, target: 'fish' },
  pellets: { pricePerUnit: 4, quality: 0.9, shelfLifeDays: 0, target: 'fish' },
  liveFirst: { pricePerUnit: 6, quality: 1.0, shelfLifeDays: 7, target: 'fry' },
};

/** Waste added per uneaten portion (BR13.2, U4-owned; consumed via feedResult). */
export const WASTE_PER_PORTION = 2.0;

/** Satiety restored per portion at quality 1 (BR13.1). */
export const SATIETY_PER_PORTION = 25;

export function isFoodKind(kind: unknown): kind is FoodKind {
  return kind === 'flakes' || kind === 'pellets' || kind === 'liveFirst';
}

/**
 * BR12.3: expired ≡ shelfLifeDays > 0 AND acquiredDay + shelfLifeDays < today.
 * shelfLifeDays 0 never expires. The last usable day is acquiredDay + shelf.
 */
export function isExpired(stack: FoodItem, today: number): boolean {
  return stack.shelfLifeDays > 0 && stack.acquiredDay + stack.shelfLifeDays < today;
}

/** Satiety restored by one portion of the stack (BR13.1). */
export function restorePerPortion(stack: FoodItem): number {
  return Math.round(SATIETY_PER_PORTION * stack.quality);
}

/**
 * BR12.3: non-expired stacks of the kind, oldest-acquired first.
 * Insertion order breaks acquiredDay ties (stable sort over a live record).
 */
export function usableFoodStacks(state: GameState, kind: string, today: number): FoodItem[] {
  const out: FoodItem[] = [];
  const food = state.food;
  for (const id in food) {
    const stack = food[id];
    if (stack === undefined || stack.kind !== kind) continue;
    if (stack.qty <= 0 || isExpired(stack, today)) continue;
    out.push(stack);
  }
  out.sort((a, b) => a.acquiredDay - b.acquiredDay);
  return out;
}

/** Fresh stack id from the seeded stream (same hex pattern as U3 spawnFish). */
export function nextFoodId(rng: Rng): string {
  return `food-${rng.nextInt(0, 0xffffffff).toString(16).padStart(8, '0')}`;
}

/** Build a freshly purchased stack (BR12.2: one dated stack per buy). */
export function makeStack(id: string, kind: FoodKind, qty: number, today: number): FoodItem {
  const row = FOOD_CATALOG[kind];
  return {
    id,
    kind,
    qty,
    quality: row.quality,
    shelfLifeDays: row.shelfLifeDays,
    acquiredDay: today,
    target: row.target,
  };
}
