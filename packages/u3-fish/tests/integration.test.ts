// integration.test.ts — U3 boundaries through the real U1 bus + registry
// with live U2 water state (never mocked): poor water drags health down
// and opens the U2 fishSick episode; starvation ends in a named death;
// a fixed-seed scripted replay pins birth-death-maturity golden.
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  createKernel,
  createRng,
  MemoryCatalog,
  type Fish,
  type SimEvent,
  type Species,
  type TickContext,
} from '@aquarium/u1-sim-foundation';
import { register as registerWater } from '@aquarium/u2-tank-water';
import { register as registerFish } from '../src/index.js';
import { spawnFish } from '../src/factories.js';
import { runFishTick } from '../src/fish.js';

function makeSpecies(overrides: Partial<Species> = {}): Species {
  return {
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
    ...overrides,
  };
}

function setup() {
  const kernel = createKernel(77, {
    speciesFiles: [{ file: 'guppy.json', data: makeSpecies() }],
  });
  registerWater(kernel.registry);
  registerFish(kernel.registry);
  const seen: SimEvent[][] = [];
  kernel.store.subscribe((events) => {
    seen.push(events);
  });
  return { kernel, seen };
}

describe('fish + water boundary (live U2 state, real bus)', () => {
  it('poor water drags health down and opens the fishSick episode with a named cause', () => {
    const { kernel, seen } = setup();
    kernel.store.state.fish.f1 = {
      id: 'f1', speciesId: 'guppy', tankId: 'tank-1', sex: 'female', stage: 'adult',
      ageDays: 100, sizeCm: 5, health: 90, satiety: 80, stress: 0, genome: {},
      stunted: false, value: 10, mature: true,
    };
    kernel.store.state.tank.water.waste = 80; // peak 80 → poor on the first water pass
    const healthBefore = kernel.store.state.fish.f1.health;
    kernel.tick();
    const flat = seen.flat();
    expect(flat).toContainEqual({ kind: 'fishSick', fishId: 'f1', cause: 'waterQuality' });
    expect(kernel.store.state.fish.f1?.health).toBeLessThan(healthBefore);
    // Sustained poor water is silent on the episode edge but keeps costing health.
    const batches = seen.length;
    kernel.tick();
    expect(kernel.store.state.fish.f1?.health).toBeLessThan(healthBefore);
    expect(seen.length).toBe(batches + 1); // drain still runs; no new fishSick edge
    expect(seen.flat().filter((e) => e.kind === 'fishSick')).toHaveLength(1);
  });

  it('starvation ends in a named death delivered through the bus drain', () => {
    const { kernel, seen } = setup();
    kernel.store.state.fish.doomed = {
      id: 'doomed', speciesId: 'guppy', tankId: 'tank-1', sex: 'male', stage: 'adult',
      ageDays: 100, sizeCm: 5, health: 1, satiety: 0, stress: 50, genome: {},
      stunted: false, value: 10, mature: true,
    };
    kernel.tick();
    expect(kernel.store.state.fish.doomed).toBeUndefined();
    expect(seen.flat()).toContainEqual({ kind: 'fishDied', fishId: 'doomed', cause: 'starvation' });
  });

  it('the fish system never writes the Tank: tank snapshot identical across its pass', () => {
    const { kernel } = setup();
    kernel.store.state.fish.f1 = {
      id: 'f1', speciesId: 'guppy', tankId: 'tank-1', sex: 'female', stage: 'adult',
      ageDays: 100, sizeCm: 5, health: 90, satiety: 80, stress: 0, genome: {},
      stunted: false, value: 10, mature: true,
    };
    const tankBefore = canonicalJson(kernel.store.state.tank);
    const ctx: TickContext = {
      state: kernel.store.state,
      tick: 1,
      now: { day: 1, hour: 8 },
      rng: createRng(kernel.store.state.rngState),
      species: kernel.species,
      events: [],
      catchUp: false,
    };
    runFishTick(ctx);
    expect(canonicalJson(kernel.store.state.tank)).toBe(tankBefore);
  });
});

describe('golden replay: birth, maturity, old-age death on a fixed seed', () => {
  // Short-lived species compresses a lifespan into 130 ticks: maturity at
  // 2 days (48 ticks), senior at 70% of 5 days (84 ticks), old age at 120.
  const quick: Species = makeSpecies({ id: 'quick', maturityDays: 2, lifespanDays: 5, juvenileDays: 1 });

  function replay(seed: number): { events: SimEvent[]; fishJson: string } {
    const kernel = createKernel(seed, { speciesFiles: [{ file: 'quick.json', data: quick }] });
    registerWater(kernel.registry);
    registerFish(kernel.registry);
    const collected: SimEvent[] = [];
    kernel.store.subscribe((events) => {
      collected.push(...events);
    });
    const rng = createRng(kernel.store.state.rngState);
    const a = spawnFish(kernel.store.state, quick, rng);
    const b = spawnFish(kernel.store.state, quick, rng);
    kernel.store.state.fish[a.id] = { ...a, ageDays: 0 };
    kernel.store.state.fish[b.id] = { ...b, ageDays: 4.9 }; // dies of old age almost at once
    for (let t = 0; t < 130; t++) {
      // Harness plays U4's feeding role for A only: B is left to the water.
      const fa: Fish | undefined = kernel.store.state.fish[a.id];
      if (fa !== undefined) fa.satiety = 100;
      kernel.tick();
    }
    return { events: collected, fishJson: canonicalJson(kernel.store.state.fish) };
  }

  it('replays identically from the seed and closes both lifespans', () => {
    const first = replay(1234);
    const second = replay(1234);
    expect(second.fishJson).toBe(first.fishJson);
    expect(second.events).toEqual(first.events);
    expect(first.fishJson).toBe('{}');
    const kinds = first.events.map((e) => `${e.kind}:${(e as { cause?: string; stage?: string }).cause ?? (e as { stage?: string }).stage ?? ''}`);
    // B starts at 4.9 days past both thresholds, so its two transitions
    // fire on the first tick before its old-age death at ~tick 3.
    expect(kinds).toEqual([
      'fishMatured:adult',
      'fishMatured:senior',
      'fishDied:oldAge',
      'fishMatured:adult',
      'fishMatured:senior',
      'fishDied:oldAge',
    ]);
  });
});
