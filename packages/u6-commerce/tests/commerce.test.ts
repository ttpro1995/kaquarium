// commerce.test.ts — U6 business-logic Red phase (BR16–BR19).
// Atomic sell, bulk rules, fulfil precedence, expiry, cascade level-ups,
// mapper table, fishSick batch collapse, queue cap + dismiss.
import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  createKernel,
  type Fish,
  type Species,
} from '@aquarium/u1-sim-foundation';
import { register as registerCommerce } from '../src/index.js';
import { runCommerceTick } from '../src/commerce.js';
import { runNotifyTick } from '../src/commerce.js';
import { commerceNotificationMapper, enforceQueueCap } from '../src/notifications.js';
import { SELL_HEALTH_GATE } from '../src/pricing.js';
import { demandFor, ensureMarketEntry } from '../src/market.js';

function guppy(extra: Record<string, unknown> = {}): Species {
  const base: Species = {
    id: 'guppy',
    name: { en: 'Guppy' },
    archetype: 'livebearer',
    tier: 1,
    care: 3,
    buyPrice: 10,
    sellBase: 8,
    adultSizeCm: 5,
    lifespanDays: 365,
    maturityDays: 90,
    juvenileDays: 30,
    diet: { type: 'flake', firstFoodRequired: false },
    genes: {},
    palette: {},
    pattern: 'solid',
    fin: 'fan',
    schooling: 0.5,
    territorial: 0.2,
    layer: 'middle',
    tempRangeC: [24, 28],
  };
  return Object.assign(base, extra);
}

function adultFish(id: string, overrides: Partial<Fish> = {}): Fish {
  return {
    id,
    speciesId: 'guppy',
    tankId: 'tank-1',
    sex: 'female',
    stage: 'adult',
    ageDays: 100,
    sizeCm: 5,
    health: 90,
    satiety: 100,
    stress: 0,
    genome: {
      hue: [1, 0],
      pattern: [0, 1],
      tail: [1, 1],
      size: [0, 0],
      vigor: [1, 0],
    },
    stunted: false,
    value: 10,
    mature: true,
    ...overrides,
  };
}

function setup() {
  const species = guppy();
  const kernel = createKernel(11, { speciesFiles: [{ file: 'guppy.json', data: species }] });
  registerCommerce(kernel.registry);
  const seen: { kind: string; [k: string]: unknown }[][] = [];
  kernel.store.subscribe((events) => {
    seen.push(events as { kind: string; [k: string]: unknown }[]);
  });
  kernel.store.state.fish.a = adultFish('a');
  kernel.store.state.fish.b = adultFish('b');
  kernel.store.state.fish.sick = adultFish('sick', { health: SELL_HEALTH_GATE - 1 });
  return { kernel, species, seen };
}

