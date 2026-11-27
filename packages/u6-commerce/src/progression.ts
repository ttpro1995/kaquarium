// progression — BR18 XP sources, thresholds, and unlocks (W33).
// Three XP sources (sale/5, hatch +10, fulfil reward/4); thresholds L2 200
// / L3 600 cascade in one award with one levelUp per level ascending.
// XP never decreases; unlocks accumulate and are never removed.
// Unlock ids are U2's canonical tables (U2 gates purchases on them);
// the per-level award mapping stays here (BR18.2).
import type { GameState } from '@aquarium/u1-sim-foundation/state';
import { EQUIPMENT_UNLOCKS, TIER_UNLOCKS } from '@aquarium/u2-tank-water';

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

/** Level unlock ids, appended on crossing (BR18.2). Built from U2's canonical tables: every id U2 gates on is awarded here (see unlocks-crosscheck.test.ts). */
export const UNLOCKS: Record<2 | 3, readonly string[]> = {
  2: [
    TIER_UNLOCKS[2] as string,
    EQUIPMENT_UNLOCKS.filter[2] as string,
    EQUIPMENT_UNLOCKS.heater[1] as string,
    EQUIPMENT_UNLOCKS.autoFeeder[1] as string,
  ],
  3: [
    TIER_UNLOCKS[3] as string,
    EQUIPMENT_UNLOCKS.filter[3] as string,
    EQUIPMENT_UNLOCKS.light[2] as string,
    EQUIPMENT_UNLOCKS.light[3] as string,
  ],
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
