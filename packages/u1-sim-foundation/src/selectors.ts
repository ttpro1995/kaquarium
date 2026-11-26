// selectors — pure read-only views over GameState (C1). A screen adds a
// selector when it needs one; that never changes the state schema.
import type { Fish, GameState, Notification, TankWater } from './types.js';

export function money(state: GameState): number {
  return state.money;
}

export function level(state: GameState): number {
  return state.progression.level;
}

export function fishById(state: GameState, id: string): Fish | undefined {
  return state.fish[id];
}

/** Authoritative membership scan over Fish.tankId (Q2-B). */
export function fishInTank(state: GameState, tankId: string): Fish[] {
  return Object.values(state.fish).filter((f) => f.tankId === tankId);
}

export function sellableFish(state: GameState): Fish[] {
  return Object.values(state.fish).filter((f) => f.mature && f.health > 50);
}

export function notificationQueue(state: GameState): readonly Notification[] {
  return state.notifications;
}

export function tankWater(state: GameState): TankWater {
  return state.tank.water;
}
