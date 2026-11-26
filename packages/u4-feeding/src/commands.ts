// commands — U4 command handlers (W16–W19, BR12.2, BR13).
// Each unit declares its command payloads/results by augmenting U1's
// CommandMap (type side) and registering the handler (runtime side).
// Handlers validate first, then mutate, then emit: a rejection leaves the
// store untouched by construction, never by rollback. Money moves only
// under the C2 purchase-path exception (deduct + moneyChanged, atomic).
import type { FoodItem, GameState } from '@aquarium/u1-sim-foundation/state';
import {
  declareCommandType,
  type CommandError,
  type CommandHandler,
} from '@aquarium/u1-sim-foundation/commands';
import type { Registry, SimEvent } from '@aquarium/u1-sim-foundation';
import { createRng } from '@aquarium/u1-sim-foundation';
import { FOOD_CATALOG, isExpired, isFoodKind, makeStack, nextFoodId } from './food.js';
import {
  absoluteHour,
  makeSchedule,
  validateScheduleInput,
} from './schedule.js';
import { dispenseToFish, dispenseToFry } from './feeding.js';
import './events.js';

export interface BuyFoodPayload {
  kind: string;
  qty: number;
}

export interface BuyFoodResult {
  foodId: string;
  qty: number;
  price: number;
}

export interface FeedFishPayload {
  foodId: string;
  portions: number;
}

export interface FeedFishResult {
  eaten: number;
  leftover: number;
  waste: number;
}

export interface FeedFryPayload {
  foodId: string;
  cohortId: string;
  portions: number;
}

export interface FeedFryResult {
  eaten: number;
  leftover: number;
  waste: number;
}

export interface SetAutoFeederPayload {
  foodKind: string;
  portions: number;
  intervalHours: number;
}

export interface SetAutoFeederResult {
  set: boolean;
}

declare module '@aquarium/u1-sim-foundation/commands' {
  interface CommandMap {
    'feeding.buyFood': { payload: BuyFoodPayload; result: BuyFoodResult };
    'feeding.feedFish': { payload: FeedFishPayload; result: FeedFishResult };
    'feeding.feedFry': { payload: FeedFryPayload; result: FeedFryResult };
    'feeding.setAutoFeeder': {
      payload: SetAutoFeederPayload | null;
      result: SetAutoFeederResult;
    };
  }
}

declareCommandType('feeding.buyFood');
declareCommandType('feeding.feedFish');
declareCommandType('feeding.feedFry');
declareCommandType('feeding.setAutoFeeder');

/** Shared money move: deduct then emit moneyChanged on the U6 shape (C2 exception). */
export function spend(state: GameState, events: SimEvent[], price: number): void {
  state.money -= price;
  events.push({ kind: 'moneyChanged', delta: -price, balance: state.money });
}

function checkPortions(portions: unknown): CommandError | null {
  if (typeof portions !== 'number' || !Number.isInteger(portions) || portions < 1) {
    return { code: 'INVALID_QUANTITY', message: 'Portions must be an integer >= 1.' };
  }
  return null;
}

/** Shared accepted-feed result: waste is the raw leftover add (BR13.2). */
function feedResult(result: { eaten: number; leftover: number }): FeedFishResult {
  return { eaten: result.eaten, leftover: result.leftover, waste: result.leftover * 2.0 };
}
/** Named-stack gate (BR12.3, BR13.1): missing, dry, or expired rejects. */
function checkStack(state: GameState, foodId: unknown, today: number): { stack: FoodItem } | { error: CommandError } {
  if (typeof foodId !== 'string') {
    return { error: { code: 'NOT_AVAILABLE', message: 'That food is not available.' } };
  }
  const stack = state.food[foodId];
  if (stack === undefined || stack.qty <= 0 || isExpired(stack, today)) {
    return { error: { code: 'NOT_AVAILABLE', message: 'That food is not available.' } };
  }
  return { stack };
}

/**
 * W16: buy food (BR12.1, BR12.2). Unknown kind -> UNKNOWN_ENTITY;
 * qty < 1 (non-integer included) -> INVALID_QUANTITY; short funds ->
 * INSUFFICIENT_FUNDS (atomic). Else deduct, append one dated stack,
 * emit moneyChanged.
 */
export const buyFood: CommandHandler<BuyFoodPayload, BuyFoodResult> = (
  state,
  payload,
  ctx,
) => {
  const kind = (payload as Partial<BuyFoodPayload> | null)?.kind;
  const qty = (payload as Partial<BuyFoodPayload> | null)?.qty;
  if (!isFoodKind(kind)) {
    return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: `Unknown food kind '${String(kind)}'.` } };
  }
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) {
    return { ok: false, error: { code: 'INVALID_QUANTITY', message: 'Food quantity must be an integer >= 1.' } };
  }
  const total = qty * FOOD_CATALOG[kind].pricePerUnit;
  if (state.money < total) {
    return { ok: false, error: { code: 'INSUFFICIENT_FUNDS', message: 'Not enough $FISH for the food.' } };
  }
  const rng = createRng(state.rngState);
  const id = nextFoodId(rng);
  spend(state, ctx.events, total);
  state.food[id] = makeStack(id, kind, qty, state.clock.gameDay);
  return { ok: true, value: { foodId: id, qty, price: total } };
};

