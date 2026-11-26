// tick.test.ts — TDD Red (Step 6): u3.fish system, W12 steps 2–7 (BR10).
import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  createRng,
  MemoryCatalog,
  type Fish,
  type GameState,
  type Species,
  type TickContext,
} from '@aquarium/u1-sim-foundation';
import type { Genome } from '../src/factories.js';
import { healthBand } from '../src/selectors.js';
import { fishSystem, runFishTick } from '../src/fish.js';

function makeSpecies(overrides: Partial<Species> = {}): Species {
  return {
    id: 'trop',
    name: { en: 'Tropical' },
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
    ...overrides,
  };
}

function flatGenome(): Genome {
  return { hue: [0, 0], pattern: [0, 0], tail: [0, 0], size: [0, 0], vigor: [0, 0] };
}

function makeFish(id: string, overrides: Partial<Fish> = {}): Fish {
  return {
    id,
    speciesId: 'trop',
    tankId: 'tank-1',
    sex: 'male',
    stage: 'adult',
    ageDays: 100,
    sizeCm: 5,
    health: 90,
    satiety: 80,
    stress: 0,
    genome: flatGenome(),
    stunted: false,
    value: 10,
    mature: true,
    ...overrides,
  };
}

function runFish(state: GameState, speciesList: Species[] = [makeSpecies()], catchUp = false) {
  const species = new MemoryCatalog(speciesList);
  const ctx: TickContext = {
    state,
    tick: 1,
    now: { day: state.clock.gameDay, hour: state.clock.gameHour },
    rng: createRng(state.rngState),
    species,
    events: [],
    catchUp,
  };
  runFishTick(ctx);
  return ctx.events;
}

describe('u3.fish system registration', () => {
  it('registers as u3.fish in the fish phase', () => {
    expect(fishSystem.id).toBe('u3.fish');
    expect(fishSystem.phase).toBe('fish');
  });
});

