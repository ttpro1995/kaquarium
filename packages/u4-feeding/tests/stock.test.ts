// stock.test.ts — TDD Red (Step 3): FoodItem stock + schedule state (FR3.1; BR12).
// Failing first: src/food.ts and src/schedule.ts do not exist yet.
import { describe, expect, it } from 'vitest';
import { createKernel } from '@aquarium/u1-sim-foundation';
import { START_DAY } from '@aquarium/u1-sim-foundation/state';
import { register } from '../src/index.js';
import { FOOD_CATALOG, isExpired, usableFoodStacks } from '../src/food.js';
import { absoluteHour, emptySchedule, validateScheduleInput } from '../src/schedule.js';

function setup() {
  const kernel = createKernel(11);
  register(kernel.registry);
  return kernel;
}

describe('food catalogue (BR12.1)', () => {
  it('pins three fixed kinds with quality, target, and expiry', () => {
    expect(FOOD_CATALOG.flakes).toEqual({ pricePerUnit: 2, quality: 0.7, shelfLifeDays: 0, target: 'fish' });
    expect(FOOD_CATALOG.pellets).toEqual({ pricePerUnit: 4, quality: 0.9, shelfLifeDays: 0, target: 'fish' });
    expect(FOOD_CATALOG.liveFirst).toEqual({ pricePerUnit: 6, quality: 1.0, shelfLifeDays: 7, target: 'fry' });
  });
});

