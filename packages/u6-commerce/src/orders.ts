// orders — BR17 order board upkeep, fulfil pricing, and expiry (W30–W32).
// Generation is rng-driven (species uniform over the buyable pool,
// customer from the level pool); fulfil pays the fulfil-time market value
// with the rep bonus and never saturates demand.
import type {
  GameState,
  Order,
  OrderCustomer,
  Species,
} from '@aquarium/u1-sim-foundation/state';
import type { Rng } from '@aquarium/u1-sim-foundation';
import { formulaPrice } from './pricing.js';

export interface CustomerParams {
  qty: readonly [number, number];
  minHealth: number;
  multiplier: number;
}

/** BR17.1 customer table: qty range / health gate / reward multiplier. */
export const CUSTOMER_PARAMS: Record<OrderCustomer, CustomerParams> = {
  hobbyist: { qty: [1, 2], minHealth: 40, multiplier: 1.2 },
  petShop: { qty: [3, 6], minHealth: 50, multiplier: 1.05 },
  collector: { qty: [1, 2], minHealth: 70, multiplier: 1.5 },
};

/** Collector joins the pool at L3 (BR18.2). */
export function customerPool(level: number): OrderCustomer[] {
  if (level >= 3) return ['hobbyist', 'petShop', 'collector'];
  return ['hobbyist', 'petShop'];
}

/** Board display estimate: floor(quantity x sellBase x multiplier). */
export function estimateReward(sellBase: number, quantity: number, multiplier: number): number {
  return Math.floor(quantity * sellBase * multiplier);
}

/**
 * Fulfil-time reward (BR17.2): floor(sum x multiplier x rep bonus) with
 * the bonus capped at +20% (reputation 10).
 */
export function fulfilReward(sumPrices: number, multiplier: number, reputation: number): number {
  const bonus = 1 + Math.min(Math.max(0, reputation), 10) * 0.02;
  return Math.floor(sumPrices * multiplier * bonus);
}

/** Minimum board depth (BR17.1). */
export const BOARD_MIN = 3;

/** Maximum board depth (BR17.1). */
export const BOARD_MAX = 6;

/** Extra-order chance while between min and max (BR17.1). */
export const BOARD_EXTRA_P = 0.25;

function nextOrderId(state: GameState, rng: Rng): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = `order-${rng.nextInt(0, 0xffffffff).toString(16).padStart(8, '0')}`;
    if (!state.orders.some((o) => o.id === id)) return id;
  }
  return `order-${state.clock.gameDay}-${state.orders.length}`;
}

/**
 * Build one board order (W30): species uniform over the buyable pool,
 * customer from the level pool, deadline today+3..today+7.
 * Null when no species is buyable (board waits for unlocks).
 */
export function generateOrder(
  state: GameState,
  rng: Rng,
  today: number,
  buyable: readonly Species[],
): Order | null {
  if (buyable.length === 0) return null;
  const species = rng.pick(buyable);
  const customer = rng.pick(customerPool(state.progression.level));
  const params = CUSTOMER_PARAMS[customer];
  const quantity = rng.nextInt(params.qty[0], params.qty[1]);
  return {
    id: nextOrderId(state, rng),
    speciesId: species.id,
    customer,
    quantity,
    minHealth: params.minHealth,
    minSizeCm: species.adultSizeCm,
    multiplier: params.multiplier,
    reward: estimateReward(species.sellBase, quantity, params.multiplier),
    deadlineDay: today + 3 + Math.floor(rng.next() * 5),
    status: 'open',
  };
}

/** Open orders on the board. */
export function openOrders(state: GameState): Order[] {
  return state.orders.filter((o) => o.status === 'open');
}

/**
 * Day-boundary upkeep (W30): top up to BOARD_MIN, then while below
 * BOARD_MAX one BOARD_EXTRA_P roll for a single extra. Counts the open
 * board once instead of re-filtering per check.
 */
export function upkeepBoard(
  state: GameState,
  rng: Rng,
  today: number,
  buyable: readonly Species[],
): void {
  let open = 0;
  for (const order of state.orders) {
    if (order.status === 'open') open++;
  }
  while (open < BOARD_MIN) {
    const order = generateOrder(state, rng, today, buyable);
    if (order === null) return;
    state.orders.push(order);
    open++;
  }
  if (open < BOARD_MAX && rng.next() < BOARD_EXTRA_P) {
    const order = generateOrder(state, rng, today, buyable);
    if (order === null) return;
    state.orders.push(order);
  }
}

/**
 * Day-boundary expiry (W32): open orders past deadline become expired,
 * reputation drops 2 floored at 0, one orderExpired each. Returns the
 * expired count for tests.
 */
export function expireOrders(
  state: GameState,
  today: number,
  events: { kind: string; [k: string]: unknown }[],
): number {
  let expired = 0;
  for (const order of state.orders) {
    if (order.status !== 'open' || today <= order.deadlineDay) continue;
    order.status = 'expired';
    state.reputation = Math.max(0, state.reputation - 2);
    events.push({ kind: 'orderExpired', orderId: order.id });
    expired++;
  }
  return expired;
}

/** Non-open orders leave the board at the same boundary (W32). */
export function pruneBoard(state: GameState): void {
  state.orders = state.orders.filter((o) => o.status === 'open');
}

export { formulaPrice };
