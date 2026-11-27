// selectors.test.ts — U4-owned pure readers for U7 panels (W18).
// foodStock lists every stack expiry-flagged; usableFood is the
// oldest-first dispensable order; feedingProgram pairs device + schedule.
import { describe, expect, it } from 'vitest';
import { createInitialState, createKernel } from '@aquarium/u1-sim-foundation';
import { register } from '../src/index.js';
import { feedingProgram, foodStock, usableFood } from '../src/selectors.js';
import { isExpired } from '../src/food.js';

function stocked() {
  const state = createInitialState(33);
  state.food.fresh = {
    id: 'fresh', kind: 'flakes', qty: 3, quality: 0.7,
    shelfLifeDays: 0, acquiredDay: 2, target: 'fish',
  };
  state.food.old = {
    id: 'old', kind: 'flakes', qty: 2, quality: 0.7,
    shelfLifeDays: 0, acquiredDay: 1, target: 'fish',
  };
  state.food.gone = {
    id: 'gone', kind: 'liveFirst', qty: 4, quality: 1.0,
    shelfLifeDays: 7, acquiredDay: 1, target: 'fry',
  };
  return state;
}

describe('U4 selectors for U7 panels', () => {
  it('foodStock lists every stack including expired flags', () => {
    const state = stocked();
    state.clock.gameDay = 20;
    // Insertion order: the BR12.4 starter lands first, then the fixture stacks.
    expect(foodStock(state).map((s) => s.id)).toEqual(['food-starter', 'fresh', 'old', 'gone']);
    expect(foodStock(state, 'flakes').map((s) => s.id)).toEqual(['food-starter', 'fresh', 'old']);
    const gone = state.food.gone;
    if (!gone) throw new Error('fixture missing');
    expect(isExpired(gone, 20)).toBe(true);
  });

  it('usableFood returns non-expired stacks oldest-first', () => {
    const state = stocked();
    state.clock.gameDay = 20;
    // Starter and old tie on acquiredDay 1; insertion order breaks the tie.
    expect(usableFood(state, 'flakes').map((s) => s.id)).toEqual(['food-starter', 'old', 'fresh']);
    expect(usableFood(state, 'liveFirst')).toEqual([]);
  });

  it('feedingProgram pairs device state with the schedule', () => {
    const state = stocked();
    expect(feedingProgram(state)).toEqual({ installed: false, schedule: null });
    state.tank.equipment.autoFeeder.installed = true;
    state.feeding.schedule = { foodKind: 'flakes', portions: 2, intervalHours: 6, lastRunHour: 32 };
    expect(feedingProgram(state)).toEqual({ installed: true, schedule: state.feeding.schedule });
  });

  it('the shared named-stack gate rejects a non-string food id with no mutation', () => {
    const kernel = createKernel(34);
    register(kernel.registry);
    kernel.store.state.money = 100;
    const version = kernel.store.version;
    expect(kernel.dispatch('feeding.feedFish', { foodId: 42 as unknown as string, portions: 1 }))
      .toMatchObject({ ok: false, error: { code: 'NOT_AVAILABLE' } });
    expect(kernel.store.state.money).toBe(100);
    expect(kernel.store.version).toBe(version);
  });
});
