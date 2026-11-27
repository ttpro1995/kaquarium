// feeding — U4 feeding-phase system (W17–W20, BR12.3, BR13).
// One system (`u4.feeding`, feeding phase) plus the shared dispensing
// core the command handlers call. C2-allowlisted writes only: food
// records, Fish.satiety, tank.water.waste, the cohort's firstFoodDays /
// lastFryFedDay, and the schedule's lastRunHour. No per-tick sorts over
// fish beyond the feed-time appetite order; no allocation on idle ticks.
import type {
  Fish,
  FoodItem,
  FryCohort,
  GameState,
} from '@aquarium/u1-sim-foundation/state';
import type { Registry, SimEvent, System, TickContext } from '@aquarium/u1-sim-foundation';
import {
  isExpired,
  restorePerPortion,
  usableFoodStacks,
  WASTE_PER_PORTION,
} from './food.js';
import { isScheduleDue } from './schedule.js';
import './events.js';

export interface DispenseResult {
  eaten: number;
  leftover: number;
}

export interface DispenseOptions {
  /**
   * System path only: skip the per-stack fed; the scheduled run emits one
   * aggregated fed with the total instead. Manual commands leave the
   * default (one fed per call).
   */
  emitFed?: boolean;
}

/** Appetite order: ascending satiety, roster (insertion) order on ties. */
function orderedFish(state: GameState): Fish[] {
  const tankId = state.tank.id;
  const list: Fish[] = [];
  const fish = state.fish;
  for (const id in fish) {
    const entry = fish[id];
    if (entry === undefined || entry.tankId !== tankId) continue;
    list.push(entry);
  }
  // Stable sort: ties keep roster order.
  list.sort((a, b) => a.satiety - b.satiety);
  return list;
}

/** BR13.2: uneaten portions become visible waste (clamped), never hidden. */
function depositWaste(state: GameState, events: SimEvent[], leftover: number): void {
  if (leftover <= 0) return;
  const wasteDelta = leftover * WASTE_PER_PORTION;
  state.tank.water.waste = Math.min(100, state.tank.water.waste + wasteDelta);
  events.push({ kind: 'overfed', wasteDelta });
}

/** Consume d portions; a stack hitting 0 is removed with foodOut. */
function consumeStack(state: GameState, events: SimEvent[], stack: FoodItem, d: number): void {
  stack.qty -= d;
  if (stack.qty <= 0) {
    delete state.food[stack.id];
    events.push({ kind: 'foodOut', foodId: stack.id });
  }
}

/**
 * BR13.1–BR13.2 core: dispense up to `portions` from one validated stack
 * into the tank's fish. Each portion restores restorePerPortion to the
 * hungriest non-full fish (capped at 100); portions nobody can take
 * become waste. Returns null when the stack cannot dispense (expired
 * or dry) with nothing mutated or emitted. Emits one fed per call unless
 * opts.emitFed is false (the scheduled run aggregates across stacks).
 */
export function dispenseToFish(
  state: GameState,
  events: SimEvent[],
  stack: FoodItem,
  portions: number,
  today: number = state.clock.gameDay,
  opts: DispenseOptions = {},
): DispenseResult | null {
  if (stack.qty <= 0 || isExpired(stack, today)) return null;
  const d = Math.min(portions, stack.qty);
  const restore = restorePerPortion(stack);
  const order = orderedFish(state);
  let eaten = 0;
  for (let p = 0; p < d; p++) {
    const diner = order.find((fish) => fish.satiety < 100);
    if (diner === undefined) break;
    diner.satiety = Math.min(100, diner.satiety + restore);
    eaten++;
  }
  consumeStack(state, events, stack, d);
  depositWaste(state, events, d - eaten);
  if (opts.emitFed !== false) {
    events.push({ kind: 'fed', foodId: stack.id, portion: eaten });
  }
  return { eaten, leftover: d - eaten };
}

