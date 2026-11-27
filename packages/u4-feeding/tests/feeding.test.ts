// feeding.test.ts — TDD Red (Step 6): feeding-phase dispensing (US3.2 AC3.2.1–AC3.2.2; BR13).
// Failing first: src/feeding.ts does not exist yet. Tests drive the
// dispensing core plus the u4.feeding system directly with hand-built
// contexts (U3 pattern); the bus wiring lands in commands.test.ts.
import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  createRng,
  MemoryCatalog,
  type Fish,
  type GameState,
  type SimEvent,
  type Species,
  type TickContext,
} from '@aquarium/u1-sim-foundation';
import {
  dispenseToFish,
  dispenseToFry,
  expirySweep,
  feedingSystem,
  runFeedingTick,
} from '../src/feeding.js';

function makeSpecies(): Species {
  return {
    id: 'guppy', name: { en: 'Guppy' }, archetype: 'livebearer', tier: 1, care: 3,
    buyPrice: 10, sellBase: 8, adultSizeCm: 5, lifespanDays: 365, maturityDays: 90,
    juvenileDays: 30, diet: { type: 'flake', firstFoodRequired: false }, genes: {},
    palette: {}, pattern: 'solid', fin: 'fan', schooling: 0.5, territorial: 0.2,
    layer: 'middle', tempRangeC: [24, 28],
  };
}

function makeFish(id: string, satiety: number): Fish {
  return {
    id, speciesId: 'guppy', tankId: 'tank-1', sex: 'male', stage: 'adult',
    ageDays: 100, sizeCm: 5, health: 90, satiety, stress: 0, genome: {},
    stunted: false, value: 10, mature: true,
  };
}

function flakesStack(id: string, qty: number, acquiredDay = 1) {
  return {
    id, kind: 'flakes', qty, quality: 0.7, shelfLifeDays: 0,
    acquiredDay, target: 'fish' as const,
  };
}

function ctxFor(state: GameState, events: SimEvent[], hour = 8): TickContext {
  return {
    state, tick: 1, now: { day: state.clock.gameDay, hour },
    rng: createRng(state.rngState), species: new MemoryCatalog([makeSpecies()]),
    events, catchUp: false,
  };
}

describe('manual fish dispensing (BR13.1)', () => {
  it('restores round(25 x quality) satiety in ascending-satiety order', () => {
    const state = createInitialState(21);
    state.fish.low = makeFish('low', 10);
    state.fish.high = makeFish('high', 90);
    const events: SimEvent[] = [];
    // Pellets: round(25 x 0.9) = 23 per portion.
    const stack = { id: 'p1', kind: 'pellets', qty: 2, quality: 0.9, shelfLifeDays: 0, acquiredDay: 1, target: 'fish' as const };
    const result = dispenseToFish(state, events, stack, 1);
    expect(result).toEqual({ eaten: 1, leftover: 0 });
    expect(state.fish.low?.satiety).toBe(33);
    expect(state.fish.high?.satiety).toBe(90);
    expect(stack.qty).toBe(1);
    expect(events).toEqual([{ kind: 'fed', foodId: 'p1', portion: 1 }]);
  });

  it('fills one fish to 100 before moving on, roster order on ties', () => {
    const state = createInitialState(22);
    state.fish.a = makeFish('a', 50);
    state.fish.b = makeFish('b', 50);
    const events: SimEvent[] = [];
    // Flakes: round(25 x 0.7) = 18; 3 portions: a 50->68->86->100(capped), b untouched.
    const stack = flakesStack('f1', 3);
    const result = dispenseToFish(state, events, stack, 3);
    expect(result).toEqual({ eaten: 3, leftover: 0 });
    expect(state.fish.a?.satiety).toBe(100);
    expect(state.fish.b?.satiety).toBe(50);
  });
});

describe('leftovers and depletion (BR13.2)', () => {
  it('uneaten portions become waste with an overfed event, clamped at 100', () => {
    const state = createInitialState(23);
    state.fish.full = makeFish('full', 100);
    state.tank.water.waste = 99;
    const events: SimEvent[] = [];
    const stack = flakesStack('f1', 4);
    const result = dispenseToFish(state, events, stack, 4);
    expect(result).toEqual({ eaten: 0, leftover: 4 });
    expect(state.tank.water.waste).toBe(100);
    expect(events).toContainEqual({ kind: 'fed', foodId: 'f1', portion: 0 });
    expect(events).toContainEqual({ kind: 'overfed', wasteDelta: 8 });
  });

  it('a depleted stack is removed and emits foodOut', () => {
    const state = createInitialState(24);
    state.food.f1 = flakesStack('f1', 2);
    state.fish.hungry = makeFish('hungry', 0);
    const events: SimEvent[] = [];
    const stack = state.food.f1;
    if (!stack) throw new Error('fixture missing');
    dispenseToFish(state, events, stack, 5);
    expect(state.food.f1).toBeUndefined();
    expect(events).toContainEqual({ kind: 'foodOut', foodId: 'f1' });
  });

  it('an expired stack never dispenses and leaves everything untouched', () => {
    const state = createInitialState(25);
    state.fish.hungry = makeFish('hungry', 0);
    const events: SimEvent[] = [];
    // liveFirst bought day 1, shelf 7: expired from day 9.
    const stack = {
      id: 'lf1', kind: 'liveFirst', qty: 3, quality: 1.0,
      shelfLifeDays: 7, acquiredDay: 1, target: 'fry' as const,
    };
    const result = dispenseToFish(state, events, stack, 2, 10);
    expect(result).toBeNull();
    expect(state.fish.hungry?.satiety).toBe(0);
    expect(stack.qty).toBe(3);
    expect(events).toHaveLength(0);
  });
});

