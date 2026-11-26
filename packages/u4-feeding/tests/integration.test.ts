// integration.test.ts — U4 boundaries through the real U1 bus + registry
// with live U2 water and U3 fish state (never mocked): feeding lifts
// satiety so U3 growth resumes; overfeed waste flips the U2 band; the
// schedule replays identically across catch-up and live ticks.
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  createKernel,
  type Fish,
} from '@aquarium/u1-sim-foundation';
import { qualityBandOf } from '@aquarium/u2-tank-water';
import { growthCondition } from '@aquarium/u3-fish';
import { register as registerWater } from '@aquarium/u2-tank-water';
import { register as registerFish } from '@aquarium/u3-fish';
import { register as registerFeeding } from '../src/index.js';

function hungryFish(id: string): Fish {
  return {
    id, speciesId: 'guppy', tankId: 'tank-1', sex: 'female', stage: 'adult',
    ageDays: 100, sizeCm: 3, health: 90, satiety: 0, stress: 0, genome: {},
    stunted: false, value: 10, mature: true,
  };
}

function setup(seed = 41) {
  const kernel = createKernel(seed, {
    speciesFiles: [
      {
        file: 'guppy.json',
        data: {
          id: 'guppy', name: { en: 'Guppy' }, archetype: 'livebearer', tier: 1, care: 3,
          buyPrice: 10, sellBase: 8, adultSizeCm: 5, lifespanDays: 365, maturityDays: 90,
          juvenileDays: 30, diet: { type: 'flake', firstFoodRequired: false }, genes: {},
          palette: {}, pattern: 'solid', fin: 'fan', schooling: 0.5, territorial: 0.2,
          layer: 'middle', tempRangeC: [24, 28],
        },
      },
    ],
  });
  registerWater(kernel.registry);
  registerFish(kernel.registry);
  registerFeeding(kernel.registry);
  return kernel;
}

function stockFlakes(kernel: ReturnType<typeof setup>, qty = 10): string {
  kernel.store.state.money = 500;
  const bought = kernel.dispatch('feeding.buyFood', { kind: 'flakes', qty });
  if (!bought.ok) throw new Error('setup buy failed');
  return bought.value.foodId;
}

describe('feed -> satiety -> U3 growth (BR13.1 x BR10.1)', () => {
  it('a fed fish grows on the next fish tick while a starving twin stalls', () => {
    const kernel = setup();
    const foodId = stockFlakes(kernel);
    kernel.store.state.fish.fed = hungryFish('fed');
    kernel.store.state.fish.starved = hungryFish('starved');
    kernel.dispatch('feeding.feedFish', { foodId, portions: 4 });
    expect(kernel.store.state.fish.fed?.satiety).toBeGreaterThan(0);
    // Growth condition reads the fresh satiety: fed > 0, starved == 0.
    const state = kernel.store.state;
    const fedFish = state.fish.fed;
    const starvedFish = state.fish.starved;
    if (!fedFish || !starvedFish) throw new Error('fixture missing');
    expect(growthCondition(state, fedFish)).toBeGreaterThan(0);
    expect(growthCondition(state, starvedFish)).toBe(0);
    const fedBefore = fedFish.sizeCm;
    const starvedBefore = starvedFish.sizeCm;
    kernel.tick();
    expect(kernel.store.state.fish.fed?.sizeCm).toBeGreaterThan(fedBefore);
    expect(kernel.store.state.fish.starved?.sizeCm).toBe(starvedBefore);
  });
});

describe('overfeed -> waste -> U2 band flip (BR13.2 x BR8.1)', () => {
  it('leftover waste pushes fair water into poor', () => {
    const kernel = setup();
    const foodId = stockFlakes(kernel, 8);
    kernel.store.state.fish.full = { ...hungryFish('full'), satiety: 100 };
    kernel.store.state.tank.water.waste = 65;
    expect(qualityBandOf(65, 0)).toBe('fair');
    const outcome = kernel.dispatch('feeding.feedFish', { foodId, portions: 4 });
    expect(outcome).toEqual({ ok: true, value: { eaten: 0, leftover: 4, waste: 8 } });
    // Deposit lands first; the band flips on the next water tick.
    expect(qualityBandOf(kernel.store.state.tank.water.waste, 0)).toBe('poor');
    kernel.tick();
    expect(kernel.store.state.tank.biofilterMaturity).toBeGreaterThan(0);
  });
});

describe('schedule replays identically across catch-up (BR13.4)', () => {
  function programmed(seed: number) {
    const kernel = setup(seed);
    const foodId = stockFlakes(kernel, 40);
    kernel.store.state.tank.equipment.autoFeeder.installed = true;
    kernel.store.state.fish.a = { ...hungryFish('a'), satiety: 20 };
    kernel.store.state.fish.b = { ...hungryFish('b'), satiety: 40 };
    const set = kernel.dispatch('feeding.setAutoFeeder', { foodKind: 'flakes', portions: 2, intervalHours: 6 });
    if (!set.ok) throw new Error('setup program failed');
    return { kernel, foodId };
  }

  function snapshot(kernel: ReturnType<typeof setup>) {
    const state = kernel.store.state;
    const satiety: Record<string, number> = {};
    for (const id in state.fish) satiety[id] = state.fish[id]?.satiety ?? -1;
    // Clock speed/paused excluded: catch-up stops the clock by contract
    // (offline return); day/hour and every sim slice must still match.
    return canonicalJson({
      food: state.food,
      schedule: state.feeding.schedule,
      waste: state.tank.water.waste,
      satiety,
      day: state.clock.gameDay,
      hour: state.clock.gameHour,
    });
  }

  it('30 live ticks equal a 30-hour catch-up tick-for-tick', () => {
    const live = programmed(42);
    for (let i = 0; i < 30; i++) live.kernel.tick();
    const jumped = programmed(42);
    jumped.kernel.catchUp(30);
    expect(snapshot(jumped.kernel)).toBe(snapshot(live.kernel));
    // And the schedule actually fired along the way.
    expect(live.kernel.store.state.feeding.schedule?.lastRunHour).toBeGreaterThan(32);
  });
});