/**
 * BR13.3 core: dispense up to `portions` from one validated stack into
 * one fry cohort. Fry eat 10 per portion: eaten = min(dispensed,
 * ceil(count / 10)). Event shape mirrors the fish path; the U5 counters
 * update with day idempotency. Returns null for an undispensable stack.
 */
export function dispenseToFry(
  state: GameState,
  events: SimEvent[],
  stack: FoodItem,
  cohort: FryCohort,
  portions: number,
  today: number = state.clock.gameDay,
): DispenseResult | null {
  if (stack.qty <= 0 || isExpired(stack, today)) return null;
  const d = Math.min(portions, stack.qty);
  const need = Math.ceil(cohort.count / 10);
  const eaten = Math.min(d, need);
  consumeStack(state, events, stack, d);
  depositWaste(state, events, d - eaten);
  events.push({ kind: 'fed', foodId: stack.id, portion: eaten });
  // Only a feed that lands counts as a first-food day (eaten == 0 when the
  // cohort is empty: need is 0, so nothing is eaten).
  if (eaten > 0 && today !== cohort.lastFryFedDay) {
    cohort.firstFoodDays += 1;
    cohort.lastFryFedDay = today;
  }
  return { eaten, leftover: d - eaten };
}

/**
 * BR12.3 sweep: each stack whose last usable day was yesterday
 * (acquiredDay + shelfLifeDays == today - 1) emits foodOut. The stack
 * stays listed — visible but expired. Pure over (state, today); the
 * system gates it to the hour-0 tick so it fires exactly once per day.
 */
export function expirySweep(state: GameState, events: SimEvent[], today: number): void {
  const food = state.food;
  for (const id in food) {
    const stack = food[id];
    if (stack === undefined || stack.shelfLifeDays <= 0) continue;
    if (stack.acquiredDay + stack.shelfLifeDays === today - 1) {
      events.push({ kind: 'foodOut', foodId: stack.id });
    }
  }
}

/** One feeding phase: expiry sweep, then the scheduled run (BR13.4). */
export function runFeedingTick(ctx: TickContext): void {
  const state = ctx.state;
  // Single time authority: today and nowHour both derive from ctx.now, the
  // tick's dispatched time. Never mix in state.clock here; the stored clock
  // can lag the dispatched context by a tick.
  const today = ctx.now.day;
  if (ctx.now.hour === 0) {
    expirySweep(state, ctx.events, today);
  }
  const schedule = state.feeding.schedule;
  if (schedule === null) return;
  if (!state.tank.equipment.autoFeeder.installed) return;
  const nowHour = ctx.now.day * 24 + ctx.now.hour;
  if (!isScheduleDue(schedule, nowHour)) return;
  // Silent skip on dry shelves: the foodOut warning already fired at 0.
  const shelves = usableFoodStacks(state, schedule.foodKind, today);
  if (shelves.length === 0) return;
  let remaining = schedule.portions;
  let eatenTotal = 0;
  let firstId: string | null = null;
  for (const stack of shelves) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, stack.qty);
    const result = dispenseToFish(state, ctx.events, stack, take, today, { emitFed: false });
    if (result === null) continue;
    if (firstId === null) firstId = stack.id;
    eatenTotal += result.eaten;
    remaining -= take;
  }
  // One fed per scheduled run with the total eaten, attributed to the
  // first (oldest) stack drawn. Per-stack facts keep their own events
  // (overfed per leftovers, foodOut per drained stack).
  if (firstId !== null) {
    ctx.events.push({ kind: 'fed', foodId: firstId, portion: eatenTotal });
  }
  // One run per tick, never a backlog catch-up: clock jumps to now.
  schedule.lastRunHour = nowHour;
}

export const feedingSystem: System = {
  id: 'u4.feeding',
  phase: 'feeding',
  run: runFeedingTick,
};

export function registerFeeding(registry: Registry): void {
  registry.registerSystem(feedingSystem);
}