describe('BR16.3 atomic sell (US6.1)', () => {
  it('sell removes the fish, pays the formula price, saturates demand, grants XP', () => {
    const { kernel, seen } = setup();
    const before = kernel.store.state.money;
    const demandBefore = demandFor(kernel.store.state, 'guppy');
    const outcome = kernel.dispatch('commerce.sellFish', { fishId: 'a' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(kernel.store.state.fish.a).toBeUndefined();
    expect(kernel.store.state.money).toBe(before + outcome.value.price);
    expect(demandFor(kernel.store.state, 'guppy')).toBeCloseTo(demandBefore * 0.97, 10);
    expect(kernel.store.state.progression.xp).toBe(Math.floor(outcome.value.price / 5));
    const kinds = seen.flat().map((e) => e.kind);
    expect(kinds).toContain('fishSold');
    expect(kinds.filter((k) => k === 'moneyChanged')).toHaveLength(1);
  });

  it('bulk skips sick, rejects unknown, dedupes, and rejects an empty list', () => {
    const { kernel } = setup();
    expect(kernel.dispatch('commerce.sellBulk', { fishIds: [] }).ok).toBe(false);
    const unknown = kernel.dispatch('commerce.sellBulk', { fishIds: ['a', 'nope'] });
    expect(unknown.ok).toBe(false);
    if (unknown.ok) throw new Error('unreachable');
    expect(unknown.error.code).toBe('UNKNOWN_ENTITY');
    expect(kernel.store.state.fish.a).toBeDefined();
    const bulk = kernel.dispatch('commerce.sellBulk', { fishIds: ['a', 'b', 'sick', 'a'] });
    expect(bulk.ok).toBe(true);
    if (!bulk.ok) return;
    expect(bulk.value).toEqual({ sold: 2, skipped: 1, total: expect.any(Number) as number });
    expect(kernel.store.state.fish.sick).toBeDefined();
    const empty = kernel.dispatch('commerce.sellBulk', { fishIds: ['sick'] });
    expect(empty.ok).toBe(false);
    if (empty.ok) throw new Error('unreachable');
    expect(empty.error.code).toBe('FISH_UNSELLABLE');
  });
});

describe('BR17.2 fulfil (US7.1)', () => {
  it('fulfil pays the premium, sets rep+1, grants XP, emits no fishSold and no saturation', () => {
    const { kernel, seen } = setup();
    kernel.store.state.orders.push({
      id: 'o1',
      speciesId: 'guppy',
      customer: 'hobbyist',
      quantity: 1,
      minHealth: 40,
      minSizeCm: 5,
      multiplier: 1.2,
      reward: 9,
      deadlineDay: 9,
      status: 'open',
    });
    const demandBefore = demandFor(kernel.store.state, 'guppy');
    const outcome = kernel.dispatch('orders.fulfil', { orderId: 'o1', fishIds: ['a'] });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.reward).toBeGreaterThan(0);
    expect(kernel.store.state.fish.a).toBeUndefined();
    expect(kernel.store.state.orders[0]?.status).toBe('fulfilled');
    expect(kernel.store.state.orders[0]?.reward).toBe(outcome.value.reward);
    expect(kernel.store.state.reputation).toBe(1);
    expect(demandFor(kernel.store.state, 'guppy')).toBeCloseTo(demandBefore, 10);
    const kinds = seen.flat().map((e) => e.kind);
    expect(kinds).toContain('orderFulfilled');
    expect(kinds).not.toContain('fishSold');
    expect(kernel.store.state.progression.xp).toBe(Math.floor(outcome.value.reward / 4));
  });

  it('fulfil precedence is UNKNOWN_ENTITY > FISH_UNSELLABLE > INVALID_SETTING', () => {
    const { kernel } = setup();
    kernel.store.state.orders.push({
      id: 'o1',
      speciesId: 'guppy',
      customer: 'hobbyist',
      quantity: 1,
      minHealth: 40,
      minSizeCm: 5,
      multiplier: 1.2,
      reward: 9,
      deadlineDay: 9,
      status: 'open',
    });
    const missing = kernel.dispatch('orders.fulfil', { orderId: 'nope', fishIds: ['a'] });
    expect(missing.ok).toBe(false);
    const sick = kernel.dispatch('orders.fulfil', { orderId: 'o1', fishIds: ['sick'] });
    expect(sick.ok).toBe(false);
    if (sick.ok) throw new Error('unreachable');
    expect(sick.error.code).toBe('FISH_UNSELLABLE');
    const count = kernel.dispatch('orders.fulfil', { orderId: 'o1', fishIds: ['a', 'b'] });
    expect(count.ok).toBe(false);
    if (count.ok) throw new Error('unreachable');
    expect(count.error.code).toBe('INVALID_SETTING');
    expect(kernel.store.state.fish.a).toBeDefined();
  });
});

describe('BR17.3 expiry + BR18.1 cascade (US7.1/US8.1)', () => {
  it('expiry marks expired, costs rep -2 floored at 0, and frees the slot', () => {
    const { kernel } = setup();
    kernel.store.state.reputation = 1;
    kernel.store.state.clock.gameDay = 10;
    kernel.store.state.orders.push({
      id: 'o1',
      speciesId: 'guppy',
      customer: 'hobbyist',
      quantity: 1,
      minHealth: 40,
      minSizeCm: 5,
      multiplier: 1.2,
      reward: 9,
      deadlineDay: 9,
      status: 'open',
    });
    kernel.store.state.clock.gameHour = 23;
    kernel.tick();
    const expired = kernel.store.state.orders.filter((o) => o.id === 'o1');
    expect(expired).toHaveLength(0);
    expect(kernel.store.state.reputation).toBe(0);
  });

  it('one award crossing both thresholds cascades L1 -> L3 with ascending levelUps', () => {
    const whale = guppy({ id: 'whale', sellBase: 800, buyPrice: 10, adultSizeCm: 5 });
    const kernel = createKernel(12, {
      speciesFiles: [
        { file: 'guppy.json', data: guppy() },
        { file: 'whale.json', data: whale },
      ],
    });
    registerCommerce(kernel.registry);
    const seen: { kind: string; [k: string]: unknown }[][] = [];
    kernel.store.subscribe((events) => {
      seen.push(events as { kind: string; [k: string]: unknown }[]);
    });
    kernel.store.state.fish.a = adultFish('a', { speciesId: 'whale', sizeCm: 5 });
    kernel.store.state.orders.push({
      id: 'o1',
      speciesId: 'whale',
      customer: 'collector',
      quantity: 1,
      minHealth: 40,
      minSizeCm: 0.1,
      multiplier: 1.5,
      reward: 9,
      deadlineDay: 9,
      status: 'open',
    });
    const outcome = kernel.dispatch('orders.fulfil', { orderId: 'o1', fishIds: ['a'] });
    expect(outcome.ok).toBe(true);
    const levels = seen
      .flat()
      .filter((e) => e.kind === 'levelUp')
      .map((e) => (e as unknown as { level: number }).level);
    expect(levels).toEqual([2, 3]);
    expect(kernel.store.state.progression.level).toBe(3);
  });
});

describe('BR19.2 mapper + notify system (US12.1)', () => {
  it('mapper table: deaths critical, markets warn, economy info, sick/money/away null', () => {
    const catalog = { get: () => undefined, all: () => [], size: 0 };
    expect(commerceNotificationMapper({ kind: 'fishDied', fishId: 'x', cause: 'oldAge' }, catalog)?.priority).toBe(
      'critical',
    );
    expect(commerceNotificationMapper({ kind: 'tankOvercrowded', bioload: 99, capacity: 20 }, catalog)?.priority).toBe(
      'warn',
    );
    expect(commerceNotificationMapper({ kind: 'orderExpired', orderId: 'o' }, catalog)?.priority).toBe('warn');
    expect(commerceNotificationMapper({ kind: 'foodOut', foodId: 'f' }, catalog)?.priority).toBe('warn');
    expect(commerceNotificationMapper({ kind: 'fishBought', fishId: 'x', speciesId: 'g', price: 1 }, catalog)?.priority).toBe(
      'info',
    );
    expect(commerceNotificationMapper({ kind: 'levelUp', level: 2 }, catalog)?.priority).toBe('info');
    expect(commerceNotificationMapper({ kind: 'fishSick', fishId: 'x', cause: 'waterQuality' }, catalog)).toBeNull();
    expect(commerceNotificationMapper({ kind: 'fishSpawned', fishId: 'x', speciesId: 'g', tankId: 't' }, catalog)).toBeNull();
    expect(commerceNotificationMapper({ kind: 'moneyChanged', delta: 1, balance: 2 }, catalog)).toBeNull();
  });

  it('one tick of sick events yields exactly one warn (singleton or batch)', () => {
    const state = createInitialState(5);
    const ctx = {
      state,
      tick: 1,
      now: { day: 1, hour: 5 },
      rng: { next: () => 0.5, nextInt: (a: number) => a, pick: <T>(items: readonly T[]): T => items[0] as T },
      species: { get: () => undefined, all: () => [], size: 0 },
      events: [{ kind: 'fishSick', fishId: 'solo', cause: 'waterQuality' }],
      catchUp: false,
    };
    runNotifyTick(ctx as never);
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]?.priority).toBe('warn');
    expect(state.notifications[0]?.subjectId).toBe('solo');
    state.notifications.length = 0;
    ctx.events.push(
      { kind: 'fishSick', fishId: 'two', cause: 'temperature' },
      { kind: 'fishSick', fishId: 'three', cause: 'waterQuality' },
    );
    runNotifyTick(ctx as never);
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]?.kind).toBe('fishSickBatch');
  });
});

