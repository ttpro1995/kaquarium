// schedule — U4 auto-feeder program state (BR13.4).
// Pure helpers over U1's shared FeedingSchedule shape: the absolute
// game-hour clock and program validation. The feeding system owns the
// per-tick run decision; the setAutoFeeder handler owns the writes.
import type { FeedingSchedule, GameState } from '@aquarium/u1-sim-foundation/state';

export type ScheduleFoodKind = 'flakes' | 'pellets';

/** Fish-target kinds only; fry food never auto-dispenses (BR13.4). */
export function isScheduleKind(kind: unknown): kind is ScheduleFoodKind {
  return kind === 'flakes' || kind === 'pellets';
}

/** Absolute game-hour clock: deterministic across live, reload, catch-up. */
export function absoluteHour(state: GameState): number {
  return state.clock.gameDay * 24 + state.clock.gameHour;
}

/** A cleared program is null (BR13.4: clearing never uninstalls the device). */
export function emptySchedule(): FeedingSchedule | null {
  return null;
}

/** A fresh program starts its clock at creation (first run after one full interval). */
export function makeSchedule(
  foodKind: ScheduleFoodKind,
  portions: number,
  intervalHours: number,
  nowHour: number,
): FeedingSchedule {
  return { foodKind, portions, intervalHours, lastRunHour: nowHour };
}

/** Due ⟺ now - lastRunHour >= intervalHours (BR13.4). */
export function isScheduleDue(schedule: FeedingSchedule, nowHour: number): boolean {
  return nowHour - schedule.lastRunHour >= schedule.intervalHours;
}

export interface ScheduleInput {
  foodKind: unknown;
  portions: unknown;
  intervalHours: unknown;
}

/**
 * Validate a setAutoFeeder program (BR13.4). Returns the normalized
 * program fields or the rejection code the handler reports.
 */
export function validateScheduleInput(
  input: ScheduleInput,
): { ok: true; value: { foodKind: ScheduleFoodKind; portions: number; intervalHours: number } } | { ok: false; code: 'INVALID_QUANTITY' | 'INVALID_SETTING' } {
  const { foodKind, portions, intervalHours } = input;
  if (
    typeof portions !== 'number' ||
    !Number.isFinite(portions) ||
    portions < 1 ||
    typeof intervalHours !== 'number' ||
    !Number.isFinite(intervalHours) ||
    intervalHours < 1
  ) {
    return { ok: false, code: 'INVALID_QUANTITY' };
  }
  if (!isScheduleKind(foodKind)) {
    // Fry food (liveFirst) and unknown strings alike: no program.
    return { ok: false, code: 'INVALID_SETTING' };
  }
  return { ok: true, value: { foodKind, portions, intervalHours } };
}
