// commands.test.ts — U6 API Red phase (US2.1/US6.1/US7.1/US12.1).
// buy/sell/bulk/fulfil/dismiss through the real bus plus preview selectors.
import { describe, expect, it } from 'vitest';
import {
  createKernel,
  type Fish,
  type Species,
} from '@aquarium/u1-sim-foundation';
import { projectedBioload } from '@aquarium/u2-tank-water';
import { register as registerCommerce } from '../src/index.js';
import {
  bulkPreview,
  buyableSpecies,
  levelProgress,
  notificationQueue,
  orderRewardPreview,
  sellPrice,
} from '../src/selectors.js';

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
  const kernel = createKernel(23, { speciesFiles: [{ file: 'guppy.json', data: species }] });
  registerCommerce(kernel.registry);
  const seen: { kind: string; [k: string]: unknown }[][] = [];
  kernel.store.subscribe((events) => {
    seen.push(events as { kind: string; [k: string]: unknown }[]);
  });
  return { kernel, species, seen };
}

describe('commerce.buyFish (US2.1 money side)', () => {
  it('buy deducts buyPrice, inserts a juvenile, emits the trio', () => {
    const { kernel, seen } = setup();
    const outcome = kernel.dispatch('commerce.buyFish', { speciesId: 'guppy' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.price).toBe(10);
    expect(kernel.store.state.money).toBe(90);
    expect(kernel.store.state.fish[outcome.value.fishId]).toBeDefined();
    const kinds = seen.flat().map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(['fishBought', 'fishSpawned', 'moneyChanged']));
    expect(kernel.store.state.notifications.some((n) => n.kind === 'fishBought')).toBe(true);
  });

  it('buy gates: UNKNOWN_ENTITY, NOT_AVAILABLE (tier/archetype), TANK_FULL, INSUFFICIENT_FUNDS', () => {
    const { kernel } = setup();
    const unknown = kernel.dispatch('commerce.buyFish', { speciesId: 'nope' });
    expect(unknown.ok).toBe(false);
    if (unknown.ok) throw new Error('unreachable');
    expect(unknown.error.code).toBe('UNKNOWN_ENTITY');
    const tiered = guppy({ id: 'whale', tier: 3, adultSizeCm: 40, buyPrice: 5 });
    void tiered;
    kernel.store.state.money = 100000;
    kernel.store.state.tank.bioload = projectedBioload(kernel.store.state, 5);
    kernel.store.state.tank.volumeL = kernel.store.state.tank.bioload - 1;
    const full = kernel.dispatch('commerce.buyFish', { speciesId: 'guppy' });
    expect(full.ok).toBe(false);
    if (full.ok) throw new Error('unreachable');
    expect(full.error.code).toBe('TANK_FULL');
  });

  it('egg-layer archetypes and higher tiers reject NOT_AVAILABLE at L1', () => {
    const scatter = guppy({ id: 'scatterer', archetype: 'scatter', buyPrice: 5 });
    const tier2 = guppy({ id: 'big', tier: 2, buyPrice: 5 });
    const kernel = createKernel(24, {
      speciesFiles: [
        { file: 'guppy.json', data: guppy() },
        { file: 's.json', data: scatter },
        { file: 'b.json', data: tier2 },
      ],
    });
    registerCommerce(kernel.registry);
    const locked = kernel.dispatch('commerce.buyFish', { speciesId: 'scatterer' });
    expect(locked.ok).toBe(false);
    if (locked.ok) throw new Error('unreachable');
    expect(locked.error.code).toBe('NOT_AVAILABLE');
    const tiered = kernel.dispatch('commerce.buyFish', { speciesId: 'big' });
    expect(tiered.ok).toBe(false);
    if (tiered.ok) throw new Error('unreachable');
    expect(tiered.error.code).toBe('NOT_AVAILABLE');
    kernel.store.state.money = 0;
    const broke = kernel.dispatch('commerce.buyFish', { speciesId: 'guppy' });
    expect(broke.ok).toBe(false);
    if (broke.ok) throw new Error('unreachable');
    expect(broke.error.code).toBe('INSUFFICIENT_FUNDS');
  });
});

