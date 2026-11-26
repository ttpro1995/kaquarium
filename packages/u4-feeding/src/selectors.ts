// selectors — U4-owned pure readers for U7 panels. Nothing here
// mutates; every function is safe to call mid-tick.
import type { FeedingSchedule, FoodItem, GameState } from '@aquarium/u1-sim-foundation/state';
import { isExpired } from './food.js';

export interface FeedingProgram {
  installed: boolean;
  schedule: FeedingSchedule | null;
}

/** Stacks for U7 panels, expiry-flagged but unfiltered (BR12.3). */
export function foodStock(state: GameState, kind?: string): FoodItem[] {
  const out: FoodItem[] = [];
  const food = state.food;
  for (const id in food) {
    const stack = food[id];
    if (stack === undefined) continue;
    if (kind !== undefined && stack.kind !== kind) continue;
    out.push(stack);
  }
  return out;
}

/** Non-expired portions of the kind, oldest-first (BR12.3). */
export function usableFood(state: GameState, kind: string): FoodItem[] {
  const today = state.clock.gameDay;
  return foodStock(state, kind)
    .filter((stack) => stack.qty > 0 && !isExpired(stack, today))
    .sort((a, b) => a.acquiredDay - b.acquiredDay);
}

/** Schedule + device state for the U7 feeder panel (W18). */
export function feedingProgram(state: GameState): FeedingProgram {
  return {
    installed: state.tank.equipment.autoFeeder.installed,
    schedule: state.feeding.schedule,
  };
}
