// away — while-you-were-away summary flow (W45; US11.1 U7 share).
// The catch-up itself runs through the kernel; the modal STATE lives in
// App (not in this helper): runAwaySequence returns the modal model (or
// null when there is nothing to show) and App holds it until Resume.
// Resume dispatches clock.setPaused { paused: false } — per U1 BR1.2 the
// unpause restores speed 1, never a prior speed.
import type { Kernel } from '@aquarium/u1-sim-foundation';
import { setPaused } from '../panels/actions.js';
import type { ShellStore } from './store.js';

export interface AwaySummary {
  elapsedDays: number;
  hatched: number;
  matured: number;
  diedOfOldAge: number;
  ordersExpired: number;
  capped: boolean;
  ticksRun: number;
}

export function runAwaySequence(kernel: Kernel, elapsedGameHours: number): AwaySummary | null {
  if (!(elapsedGameHours > 0)) return null;
  const summary = kernel.catchUp(elapsedGameHours);
  return {
    elapsedDays: summary.elapsedDays,
    hatched: summary.hatched,
    matured: summary.matured,
    diedOfOldAge: summary.diedOfOldAge,
    ordersExpired: summary.ordersExpired,
    capped: summary.capped,
    ticksRun: summary.ticksRun,
  };
}

export function resumeFromAway(store: ShellStore) {
  return setPaused(store, false);
}
