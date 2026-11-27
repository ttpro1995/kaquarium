// commands.test.ts — TDD Red (Step 9): feeding commands + events (US3.1; C2 purchase-path).
// Failing first: feedFish/feedFry/setAutoFeeder are undeclared. The bus
// runs the real U1 drain; events are captured through a subscriber (U2 pattern).
import { describe, expect, it } from 'vitest';
import { createKernel, type Fish, type SimEvent } from '@aquarium/u1-sim-foundation';
import { register } from '../src/index.js';
import { WASTE_PER_PORTION } from '../src/food.js';

function setup() {
  const kernel = createKernel(31);
  register(kernel.registry);
  const seen: SimEvent[][] = [];
  kernel.store.subscribe((events) => {
    seen.push(events);
  });
  return { kernel, seen };
}

function hungryFish(id: string, satiety: number): Fish {
  return {
    id, speciesId: 'guppy', tankId: 'tank-1', sex: 'female', stage: 'adult',
    ageDays: 100, sizeCm: 5, health: 90, satiety, stress: 0, genome: {},
    stunted: false, value: 10, mature: true,
  };
}

function stocked(kernel: ReturnType<typeof setup>['kernel']) {
  kernel.store.state.money = 100;
  const bought = kernel.dispatch('feeding.buyFood', { kind: 'flakes', qty: 4 });
  expect(bought.ok).toBe(true);
  if (!bought.ok) throw new Error('setup buy failed');
  return bought.value.foodId;
}