describe('fry dispensing (BR13.3)', () => {
  function fryState() {
    const state = createInitialState(26);
    state.cohorts.c1 = {
      id: 'c1', speciesId: 'guppy', tankId: 'tank-1', bornDay: 1, count: 25,
      ageDays: 2, genomePool: {}, survivalFactor: 1, stage: 'fry' as const,
      firstFoodDays: 0, lastFryFedDay: 0,
    };
    return state;
  }

  function fryStack() {
    return {
      id: 'lf1', kind: 'liveFirst', qty: 9, quality: 1.0,
      shelfLifeDays: 7, acquiredDay: 1, target: 'fry' as const,
    };
  }

  it('eats 10 fry per portion and writes the U5 counters with day idempotency', () => {
    const state = fryState();
    const events: SimEvent[] = [];
    const stack = fryStack();
    const cohort = state.cohorts.c1;
    if (!cohort) throw new Error('fixture missing');
    // Need ceil(25/10) = 3; request 5 of 9 -> eaten 3, leftover 2.
    const result = dispenseToFry(state, events, stack, cohort, 5, 4);
    expect(result).toEqual({ eaten: 3, leftover: 2 });
    expect(stack.qty).toBe(4);
    expect(cohort.firstFoodDays).toBe(1);
    expect(cohort.lastFryFedDay).toBe(4);
    // Same-day repeat: counters unchanged.
    const again = dispenseToFry(state, events, stack, cohort, 1, 4);
    expect(again).toEqual({ eaten: 1, leftover: 0 });
    expect(cohort.firstFoodDays).toBe(1);
    // New day: increments again.
    dispenseToFry(state, events, stack, cohort, 1, 5);
    expect(cohort.firstFoodDays).toBe(2);
    expect(cohort.lastFryFedDay).toBe(5);
  });
});

describe('auto-feeder schedule runs (BR13.4)', () => {
  function feederState() {
    const state = createInitialState(27);
    state.tank.equipment.autoFeeder.installed = true;
    // Isolate the oldest-first pin: the BR12.4 starter ties old on
    // acquiredDay, so it steps aside and old/new decide the order.
    state.food = {};
    state.food.old = { ...flakesStack('old', 4, 1) };
    state.food.new = { ...flakesStack('new', 4, 3) };
    state.fish.hungry = makeFish('hungry', 10);
    // Program created at absolute hour 32 (day 1, hour 8), every 6 hours.
    state.feeding.schedule = { foodKind: 'flakes', portions: 2, intervalHours: 6, lastRunHour: 32 };
    return state;
  }

  it('runs once the interval elapses and advances lastRunHour to now', () => {
    const state = feederState();
    state.clock.gameDay = 1;
    state.clock.gameHour = 14; // absolute 38; 38 - 32 >= 6 due.
    const events: SimEvent[] = [];
    runFeedingTick(ctxFor(state, events, 14));
    expect(state.feeding.schedule?.lastRunHour).toBe(38);
    expect(state.fish.hungry?.satiety).toBeGreaterThan(10);
    expect(events.filter((e) => e.kind === 'fed')).toHaveLength(1);
    // Oldest stack drawn first.
    expect(state.food.old?.qty).toBe(2);
    expect(state.food.new?.qty).toBe(4);
  });

  it('never runs a backlog: a long gap still performs exactly one run', () => {
    const state = feederState();
    state.clock.gameDay = 3;
    state.clock.gameHour = 8; // absolute 80; many intervals overdue.
    const events: SimEvent[] = [];
    runFeedingTick(ctxFor(state, events, 8));
    expect(state.feeding.schedule?.lastRunHour).toBe(80);
    expect(events.filter((e) => e.kind === 'fed')).toHaveLength(1);
    expect(state.food.old?.qty).toBe(2);
  });

  it('skips silently with no usable stock: no events, schedule kept', () => {
    const state = feederState();
    state.food = {};
    state.clock.gameDay = 1;
    state.clock.gameHour = 14;
    const events: SimEvent[] = [];
    runFeedingTick(ctxFor(state, events, 14));
    expect(events).toHaveLength(0);
    expect(state.feeding.schedule).not.toBeNull();
    expect(state.feeding.schedule?.lastRunHour).toBe(32);
  });
});

