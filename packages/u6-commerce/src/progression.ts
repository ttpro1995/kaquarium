// progression — BR18 XP sources, thresholds, and unlocks (W33).
// Three XP sources (sale/5, hatch +10, fulfil reward/4); thresholds L2 200
// / L3 600 cascade in one award with one levelUp per level ascending.
// XP never decreases; unlocks accumulate and are never removed.
import type { GameState } from '@aquarium/u1-sim-foundation/state';

/** Sale XP divisor: floor(price/5) per fish (BR18.1). */
export const SALE_XP_DIVISOR = 5;

/** Hatch XP per fryHatched event (BR18.1). */
export const HATCH_XP = 10;

/** Fulfil XP divisor: floor(reward/4) (BR18.1). */
export const FULFIL_XP_DIVISOR = 4;

/** Level thresholds (BR18.1): index is the level the XP unlocks. */
export const LEVEL_XP: Record<2 | 3, number> = { 2: 200, 3: 600 };

/** Highest playable level. */
export const MAX_LEVEL = 3;

/** Level unlock ids, appended on crossing (BR18.2). */
export const UNLOCKS: Record<2 | 3, readonly string[]> = {
  2: ['tier.2', 'equipment.filter2', 'equipment.heater', 'equipment.autofeeder'],
  3: ['tier.3', 'equipment.filter3', 'equipment.light2', 'equipment.light3'],
};

/** Sale XP for one priced fish. */
export function xpForSale(price: number): number {
  return Math.floor(price / SALE_XP_DIVISOR);
}

/** Fulfil XP for one reward. */
export function xpForReward(reward: number): number {
  return Math.floor(reward / FULFIL_XP_DIVISOR);
}

/**
 * Grant XP and cascade level-ups (W33). Emits one levelUp per level gained
 * in ascending order; command handlers call this after paying so the
 * grant-then-check is atomic with the sale.
 */
export function addXp(
  state: GameState,
  events: { kind: string; [k: string]: unknown }[],
  amount: number,
): void {
  if (!(amount > 0)) return;
  state.progression.xp += amount;
  while (state.progression.level < MAX_LEVEL) {
    const next = (state.progression.level + 1) as 2 | 3;
    if (state.progression.xp < LEVEL_XP[next]) break;
    state.progression.level = next;
    for (const unlock of UNLOCKS[next]) {
      if (!state.progression.unlocks.includes(unlock)) state.progression.unlocks.push(unlock);
    }
    events.push({ kind: 'levelUp', level: next });
  }
}