describe('feeding commands through the bus (W16–W19)', () => {
  it('buyFood validates first: one moneyChanged per accepted call, atomic on reject', () => {
    const { kernel, seen } = setup();
    kernel.store.state.money = 100;
    const version = kernel.store.version;
    const outcome = kernel.dispatch('feeding.buyFood', { kind: 'pellets', qty: 3 });
    expect(outcome).toEqual({ ok: true, value: { foodId: expect.any(String), qty: 3, price: 12 } });
    expect(kernel.store.state.money).toBe(88);
    expect(kernel.store.version).toBe(version + 1);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual([{ kind: 'moneyChanged', delta: -12, balance: 88 }]);
  });

  it('feedFish dispenses, fills appetite-first, and emits the fed pair through the drain', () => {
    const { kernel, seen } = setup();
    const foodId = stocked(kernel);
    kernel.store.state.fish.low = hungryFish('low', 10);
    kernel.store.state.fish.high = hungryFish('high', 80);
    const outcome = kernel.dispatch('feeding.feedFish', { foodId, portions: 2 });
    // Flakes restore 18: low 10 -> 28 -> 46; high untouched.
    expect(outcome).toEqual({ ok: true, value: { eaten: 2, leftover: 0, waste: 0 } });
    expect(kernel.store.state.fish.low?.satiety).toBe(46);
    expect(kernel.store.state.fish.high?.satiety).toBe(80);
    expect(seen.flat()).toContainEqual({ kind: 'fed', foodId, portion: 2 });
    expect(seen.flat().some((e) => e.kind === 'overfed')).toBe(false);
  });

  it('feedFish leftovers become waste with overfed; depletion emits foodOut', () => {
    const { kernel, seen } = setup();
    const foodId = stocked(kernel);
    kernel.store.state.fish.full = hungryFish('full', 100);
    const outcome = kernel.dispatch('feeding.feedFish', { foodId, portions: 4 });
    expect(outcome).toEqual({ ok: true, value: { eaten: 0, leftover: 4, waste: 4 * WASTE_PER_PORTION } });
    expect(outcome.ok && outcome.value.waste).toBe(8);
    expect(kernel.store.state.tank.water.waste).toBe(4 * WASTE_PER_PORTION);
    expect(kernel.store.state.food[foodId]).toBeUndefined();
    expect(seen.flat()).toContainEqual({ kind: 'overfed', wasteDelta: 8 });
    expect(seen.flat()).toContainEqual({ kind: 'foodOut', foodId });
  });

  it('feedFish rejects an expired stack and a fry-target stack with no mutation', () => {
    const { kernel, seen } = setup();
    const foodId = stocked(kernel);
    kernel.store.state.money = 100;
    const fryBuy = kernel.dispatch('feeding.buyFood', { kind: 'liveFirst', qty: 2 });
    expect(fryBuy.ok).toBe(true);
    if (!fryBuy.ok) return;
    const fryId = fryBuy.value.foodId;
    // Age the flakes... flakes never expire, so expire the liveFirst instead.
    kernel.store.state.food[fryId] = {
      ...(kernel.store.state.food[fryId] as object),
      id: fryId, acquiredDay: 1,
    } as (typeof kernel.store.state.food)[string];
    kernel.store.state.clock.gameDay = 20;
    kernel.store.state.fish.hungry = hungryFish('hungry', 0);
    const batches = seen.length;
    const version = kernel.store.version;
    expect(kernel.dispatch('feeding.feedFish', { foodId: fryId, portions: 1 }))
      .toMatchObject({ ok: false, error: { code: 'NOT_AVAILABLE' } });
    // Fry food into a fish feed is the wrong target even when fresh.
    kernel.store.state.clock.gameDay = 1;
    expect(kernel.dispatch('feeding.feedFish', { foodId: fryId, portions: 1 }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_SETTING' } });
    // Missing stack is NOT_AVAILABLE (dryness path).
    expect(kernel.dispatch('feeding.feedFish', { foodId: 'food-deadbeef', portions: 1 }))
      .toMatchObject({ ok: false, error: { code: 'NOT_AVAILABLE' } });
    expect(kernel.store.state.fish.hungry?.satiety).toBe(0);
    expect(kernel.store.version).toBe(version);
    expect(seen.length).toBe(batches);
  });

  it('feedFry feeds 10 fry per portion and writes day-idempotent counters', () => {
    const { kernel, seen } = setup();
    kernel.store.state.money = 100;
    const bought = kernel.dispatch('feeding.buyFood', { kind: 'liveFirst', qty: 6 });
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const foodId = bought.value.foodId;
    kernel.store.state.cohorts.c1 = {
      id: 'c1', speciesId: 'guppy', tankId: 'tank-1', bornDay: 1, count: 25,
      ageDays: 2, genomePool: {}, survivalFactor: 1, stage: 'fry',
      firstFoodDays: 0, lastFryFedDay: 0,
    };
    const outcome = kernel.dispatch('feeding.feedFry', { foodId, cohortId: 'c1', portions: 5 });
    expect(outcome).toEqual({ ok: true, value: { eaten: 3, leftover: 2, waste: 4 } });
    expect(kernel.store.state.cohorts.c1?.firstFoodDays).toBe(1);
    expect(kernel.store.state.cohorts.c1?.lastFryFedDay).toBe(1);
    // Same-day repeat leaves the counters unchanged.
    kernel.dispatch('feeding.feedFry', { foodId, cohortId: 'c1', portions: 1 });
    expect(kernel.store.state.cohorts.c1?.firstFoodDays).toBe(1);
    expect(seen.flat()).toContainEqual({ kind: 'fed', foodId, portion: 3 });
  });

  it('feedFry rejects eggs, fish food, and unknown cohorts', () => {
    const { kernel } = setup();
    const foodId = stocked(kernel);
    kernel.store.state.cohorts.eggs = {
      id: 'eggs', speciesId: 'guppy', tankId: 'tank-1', bornDay: 1, count: 40,
      ageDays: 0, genomePool: {}, survivalFactor: 1, stage: 'eggs',
      firstFoodDays: 0, lastFryFedDay: 0,
    };
    kernel.store.state.money = 100;
    const fryBuy = kernel.dispatch('feeding.buyFood', { kind: 'liveFirst', qty: 2 });
    if (!fryBuy.ok) return;
    const fryId = fryBuy.value.foodId;
    expect(kernel.dispatch('feeding.feedFry', { foodId: fryId, cohortId: 'eggs', portions: 1 }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_SETTING' } });
    expect(kernel.dispatch('feeding.feedFry', { foodId, cohortId: 'eggs', portions: 1 }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_SETTING' } });
    expect(kernel.dispatch('feeding.feedFry', { foodId: fryId, cohortId: 'nope', portions: 1 }))
      .toMatchObject({ ok: false, error: { code: 'UNKNOWN_ENTITY' } });
    expect(kernel.store.state.cohorts.eggs?.firstFoodDays).toBe(0);
  });

  it('setAutoFeeder needs the device, validates the program, and clears on empty', () => {
    const { kernel } = setup();
    // No device -> NOT_AVAILABLE.
    expect(kernel.dispatch('feeding.setAutoFeeder', { foodKind: 'flakes', portions: 2, intervalHours: 6 }))
      .toMatchObject({ ok: false, error: { code: 'NOT_AVAILABLE' } });
    kernel.store.state.tank.equipment.autoFeeder.installed = true;
    // Fry food never auto-dispenses; non-positive numbers are not programs.
    expect(kernel.dispatch('feeding.setAutoFeeder', { foodKind: 'liveFirst', portions: 2, intervalHours: 6 }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_SETTING' } });
    expect(kernel.dispatch('feeding.setAutoFeeder', { foodKind: 'flakes', portions: 0, intervalHours: 6 }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_QUANTITY' } });
    const set = kernel.dispatch('feeding.setAutoFeeder', { foodKind: 'flakes', portions: 2, intervalHours: 6 });
    expect(set).toEqual({ ok: true, value: { set: true } });
    // Creation pins lastRunHour to the absolute clock (day 1, hour 8 -> 32).
    expect(kernel.store.state.feeding.schedule).toMatchObject({
      foodKind: 'flakes', portions: 2, intervalHours: 6, lastRunHour: 32,
    });
    const cleared = kernel.dispatch('feeding.setAutoFeeder', null);
    expect(cleared).toEqual({ ok: true, value: { set: false } });
    expect(kernel.store.state.feeding.schedule).toBeNull();
  });

  it('setAutoFeeder rejects fractional portions as INVALID_QUANTITY with no mutation', () => {
    const { kernel } = setup();
    kernel.store.state.tank.equipment.autoFeeder.installed = true;
    const version = kernel.store.version;
    expect(kernel.dispatch('feeding.setAutoFeeder', { foodKind: 'flakes', portions: 1.5, intervalHours: 6 }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_QUANTITY' } });
    expect(kernel.dispatch('feeding.setAutoFeeder', { foodKind: 'flakes', portions: NaN, intervalHours: 6 }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_QUANTITY' } });
    expect(kernel.store.state.feeding.schedule).toBeNull();
    expect(kernel.store.version).toBe(version);
  });

  it('buyFood draws the food id from the seeded stream: same seed, same id', () => {
    const first = setup();
    const second = setup();
    first.kernel.store.state.money = 100;
    second.kernel.store.state.money = 100;
    const a = first.kernel.dispatch('feeding.buyFood', { kind: 'flakes', qty: 1 });
    const b = second.kernel.dispatch('feeding.buyFood', { kind: 'flakes', qty: 1 });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.foodId).toBe(b.value.foodId);
    expect(a.value.foodId).not.toBe('food-starter');
  });

  it('moneyChanged carries exactly the shared { delta, balance } payload shape', () => {
    const { kernel, seen } = setup();
    kernel.store.state.money = 100;
    const outcome = kernel.dispatch('feeding.buyFood', { kind: 'pellets', qty: 3 });
    expect(outcome.ok).toBe(true);
    expect(seen).toHaveLength(1);
    const event = seen[0]?.[0] as unknown as Record<string, unknown>;
    expect(event?.kind).toBe('moneyChanged');
    expect(Object.keys(event ?? {}).sort()).toEqual(['balance', 'delta', 'kind']);
    expect(event).toEqual({ kind: 'moneyChanged', delta: -12, balance: 88 });
  });
});
