// commands — U6 command handlers (W26, W28, W31, W35).
// Each unit declares its command payloads/results by augmenting U1's
// CommandMap (type side) and registering the handler (runtime side).
// Handlers validate first, then mutate, then emit: a rejection leaves the
// store untouched by construction, never by rollback. Money moves only
// under the C2 purchase-path exception (validate-first, deduct-or-reject
// atomic, one moneyChanged per accepted call).
import type { Fish, GameState, Order } from '@aquarium/u1-sim-foundation/state';
import {
  declareCommandType,
  type CommandHandler,
} from '@aquarium/u1-sim-foundation/commands';
import type { Registry, SimEvent } from '@aquarium/u1-sim-foundation';
import { projectedBioload } from '@aquarium/u2-tank-water';
import { spawnFish } from '@aquarium/u3-fish';
import { demandFor, ensureMarketEntry, trendFor } from './market.js';
import { applySaleSaturation } from './market.js';
import { fulfilReward } from './orders.js';
import { addXp, xpForReward, xpForSale } from './progression.js';
import { isSellableHealth, priceForFish } from './pricing.js';
import './events.js';

export interface BuyFishPayload {
  speciesId: string;
}

export interface BuyFishResult {
  fishId: string;
  price: number;
}

export interface SellFishPayload {
  fishId: string;
}

export interface SellFishResult {
  price: number;
}

export interface SellBulkPayload {
  fishIds: string[];
}

export interface SellBulkResult {
  sold: number;
  skipped: number;
  total: number;
}

export interface FulfilPayload {
  orderId: string;
  fishIds: string[];
}

export interface FulfilResult {
  reward: number;
  reputation: number;
}

export interface DismissPayload {
  notificationId: string;
}

export interface DismissResult {
  removed: true;
}

declare module '@aquarium/u1-sim-foundation/commands' {
  interface CommandMap {
    'commerce.buyFish': { payload: BuyFishPayload; result: BuyFishResult };
    'commerce.sellFish': { payload: SellFishPayload; result: SellFishResult };
    'commerce.sellBulk': { payload: SellBulkPayload; result: SellBulkResult };
    'orders.fulfil': { payload: FulfilPayload; result: FulfilResult };
    'notifications.dismiss': { payload: DismissPayload; result: DismissResult };
  }
}

declareCommandType('commerce.buyFish');
declareCommandType('commerce.sellFish');
declareCommandType('commerce.sellBulk');
declareCommandType('orders.fulfil');
declareCommandType('notifications.dismiss');

function priceOf(state: GameState, fish: Fish, ctxSpecies: (id: string) => unknown): number | undefined {
  const species = ctxSpecies(fish.speciesId) as
    | import('@aquarium/u1-sim-foundation/state').Species
    | undefined;
  return priceForFish(fish, species, demandFor(state, fish.speciesId), trendFor(state, fish.speciesId));
}

/** Egg-layer gate: scatter/plant need L2+ (BR18.2). */
function eggLayerLocked(state: GameState, archetype: string): boolean {
  return (archetype === 'scatter' || archetype === 'plant') && state.progression.level < 2;
}

/**
 * W26 buy (BR16.5, BR18.2): UNKNOWN_ENTITY (unknown/unlisted) >
 * NOT_AVAILABLE (tier/archetype locks) > TANK_FULL (projectedBioload) >
 * INSUFFICIENT_FUNDS. Builds the juvenile via U3's pure spawnFish, then
 * deducts, inserts, and emits the trio fishBought + fishSpawned +
 * moneyChanged atomically.
 */
