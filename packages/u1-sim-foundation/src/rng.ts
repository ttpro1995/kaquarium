// rng — the single seeded stream (BR2.1, NFR3.1). All simulation
// randomness flows through ctx.rng; no Math.random/Date.now in systems.
// Mutable cursor: every draw advances RngState.a in place.
import type { RngState } from './types.js';

export interface Rng {
  /** Uniform draw in [0, 1). Advances the cursor. */
  next(): number;
  /** Integer draw in [min, max]. Advances the cursor. */
  nextInt(min: number, max: number): number;
  /** Uniform pick from a non-empty array. Advances the cursor. */
  pick<T>(items: readonly T[]): T;
}

export function createRng(state: RngState): Rng {
  return {
    next(): number {
      // mulberry32 step over the shared cursor
      state.a = (state.a + 0x6d2b79f5) | 0;
      let t = Math.imul(state.a ^ (state.a >>> 15), 1 | state.a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(min: number, max: number): number {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new Error('nextInt: need integer min <= max');
      }
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick: empty array');
      return items[Math.floor(this.next() * items.length)] as T;
    },
  };
}
