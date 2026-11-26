// water.test.ts — TDD Red (Step 6): u2.water system + selectors (W7, BR8.1–BR8.3, BR8.5–BR8.6).
import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  createRng,
  emptyCatalog,
  MemoryCatalog,
  type Fish,
  type GameState,
  type Species,
  type TickContext,
} from '@aquarium/u1-sim-foundation';
import {
  waterSystem,
  tankWater,
  waterQuality,
  capacity,
  projectedBioload,
  bioloadOf,
  tempFitFor,
} from '../src/water.js';

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
    genome: {},
    stunted: false,
    value: 10,
    mature: true,
    ...overrides,
  };
}

function runWater(state: GameState, speciesList: Species[] = [makeSpecies()]) {
  const species = speciesList.length > 0 ? new MemoryCatalog(speciesList) : emptyCatalog();
  const ctx: TickContext = {
    state,
    tick: 1,
    now: { day: state.clock.gameDay, hour: state.clock.gameHour },
    rng: createRng(state.rngState),
    species,
    events: [],
    catchUp: false,
  };
  waterSystem.run(ctx);
  return ctx.events;
}

describe('u2.water system (W7)', () => {
  it('accumulates waste from bioload (adultSizeCm x satiety activity)', () => {
    const state = createInitialState(3);
    state.fish.f1 = makeFish('f1'); // 5cm x 1.2 = 6 load
    runWater(state);
    expect(state.tank.bioload).toBeCloseTo(6);
    expect(state.tank.water.waste).toBeCloseTo(6 * 0.02);
    expect(state.tank.water.nitrate).toBe(0);
  });

  it('counts feeding deposits in full and converts waste to nitrate at capacity x maturity', () => {
    const state = createInitialState(3);
    state.tank.water.waste = 4; // U4 feeding deposit lands before the water phase
    state.tank.biofilterMaturity = 1; // cycled filter converts 2 x 1 = 2
    runWater(state, []);
    expect(state.tank.water.waste).toBe(2);
    expect(state.tank.water.nitrate).toBe(1);
  });

  it('a new filter converts nothing and matures 1/240 per tick (~10 game-days)', () => {
    const state = createInitialState(3);
    state.tank.water.waste = 10;
    expect(state.tank.biofilterMaturity).toBe(0);
    runWater(state, []);
    expect(state.tank.water.waste).toBe(10);
    expect(state.tank.biofilterMaturity).toBeCloseTo(1 / 240);
    state.tank.biofilterMaturity = 1 - 1 / 240;
    runWater(state, []);
    expect(state.tank.biofilterMaturity).toBeLessThanOrEqual(1);
  });

  it('overcrowding doubles waste and emits tankOvercrowded once per episode', () => {
    const state = createInitialState(3);
    for (let i = 0; i < 5; i++) state.fish[`f${i}`] = makeFish(`f${i}`); // 5 x 6 = 30 > 20
    const first = runWater(state);
    expect(state.tank.bioload).toBeCloseTo(30);
    expect(state.tank.water.waste).toBeCloseTo(30 * 0.02 * 2);
    expect(first.filter((e) => e.kind === 'tankOvercrowded')).toHaveLength(1);
    const second = runWater(state);
    expect(second.filter((e) => e.kind === 'tankOvercrowded')).toHaveLength(0);
    // back within capacity re-arms the episode
    state.fish = {};
    runWater(state);
    expect(state.tank.overcrowdLatch).toBe(false);
    for (let i = 0; i < 5; i++) state.fish[`f${i}`] = makeFish(`f${i}`);
    const third = runWater(state);
    expect(third.filter((e) => e.kind === 'tankOvercrowded')).toHaveLength(1);
  });

  it('heater holds 26C while ambient drifts toward 22C, clamped 10..35', () => {
    const heated = createInitialState(3);
    heated.tank.water.tempC = 22;
    heated.tank.equipment.heater.installed = true;
    runWater(heated, []);
    expect(heated.tank.water.tempC).toBeCloseTo(22.8);

    const ambient = createInitialState(4);
    ambient.tank.water.tempC = 26;
    runWater(ambient, []);
    expect(ambient.tank.water.tempC).toBeCloseTo(25.2);

    const clamped = createInitialState(5);
    clamped.tank.water.tempC = 40;
    runWater(clamped, []);
    expect(clamped.tank.water.tempC).toBe(35);
  });

  it('a newly poor band emits fishSick per fish once; sustained poor is silent; prevQualityBand tracks', () => {
    const state = createInitialState(3);
    state.fish.f1 = makeFish('f1');
    state.tank.water.waste = 70;
    const first = runWater(state);
    expect(first.filter((e) => e.kind === 'fishSick')).toHaveLength(1);
    expect(state.tank.prevQualityBand).toBe('poor');
    const second = runWater(state);
    expect(second.filter((e) => e.kind === 'fishSick')).toHaveLength(0);
    // recovery then relapse re-arms the edge
    state.tank.water.waste = 10;
    runWater(state);
    expect(state.tank.prevQualityBand).toBe('good');
    state.tank.water.waste = 70;
    expect(runWater(state).filter((e) => e.kind === 'fishSick')).toHaveLength(1);
  });

  it('temperature episode emits cause temperature once; late arrivals silent; empty tank clears', () => {
    const state = createInitialState(3);
    state.tank.water.tempC = 10;
    state.fish.f1 = makeFish('f1');
    const first = runWater(state, [makeSpecies({ tempRangeC: [24, 28] })]);
    const sick = first.filter((e) => e.kind === 'fishSick');
    expect(sick).toHaveLength(1);
    expect((sick[0] as { cause: string }).cause).toBe('temperature');
    expect(state.tank.tempPoorLatch).toBe(true);
    // late arrival into the open episode emits nothing
    state.fish.f2 = makeFish('f2');
    const second = runWater(state, [makeSpecies({ tempRangeC: [24, 28] })]);
    expect(second.filter((e) => e.kind === 'fishSick')).toHaveLength(0);
    // empty tank clears the latch
    state.fish = {};
    runWater(state, [makeSpecies({ tempRangeC: [24, 28] })]);
    expect(state.tank.tempPoorLatch).toBe(false);
  });

  it('water change dilution math halves both pollutants at 50%', () => {
    const state = createInitialState(3);
    state.tank.water.waste = 80;
    state.tank.water.nitrate = 40;
    runWater(state, []);
    expect(state.tank.water.waste).toBeLessThanOrEqual(80);
    expect(state.tank.water.nitrate).toBe(40);
  });

  it('selectors read tank state without mutating it', () => {
    const state = createInitialState(3);
    state.tank.water.waste = 30;
    state.tank.water.nitrate = 10;
    state.tank.bioload = 6;
    state.fish.f1 = makeFish('f1');
    expect(tankWater(state)).toBe(state.tank.water);
    expect(waterQuality(state)).toBe(70);
    expect(capacity(state)).toBe(20);
    expect(bioloadOf(state)).toBe(6);
    expect(projectedBioload(state, 5)).toBe(11);
    expect(tempFitFor(state, makeSpecies({ tempRangeC: [24, 28] }))).toBe(1);
    expect(tempFitFor(state, undefined)).toBe(1);
    expect(waterQuality(state)).toBe(70);
  });
});