export const buyFish: CommandHandler<BuyFishPayload, BuyFishResult> = (state, payload, ctx) => {
  const speciesId = (payload as Partial<BuyFishPayload> | null)?.speciesId;
  if (typeof speciesId !== 'string' || speciesId.length === 0) {
    return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: `Unknown species '${String(speciesId)}'.` } };
  }
  const species = ctx.species.get(speciesId);
  if (species === undefined) {
    return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: `Unknown species '${speciesId}'.` } };
  }
  if (species.tier > state.progression.level || eggLayerLocked(state, species.archetype)) {
    return { ok: false, error: { code: 'NOT_AVAILABLE', message: `'${speciesId}' is not available yet.` } };
  }
  if (projectedBioload(state, species.adultSizeCm) > state.tank.volumeL) {
    return { ok: false, error: { code: 'TANK_FULL', message: 'The tank cannot hold another fish.' } };
  }
  if (state.money < species.buyPrice) {
    return { ok: false, error: { code: 'INSUFFICIENT_FUNDS', message: 'Not enough $FISH for that fish.' } };
  }
  const fish = spawnFish(state, species, ctx.rng);
  state.money -= species.buyPrice;
  state.fish[fish.id] = fish;
  ctx.events.push({ kind: 'fishBought', fishId: fish.id, speciesId: species.id, price: species.buyPrice });
  ctx.events.push({ kind: 'fishSpawned', fishId: fish.id, speciesId: species.id, tankId: fish.tankId });
  ctx.events.push({ kind: 'moneyChanged', delta: -species.buyPrice, balance: state.money });
  return { ok: true, value: { fishId: fish.id, price: species.buyPrice } };
};

/** Shared single-sale core: priced at live demand, saturated after. */
function sellOne(
  state: GameState,
  fish: Fish,
  events: SimEvent[],
  speciesOf: (id: string) => unknown,
): { price: number } {
  const price = priceOf(state, fish, speciesOf);
  if (price === undefined) throw new Error(`sellOne: UNKNOWN_ENTITY species '${fish.speciesId}'`);
  delete state.fish[fish.id];
  state.money += price;
  ensureMarketEntry(state, fish.speciesId, state.clock.gameDay);
  applySaleSaturation(state, fish.speciesId);
  events.push({ kind: 'fishSold', fishId: fish.id, price });
  addXp(state, events, xpForSale(price));
  return { price };
}

/**
 * W28 single sell (BR16.2, BR16.3): UNKNOWN_ENTITY > FISH_UNSELLABLE,
 * then remove/pay/saturate/XP with one fishSold + one moneyChanged.
 */
export const sellFish: CommandHandler<SellFishPayload, SellFishResult> = (state, payload, ctx) => {
  const fishId = (payload as Partial<SellFishPayload> | null)?.fishId;
  const fish = typeof fishId === 'string' ? state.fish[fishId] : undefined;
  if (fish === undefined) {
    return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: `Unknown fish '${String(fishId)}'.` } };
  }
  if (!isSellableHealth(fish.health)) {
    return { ok: false, error: { code: 'FISH_UNSELLABLE', message: 'That fish is too sick to sell.' } };
  }
  const speciesOf = (id: string): unknown => ctx.species.get(id);
  const { price } = sellOne(state, fish, ctx.events, speciesOf);
  ctx.events.push({ kind: 'moneyChanged', delta: price, balance: state.money });
  return { ok: true, value: { price } };
};

/**
 * W28 bulk sell (BR16.2, BR16.3): empty list -> INVALID_QUANTITY;
 * dedupe, then unknown ids -> UNKNOWN_ENTITY (strict); sick entries are
 * skipped and the eligible remainder proceeds (empty -> FISH_UNSELLABLE).
 * Saturation applies per fish sequentially; one moneyChanged for the total.
 */
export const sellBulk: CommandHandler<SellBulkPayload, SellBulkResult> = (state, payload, ctx) => {
  const fishIds = (payload as Partial<SellBulkPayload> | null)?.fishIds;
  if (!Array.isArray(fishIds) || fishIds.length === 0) {
    return { ok: false, error: { code: 'INVALID_QUANTITY', message: 'Bulk sale needs at least one fish.' } };
  }
  const deduped = [...new Set(fishIds)];
  for (const id of deduped) {
    if (typeof id !== 'string' || state.fish[id] === undefined) {
      return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: `Unknown fish '${String(id)}'.` } };
    }
  }
  const eligible = deduped.filter((id) => isSellableHealth((state.fish[id] as Fish).health));
  const skipped = deduped.length - eligible.length;
  if (eligible.length === 0) {
    return { ok: false, error: { code: 'FISH_UNSELLABLE', message: 'No eligible fish in the bulk sale.' } };
  }
  const speciesOf = (id: string): unknown => ctx.species.get(id);
  let total = 0;
  for (const id of eligible) {
    const fish = state.fish[id] as Fish;
    total += sellOne(state, fish, ctx.events, speciesOf).price;
  }
  ctx.events.push({ kind: 'moneyChanged', delta: total, balance: state.money });
  return { ok: true, value: { sold: eligible.length, skipped, total } };
};