describe('buyFood through the bus (BR12.2)', () => {
  it('appends one dated stack, deducts the stated total, and emits moneyChanged', () => {
    const kernel = setup();
    kernel.store.state.money = 100;
    const version = kernel.store.version;
    const outcome = kernel.dispatch('feeding.buyFood', { kind: 'flakes', qty: 5 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.price).toBe(10);
    expect(outcome.value.qty).toBe(5);
    expect(kernel.store.state.money).toBe(90);
    const stack = kernel.store.state.food[outcome.value.foodId];
    expect(stack).toMatchObject({
      kind: 'flakes', qty: 5, quality: 0.7, shelfLifeDays: 0,
      acquiredDay: 1, target: 'fish',
    });
    expect(kernel.store.version).toBe(version + 1);
  });

  it('rejects UNKNOWN_ENTITY for an unknown kind with no mutation', () => {
    const kernel = setup();
    const version = kernel.store.version;
    const outcome = kernel.dispatch('feeding.buyFood', { kind: 'pizza', qty: 1 });
    expect(outcome).toMatchObject({ ok: false, error: { code: 'UNKNOWN_ENTITY' } });
    expect(kernel.store.state.money).toBe(100);
    expect(Object.keys(kernel.store.state.food)).toEqual(['food-starter']);
    expect(kernel.store.version).toBe(version);
  });

  it('rejects INVALID_QUANTITY for qty < 1 with no mutation', () => {
    const kernel = setup();
    const version = kernel.store.version;
    expect(kernel.dispatch('feeding.buyFood', { kind: 'flakes', qty: 0 }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_QUANTITY' } });
    expect(kernel.store.state.money).toBe(100);
    expect(kernel.store.version).toBe(version);
  });

  it('rejects INSUFFICIENT_FUNDS below the total with no mutation', () => {
    const kernel = setup();
    kernel.store.state.money = 5;
    const version = kernel.store.version;
    const outcome = kernel.dispatch('feeding.buyFood', { kind: 'pellets', qty: 2 });
    expect(outcome).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_FUNDS' } });
    expect(kernel.store.state.money).toBe(5);
    expect(Object.keys(kernel.store.state.food)).toEqual(['food-starter']);
    expect(kernel.store.version).toBe(version);
  });
});

describe('expiry by game day (BR12.3)', () => {
  it('liveFirst expires 7 days after purchase: visible but never dispensed', () => {
    const kernel = setup();
    kernel.store.state.money = 100;
    const bought = kernel.dispatch('feeding.buyFood', { kind: 'liveFirst', qty: 4 });
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const stack = kernel.store.state.food[bought.value.foodId];
    expect(stack).toBeDefined();
    if (!stack) return;
    // Last usable day is acquiredDay + 7; the day after, it is expired.
    expect(isExpired(stack, 1 + 7)).toBe(false);
    expect(isExpired(stack, 1 + 7 + 1)).toBe(true);
    // Flakes never expire.
    expect(isExpired({
      id: 'x', kind: 'flakes', qty: 1, quality: 0.7,
      shelfLifeDays: 0, acquiredDay: 1, target: 'fish',
    }, 999)).toBe(false);
  });

  it('usableFoodStacks returns oldest-first non-expired stacks of the kind', () => {
    const kernel = setup();
    kernel.store.state.food.newer = {
      id: 'newer', kind: 'flakes', qty: 2, quality: 0.7,
      shelfLifeDays: 0, acquiredDay: 5, target: 'fish',
    };
    kernel.store.state.food.older = {
      id: 'older', kind: 'flakes', qty: 3, quality: 0.7,
      shelfLifeDays: 0, acquiredDay: 2, target: 'fish',
    };
    kernel.store.state.food.other = {
      id: 'other', kind: 'liveFirst', qty: 9, quality: 1.0,
      shelfLifeDays: 7, acquiredDay: 1, target: 'fry',
    };
    const usable = usableFoodStacks(kernel.store.state, 'flakes', 6);
    // The BR12.4 starter (acquiredDay 1) is the oldest of all.
    expect(usable.map((s) => s.id)).toEqual(['food-starter', 'older', 'newer']);
  });
});

describe('schedule state shape (BR13.4)', () => {
  it('starts empty and reports the absolute game-hour clock', () => {
    const kernel = setup();
    expect(kernel.store.state.feeding.schedule).toBeNull();
    expect(emptySchedule()).toBeNull();
    // day 1, hour 8 -> 1*24 + 8 = 32.
    expect(absoluteHour(kernel.store.state)).toBe(32);
  });
});

describe('BR12.4 starter stack (U1 bootstrap, U4 spec)', () => {
  it('lands one flakes stack of 10 with acquiredDay = START_DAY on every new save', () => {
    const kernel = setup();
    const state = kernel.store.state;
    expect(Object.keys(state.food)).toEqual(['food-starter']);
    expect(state.food['food-starter']).toMatchObject({
      id: 'food-starter',
      kind: 'flakes',
      qty: 10,
      acquiredDay: START_DAY,
    });
    expect(state.clock.gameDay).toBe(START_DAY);
  });

  it('mirrors the FOOD_CATALOG flakes row (quality, shelf life, target)', () => {
    const kernel = setup();
    const starter = kernel.store.state.food['food-starter'];
    expect(starter).toBeDefined();
    if (!starter) return;
    expect(starter).toMatchObject({
      quality: FOOD_CATALOG.flakes.quality,
      shelfLifeDays: FOOD_CATALOG.flakes.shelfLifeDays,
      target: FOOD_CATALOG.flakes.target,
    });
  });
});

describe('validateScheduleInput (BR13.4)', () => {
  it('accepts a well-formed fish-target program', () => {
    expect(validateScheduleInput({ foodKind: 'flakes', portions: 2, intervalHours: 6 })).toEqual({
      ok: true,
      value: { foodKind: 'flakes', portions: 2, intervalHours: 6 },
    });
  });

  it('rejects fractional portions as INVALID_QUANTITY', () => {
    expect(validateScheduleInput({ foodKind: 'flakes', portions: 1.5, intervalHours: 6 })).toEqual({
      ok: false,
      code: 'INVALID_QUANTITY',
    });
    expect(validateScheduleInput({ foodKind: 'flakes', portions: NaN, intervalHours: 6 })).toEqual({
      ok: false,
      code: 'INVALID_QUANTITY',
    });
  });

  it('rejects fry food and unknown kinds as INVALID_SETTING', () => {
    expect(validateScheduleInput({ foodKind: 'liveFirst', portions: 2, intervalHours: 6 })).toEqual({
      ok: false,
      code: 'INVALID_SETTING',
    });
    expect(validateScheduleInput({ foodKind: 'pizza', portions: 2, intervalHours: 6 })).toEqual({
      ok: false,
      code: 'INVALID_SETTING',
    });
  });
});