/**
 * W17: manual fish feed (BR13.1, BR13.2). Stack -> portions -> target,
 * then the shared dispensing core. Rejections mutate nothing.
 */
export const feedFish: CommandHandler<FeedFishPayload, FeedFishResult> = (
  state,
  payload,
  ctx,
) => {
  const body = (payload as Partial<FeedFishPayload> | null) ?? {};
  const gated = checkStack(state, body.foodId, state.clock.gameDay);
  if ('error' in gated) return { ok: false, error: gated.error };
  const badPortions = checkPortions(body.portions);
  if (badPortions) return { ok: false, error: badPortions };
  if (gated.stack.target !== 'fish') {
    return { ok: false, error: { code: 'INVALID_SETTING', message: 'Fry food cannot feed fish.' } };
  }
  const result = dispenseToFish(state, ctx.events, gated.stack, body.portions as number);
  if (result === null) {
    return { ok: false, error: { code: 'NOT_AVAILABLE', message: 'That food is not available.' } };
  }
  return { ok: true, value: feedResult(result) };
};

/**
 * W19: fry feed (BR13.3). Stack -> portions -> target -> cohort, then
 * the shared fry core with day-idempotent U5 counters. Rejections
 * mutate nothing; eggs never eat (INVALID_SETTING).
 */
export const feedFry: CommandHandler<FeedFryPayload, FeedFryResult> = (
  state,
  payload,
  ctx,
) => {
  const body = (payload as Partial<FeedFryPayload> | null) ?? {};
  const gated = checkStack(state, body.foodId, state.clock.gameDay);
  if ('error' in gated) return { ok: false, error: gated.error };
  const badPortions = checkPortions(body.portions);
  if (badPortions) return { ok: false, error: badPortions };
  if (gated.stack.target !== 'fry') {
    return { ok: false, error: { code: 'INVALID_SETTING', message: 'Fish food cannot feed fry.' } };
  }
  const cohort = typeof body.cohortId === 'string' ? state.cohorts[body.cohortId] : undefined;
  if (cohort === undefined) {
    return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: `Unknown cohort '${String(body.cohortId)}'.` } };
  }
  if (cohort.stage === 'eggs') {
    return { ok: false, error: { code: 'INVALID_SETTING', message: 'Eggs do not eat.' } };
  }
  const result = dispenseToFry(state, ctx.events, gated.stack, cohort, body.portions as number);
  if (result === null) {
    return { ok: false, error: { code: 'NOT_AVAILABLE', message: 'That food is not available.' } };
  }
  return { ok: true, value: feedResult(result) };
};

/**
 * W18: program the auto-feeder (BR13.4). Clearing (null) always works;
 * setting needs the U2-installed device (NOT_AVAILABLE), fish-target
 * kinds (INVALID_SETTING), and positive numbers (INVALID_QUANTITY).
 * A new program pins lastRunHour to the creation absolute hour.
 */
export const setAutoFeeder: CommandHandler<SetAutoFeederPayload | null, SetAutoFeederResult> = (
  state,
  payload,
  _ctx,
) => {
  if (payload === null) {
    state.feeding.schedule = null;
    return { ok: true, value: { set: false } };
  }
  const body = (payload as Partial<SetAutoFeederPayload> | null) ?? {};
  if (!state.tank.equipment.autoFeeder.installed) {
    return { ok: false, error: { code: 'NOT_AVAILABLE', message: 'The auto-feeder is not installed.' } };
  }
  const valid = validateScheduleInput({
    foodKind: body.foodKind,
    portions: body.portions,
    intervalHours: body.intervalHours,
  });
  if (!valid.ok) {
    return {
      ok: false,
      error:
        valid.code === 'INVALID_QUANTITY'
          ? { code: 'INVALID_QUANTITY', message: 'Portions and intervalHours must be numbers >= 1.' }
          : { code: 'INVALID_SETTING', message: 'Only flakes and pellets can be auto-dispensed.' },
    };
  }
  state.feeding.schedule = makeSchedule(
    valid.value.foodKind,
    valid.value.portions,
    valid.value.intervalHours,
    absoluteHour(state),
  );
  return { ok: true, value: { set: true } };
};

export function registerCommands(registry: Registry): void {
  registry.registerCommand('feeding.buyFood', buyFood);
  registry.registerCommand('feeding.feedFish', feedFish);
  registry.registerCommand('feeding.feedFry', feedFry);
  registry.registerCommand('feeding.setAutoFeeder', setAutoFeeder);
}