describe('u3.fish tick pass (W12, BR10)', () => {
  it('accrues ageDays by 1/24 per tick (step 2)', () => {
    const state = createInitialState(11);
    state.fish.f1 = makeFish('f1');
    runFish(state);
    expect(state.fish.f1?.ageDays).toBeCloseTo(100 + 1 / 24);
  });

  it('grows toward 95% of the adult target at maturityDays under ideal care (step 3, BR10.1)', () => {
    const state = createInitialState(11);
    state.tank.equipment.heater.installed = true; // holds tempC in range
    state.fish.f1 = makeFish('f1', {
      stage: 'juvenile',
      mature: false,
      ageDays: 0,
      sizeCm: 2,
      genome: { ...flatGenome(), size: [0, 1] }, // mult 1.0 → target 5
    });
    const species = [makeSpecies({ tempRangeC: [24, 28] as const })];
    const total = 90 * 24;
    for (let t = 0; t < total; t++) {
      state.fish.f1.satiety = 100; // perfect husbandry proxy (U4 feeding)
      state.tank.water.waste = 0;
      state.tank.water.nitrate = 0;
      const catalog = new MemoryCatalog(species);
      const ctx: TickContext = {
        state,
        tick: t + 1,
        now: { day: 1, hour: 0 },
        rng: createRng(state.rngState),
        species: catalog,
        events: [],
        catchUp: false,
      };
      runFishTick(ctx);
    }
    expect(state.fish.f1?.sizeCm).toBeGreaterThanOrEqual(0.94 * 5);
    expect(state.fish.f1?.sizeCm).toBeLessThanOrEqual(5);
  });

  it('stalls growth while starving: satiety 0 means condition 0 (step 3, Q1-A)', () => {
    const state = createInitialState(11);
    state.fish.f1 = makeFish('f1', { sizeCm: 2, satiety: 0 });
    runFish(state);
    expect(state.fish.f1?.sizeCm).toBe(2);
  });

  it('decays satiety by 100/48 per tick, floored at 0 (step 4, BR10.2)', () => {
    const state = createInitialState(11);
    state.fish.f1 = makeFish('f1', { satiety: 80 });
    state.fish.f2 = makeFish('f2', { satiety: 1 });
    runFish(state);
    expect(state.fish.f1?.satiety).toBeCloseTo(80 - 100 / 48);
    expect(state.fish.f2?.satiety).toBe(0);
  });

  it('regens +2 (+vigor) when fed-and-clean and reports stress 0 (step 5, BR10.3)', () => {
    const state = createInitialState(11);
    state.fish.f1 = makeFish('f1', { health: 50, genome: flatGenome() });
    state.fish.f2 = makeFish('f2', { health: 50, genome: { ...flatGenome(), vigor: [1, 1] } });
    runFish(state);
    expect(state.fish.f1?.health).toBeCloseTo(52);
    expect(state.fish.f1?.stress).toBe(0);
    expect(state.fish.f2?.health).toBeCloseTo(53);
  });

  it('applies stressor weights and mirrors the worst in stress (step 5, BR10.3)', () => {
    const state = createInitialState(11);
    state.tank.water.waste = 70; // quality 30 < 40 → water −3
    state.tank.water.tempC = 10; // fit 0 < 0.7 → temp −2
    state.tank.bioload = state.tank.volumeL + 1; // overcrowded → −1
    const species = [makeSpecies({ tempRangeC: [24, 28] as const })];
    state.fish.f1 = makeFish('f1', { health: 100, satiety: 10 }); // hunger −2, regen 0
    const events = runFish(state, species);
    expect(state.fish.f1?.health).toBeCloseTo(100 - (2 + 3 + 2 + 1));
    expect(state.fish.f1?.stress).toBe(25 * 3);
    expect(events.filter((e) => e.kind === 'fishDied')).toHaveLength(0);
  });

  it('bands health sick below 40 and critical below 15 (BR10.3)', () => {
    const state = createInitialState(11);
    state.fish.f1 = makeFish('f1', { health: 39.9, satiety: 100 });
    state.fish.f2 = makeFish('f2', { health: 14.9, satiety: 100 });
    runFish(state);
    // Regen lifts both by +2 in clean water; bands are pure functions of the number.
    expect(state.fish.f1?.health).toBeLessThan(42);
    expect(healthBand(39.9)).toBe('sick');
    expect(healthBand(14.9)).toBe('critical');
    expect(healthBand(40)).toBe('healthy');
  });

  it('transitions juvenile→adult at maturityDays and adult→senior at 70% lifespan with events (step 6, BR10.5)', () => {
    const state = createInitialState(11);
    state.fish.f1 = makeFish('f1', { stage: 'juvenile', mature: false, ageDays: 90 - 1 / 24 });
    state.fish.f2 = makeFish('f2', { stage: 'adult', mature: true, ageDays: 0.7 * 365 - 1 / 24 });
    const events = runFish(state);
    expect(state.fish.f1?.stage).toBe('adult');
    expect(state.fish.f1?.mature).toBe(true);
    expect(state.fish.f2?.stage).toBe('senior');
    expect(events).toContainEqual({ kind: 'fishMatured', fishId: 'f1', stage: 'adult' });
    expect(events).toContainEqual({ kind: 'fishMatured', fishId: 'f2', stage: 'senior' });
  });

  it('removes the 0-health fish with the dominant-stressor cause (step 7, BR10.4)', () => {
    const state = createInitialState(11);
    state.fish.starved = makeFish('starved', { health: 2, satiety: 0 });
    const events = runFish(state);
    expect(state.fish.starved).toBeUndefined();
    expect(events).toContainEqual({ kind: 'fishDied', fishId: 'starved', cause: 'starvation' });

    const state2 = createInitialState(11);
    state2.tank.water.waste = 70; // poor water, hunger inactive
    state2.fish.fouled = makeFish('fouled', { health: 2, satiety: 100 });
    const events2 = runFish(state2);
    expect(state2.fish.fouled).toBeUndefined();
    expect(events2).toContainEqual({ kind: 'fishDied', fishId: 'fouled', cause: 'waterQuality' });
  });

  it('ends fish exactly at lifespanDays; catchUp floors health at 10, skips neglect death, old age proceeds (BR10.6, BR10.7)', () => {
    const state = createInitialState(11);
    state.fish.old = makeFish('old', { ageDays: 365 - 1 / 24 });
    const events = runFish(state);
    expect(state.fish.old).toBeUndefined();
    expect(events).toContainEqual({ kind: 'fishDied', fishId: 'old', cause: 'oldAge' });

    const neglected = createInitialState(11);
    neglected.fish.hungry = makeFish('hungry', { health: 5, satiety: 0 });
    const catchEvents = runFish(neglected, [makeSpecies()], true);
    expect(neglected.fish.hungry?.health).toBe(10);
    expect(catchEvents.filter((e) => e.kind === 'fishDied')).toHaveLength(0);

    const aged = createInitialState(11);
    aged.fish.old = makeFish('old', { ageDays: 365 - 1 / 24 });
    const agedEvents = runFish(aged, [makeSpecies()], true);
    expect(aged.fish.old).toBeUndefined();
    expect(agedEvents).toContainEqual({ kind: 'fishDied', fishId: 'old', cause: 'oldAge' });
  });
});