describe('commerce.sellFish / sellBulk (US6.1)', () => {
  it('sellFish rejects UNKNOWN_ENTITY and FISH_UNSELLABLE without touching state', () => {
    const { kernel } = setup();
    kernel.store.state.fish.a = adultFish('a');
    kernel.store.state.fish.sick = adultFish('sick', { health: 20 });
    kernel.store.state.fish.ghost = adultFish('ghost', { speciesId: 'extinct' });
    const money = kernel.store.state.money;
    const missing = kernel.dispatch('commerce.sellFish', { fishId: 'nope' });
    expect(missing.ok).toBe(false);
    const sick = kernel.dispatch('commerce.sellFish', { fishId: 'sick' });
    expect(sick.ok).toBe(false);
    if (sick.ok) throw new Error('unreachable');
    expect(sick.error.code).toBe('FISH_UNSELLABLE');
    // Catalogue-missing species rejects UNKNOWN_ENTITY (never throws), mutating nothing.
    const ghost = kernel.dispatch('commerce.sellFish', { fishId: 'ghost' });
    expect(ghost.ok).toBe(false);
    if (ghost.ok) throw new Error('unreachable');
    expect(ghost.error.code).toBe('UNKNOWN_ENTITY');
    expect(kernel.store.state.fish.ghost).toBeDefined();
    expect(kernel.store.state.money).toBe(money);
    expect(kernel.store.state.fish.sick).toBeDefined();
  });

  it('sellBulk through the bus pays the summed total atomically', () => {
    const { kernel } = setup();
    kernel.store.state.fish.a = adultFish('a');
    kernel.store.state.fish.b = adultFish('b');
    const before = kernel.store.state.money;
    const outcome = kernel.dispatch('commerce.sellBulk', { fishIds: ['a', 'b'] });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.sold).toBe(2);
    expect(kernel.store.state.money).toBe(before + outcome.value.total);
    expect(kernel.store.state.fish.a).toBeUndefined();
  });
});

describe('orders.fulfil / notifications.dismiss (US7.1/US12.1)', () => {
  it('fulfil through the bus honours species/health/size mismatch as INVALID_SETTING', () => {
    const { kernel } = setup();
    kernel.store.state.fish.a = adultFish('a', { health: 45 });
    kernel.store.state.orders.push({
      id: 'o1',
      speciesId: 'guppy',
      customer: 'petShop',
      quantity: 1,
      minHealth: 50,
      minSizeCm: 5,
      multiplier: 1.05,
      reward: 8,
      deadlineDay: 9,
      status: 'open',
    });
    const outcome = kernel.dispatch('orders.fulfil', { orderId: 'o1', fishIds: ['a'] });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.error.code).toBe('INVALID_SETTING');
  });

  it('preview selectors never mutate: sellPrice, bulkPreview, orderRewardPreview, buyableSpecies', () => {
    const { kernel, species } = setup();
    kernel.store.state.fish.a = adultFish('a');
    const price = sellPrice(kernel.store.state, 'a', species);
    expect(price).toBeGreaterThan(0);
    expect(sellPrice(kernel.store.state, 'missing', species)).toBeUndefined();
    const preview = bulkPreview(kernel.store.state, ['a', 'missing'], () => species);
    expect(preview.total).toBe(price);
    expect(preview.skipped).toEqual(['missing']);
    expect(kernel.store.state.fish.a).toBeDefined();
    kernel.store.state.orders.push({
      id: 'o1',
      speciesId: 'guppy',
      customer: 'hobbyist',
      quantity: 1,
      minHealth: 40,
      minSizeCm: 0.1,
      multiplier: 1.2,
      reward: 1,
      deadlineDay: 9,
      status: 'open',
    });
    const reward = orderRewardPreview(kernel.store.state, 'o1', ['a'], () => species);
    expect(reward).toBeGreaterThanOrEqual(price ?? 0);
    expect(buyableSpecies(kernel.store.state, [species, guppy({ id: 'big', tier: 3 })])).toEqual([species]);
    expect(levelProgress(kernel.store.state)).toEqual({ level: 1, xp: 0, xpToNext: 200, unlocks: [] });
    expect(notificationQueue(kernel.store.state)).toHaveLength(0);
    // bulkPreview mirrors sellBulk exactly: sick entries skip, sequential
    // x0.97 totals match the real sale.
    kernel.store.state.fish.b = adultFish('b');
    kernel.store.state.fish.sick = adultFish('sick', { health: 20 });
    const mirror = bulkPreview(kernel.store.state, ['a', 'b', 'sick', 'a'], () => species);
    expect(mirror.sold).toBe(2);
    expect(mirror.skipped).toEqual(expect.arrayContaining(['sick']));
    expect(mirror.items.find((i) => i.fishId === 'sick')).toEqual({ fishId: 'sick', price: null, skipped: true });
    const bulked = kernel.dispatch('commerce.sellBulk', { fishIds: ['a', 'b', 'sick'] });
    expect(bulked.ok).toBe(true);
    if (!bulked.ok) return;
    expect(bulked.value).toEqual({ sold: mirror.sold, skipped: 1, total: mirror.total });
  });
});