describe('expiry sweep (BR12.3)', () => {
  it('emits foodOut once per stack whose last usable day was yesterday', () => {
    const state = createInitialState(28);
    state.clock.gameDay = 9;
    state.clock.gameHour = 0;
    state.food.lf = {
      id: 'lf', kind: 'liveFirst', qty: 3, quality: 1.0,
      shelfLifeDays: 7, acquiredDay: 1, target: 'fry',
    };
    const events: SimEvent[] = [];
    expirySweep(state, events, 9);
    expect(events).toEqual([{ kind: 'foodOut', foodId: 'lf' }]);
    // The stack stays listed (visible but expired).
    expect(state.food.lf?.qty).toBe(3);
  });

  it('the system sweep fires exactly once per day, not once per tick', () => {
    const state = createInitialState(29);
    state.clock.gameDay = 9;
    state.clock.gameHour = 0;
    state.food.lf = {
      id: 'lf', kind: 'liveFirst', qty: 3, quality: 1.0,
      shelfLifeDays: 7, acquiredDay: 1, target: 'fry',
    };
    const events: SimEvent[] = [];
    runFeedingTick(ctxFor(state, events, 0));
    runFeedingTick(ctxFor(state, events, 1));
    runFeedingTick(ctxFor(state, events, 2));
    expect(events.filter((e) => e.kind === 'foodOut')).toHaveLength(1);
    expect(feedingSystem.id).toBe('u4.feeding');
    expect(feedingSystem.phase).toBe('feeding');
  });
});

describe('single time authority (ctx.now)', () => {
  it('derives today and nowHour from ctx.now even when the clock lags', () => {
    const state = createInitialState(30);
    state.tank.equipment.autoFeeder.installed = true;
    state.food.old = { ...flakesStack('old', 4, 1) };
    state.fish.hungry = makeFish('hungry', 10);
    // Programmed at absolute hour 120 (day 5, hour 0), every 6 hours.
    state.feeding.schedule = { foodKind: 'flakes', portions: 2, intervalHours: 6, lastRunHour: 120 };
    // The stored clock lags a tick behind the dispatched context:
    // absoluteHour(state) is 5*24+3 = 123 (not due: 123-120 < 6).
    state.clock.gameDay = 5;
    state.clock.gameHour = 3;
    const events: SimEvent[] = [];
    // ctx.now says day 5, hour 9 -> 129 (due: 129-120 >= 6).
    const ctx: TickContext = {
      state, tick: 1, now: { day: 5, hour: 9 },
      rng: createRng(state.rngState), species: new MemoryCatalog([makeSpecies()]),
      events, catchUp: false,
    };
    runFeedingTick(ctx);
    expect(state.feeding.schedule?.lastRunHour).toBe(129);
    expect(events.filter((e) => e.kind === 'fed')).toHaveLength(1);
  });
});

describe('one fed per scheduled run (BR13.4)', () => {
  it('emits a single fed with the total eaten across every stack drawn', () => {
    const state = createInitialState(31);
    state.tank.equipment.autoFeeder.installed = true;
    // Isolate the multi-stack draw: the BR12.4 starter alone would cover
    // all four portions, so it steps aside for this aggregation pin.
    state.food = {};
    state.food.old = { ...flakesStack('old', 1, 1) };
    state.food.new = { ...flakesStack('new', 4, 3) };
    state.fish.hungry = makeFish('hungry', 10);
    // 4 portions: 1 from the oldest stack, 3 from the next.
    state.feeding.schedule = { foodKind: 'flakes', portions: 4, intervalHours: 6, lastRunHour: 0 };
    state.clock.gameDay = 1;
    state.clock.gameHour = 8;
    const events: SimEvent[] = [];
    runFeedingTick(ctxFor(state, events, 8));
    const fed = events.filter((e) => e.kind === 'fed');
    expect(fed).toHaveLength(1);
    // All four portions eaten (18 satiety each, one hungry fish).
    expect(fed[0]).toEqual({ kind: 'fed', foodId: 'old', portion: 4 });
    // The drained oldest stack still reports its own foodOut.
    expect(events).toContainEqual({ kind: 'foodOut', foodId: 'old' });
    expect(state.food.old).toBeUndefined();
    expect(state.food.new?.qty).toBe(1);
  });
});

describe('fry counters only count feeds that land (BR13.3)', () => {
  it('leaves firstFoodDays and lastFryFedDay untouched when nothing is eaten', () => {
    const state = createInitialState(32);
    state.cohorts.c0 = {
      id: 'c0', speciesId: 'guppy', tankId: 'tank-1', bornDay: 1, count: 0,
      ageDays: 2, genomePool: {}, survivalFactor: 1, stage: 'fry' as const,
      firstFoodDays: 0, lastFryFedDay: 0,
    };
    const events: SimEvent[] = [];
    const stack = flakesStack('lf1', 9, 1);
    // Live-first-shaped stack, zero fry: need is 0, so eaten is 0.
    const fryStack = { ...stack, kind: 'liveFirst', target: 'fry' as const, shelfLifeDays: 7 };
    const cohort = state.cohorts.c0;
    if (!cohort) throw new Error('fixture missing');
    const result = dispenseToFry(state, events, fryStack, cohort, 5, 4);
    expect(result).toEqual({ eaten: 0, leftover: 5 });
    expect(cohort.firstFoodDays).toBe(0);
    expect(cohort.lastFryFedDay).toBe(0);
  });
});