function findOrder(state: GameState, orderId: string): Order | undefined {
  return state.orders.find((o) => o.id === orderId);
}

/**
 * W31 fulfil (BR17.2): precedence UNKNOWN_ENTITY (order, then any fish) >
 * FISH_UNSELLABLE (any health < 40) > INVALID_SETTING (closed order,
 * count/species/health/size mismatch). Removes the fish, pays the
 * fulfil-time premium (no saturation, no fishSold), rep +1, XP
 * floor(reward/4), emits orderFulfilled + moneyChanged.
 */
export const fulfil: CommandHandler<FulfilPayload, FulfilResult> = (state, payload, ctx) => {
  const body = (payload as Partial<FulfilPayload> | null) ?? {};
  const order = typeof body.orderId === 'string' ? findOrder(state, body.orderId) : undefined;
  if (order === undefined || !Array.isArray(body.fishIds)) {
    const missingOrder = typeof body.orderId === 'string' && findOrder(state, body.orderId) === undefined;
    if (missingOrder || typeof body.orderId !== 'string') {
      return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: `Unknown order '${String(body.orderId)}'.` } };
    }
    return { ok: false, error: { code: 'INVALID_SETTING', message: 'That order cannot be fulfilled.' } };
  }
  const deduped = [...new Set(body.fishIds)];
  for (const id of deduped) {
    if (typeof id !== 'string' || state.fish[id] === undefined) {
      return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: `Unknown fish '${String(id)}'.` } };
    }
  }
  for (const id of deduped) {
    if (!isSellableHealth((state.fish[id] as Fish).health)) {
      return { ok: false, error: { code: 'FISH_UNSELLABLE', message: 'That order needs healthy fish.' } };
    }
  }
  if (order.status !== 'open' || deduped.length !== order.quantity) {
    return { ok: false, error: { code: 'INVALID_SETTING', message: 'That order cannot be fulfilled.' } };
  }
  const speciesOf = (id: string): unknown => ctx.species.get(id);
  let sum = 0;
  for (const id of deduped) {
    const fish = state.fish[id] as Fish;
    if (fish.speciesId !== order.speciesId || fish.health < order.minHealth || fish.sizeCm < order.minSizeCm) {
      return { ok: false, error: { code: 'INVALID_SETTING', message: 'Those fish do not meet the order.' } };
    }
    const price = priceOf(state, fish, speciesOf);
    if (price === undefined) {
      return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: `Unknown species '${fish.speciesId}'.` } };
    }
    sum += price;
  }
  const reward = fulfilReward(sum, order.multiplier, state.reputation);
  for (const id of deduped) delete state.fish[id];
  state.money += reward;
  order.reward = reward;
  order.status = 'fulfilled';
  state.reputation += 1;
  ctx.events.push({ kind: 'orderFulfilled', orderId: order.id, reward });
  ctx.events.push({ kind: 'moneyChanged', delta: reward, balance: state.money });
  addXp(state, ctx.events, xpForReward(reward));
  return { ok: true, value: { reward, reputation: state.reputation } };
};

/** W35 dismiss (BR19.3): unknown ids reject; nothing else mutates. */
export const dismiss: CommandHandler<DismissPayload, DismissResult> = (state, payload, _ctx) => {
  const notificationId = (payload as Partial<DismissPayload> | null)?.notificationId;
  const index =
    typeof notificationId === 'string' ? state.notifications.findIndex((n) => n.id === notificationId) : -1;
  if (index < 0) {
    return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: `Unknown notification '${String(notificationId)}'.` } };
  }
  state.notifications.splice(index, 1);
  return { ok: true, value: { removed: true } };
};

export function registerCommands(registry: Registry): void {
  registry.registerCommand('commerce.buyFish', buyFish);
  registry.registerCommand('commerce.sellFish', sellFish);
  registry.registerCommand('commerce.sellBulk', sellBulk);
  registry.registerCommand('orders.fulfil', fulfil);
  registry.registerCommand('notifications.dismiss', dismiss);
}