describe('BR19.3 bounded queue (US12.1)', () => {
  it('past 100 drops info first, then warn, never critical; dismiss removes by id', () => {
    const state = createInitialState(5);
    for (let i = 0; i < 100; i++) {
      state.notifications.push({ id: `n${i}`, priority: 'info', kind: 'k', message: `${i}` });
    }
    state.notifications.push({ id: 'warn1', priority: 'warn', kind: 'k', message: 'w' });
    enforceQueueCap(state);
    expect(state.notifications).toHaveLength(100);
    expect(state.notifications[0]?.id).toBe('n1');
    for (let i = 0; i < 100; i++) {
      state.notifications.push({ id: `c${i}`, priority: 'critical', kind: 'k', message: `${i}` });
    }
    enforceQueueCap(state);
    expect(state.notifications.every((n) => n.priority === 'critical')).toBe(true);
  });

  it('dismiss removes one entry and leaves everything else untouched', () => {
    const { kernel } = setup();
    kernel.store.state.notifications.push({ id: 'n1', priority: 'info', kind: 'k', message: 'hi' });
    const missing = kernel.dispatch('notifications.dismiss', { notificationId: 'nope' });
    expect(missing.ok).toBe(false);
    const outcome = kernel.dispatch('notifications.dismiss', { notificationId: 'n1' });
    expect(outcome.ok).toBe(true);
    expect(kernel.store.state.notifications).toHaveLength(0);
    expect(kernel.store.state.money).toBe(100);
  });
});
