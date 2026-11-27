// breeding.test.ts — U5 business-logic Red phase (BR14.2–BR14.5, BR15.1–BR15.2, BR15.4).
// Condition-scaled attempts with bound gates (no punishment on gate
// failure), livebearer gestation → seeded scaled brood → cooldown, egg
// laying (fertility 0.6–0.9) → timed hatch, cycleDays cooldown,
// day-boundary survival decay with newborn grace, stunt predicate,
// silent cleanup.
import { describe, expect, it } from 'vitest';
import {
  createKernel,
  type Fish,
  type SimEvent,
  type Species,
} from '@aquarium/u1-sim-foundation';
import { register as registerWater } from '@aquarium/u2-tank-water';
import { register as registerBreeding } from '../src/index.js';
import { breedingParamsFor } from '../src/cohorts.js';
import { attemptCondition, gateReport, gatesPass, pairGates } from '../src/breeding.js';
import {
  BREED_HEALTH_GATE,
  BREED_QUALITY_GATE,
  BREED_SATIETY_GATE,
  BREED_TEMP_FIT_GATE,
} from '../src/breeding.js';

function breedingSpecies(kind: 'livebearer' | 'scatter', extra: Record<string, unknown> = {}): Species {
  const base: Species = {
    id: kind === 'livebearer' ? 'guppy' : 'danio',
    name: { en: kind },
    archetype: kind,
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

function adultFish(id: string, sex: 'male' | 'female', overrides: Partial<Fish> = {}): Fish {
  return {
    id,
    speciesId: 'guppy',
    tankId: 'tank-1',
    sex,
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

function setup(kind: 'livebearer' | 'scatter', extra: Record<string, unknown> = {}, withWater = true) {
  const species = breedingSpecies(kind, extra);
  const kernel = createKernel(31, { speciesFiles: [{ file: `${species.id}.json`, data: species }] });
  if (withWater) registerWater(kernel.registry);
  registerBreeding(kernel.registry);
  const seen: SimEvent[][] = [];
  kernel.store.subscribe((events) => {
    seen.push(events);
  });
  return { kernel, species, seen };
}

function bonded(kernel: ReturnType<typeof createKernel>, speciesId: string, today: number) {
  kernel.store.state.fish.f1 = adultFish('f1', 'female', { speciesId });
  kernel.store.state.fish.m1 = adultFish('m1', 'male', { speciesId });
  kernel.store.state.pairs.p1 = {
    id: 'p1',
    femaleId: 'f1',
    maleId: 'm1',
    speciesId,
    state: 'paired',
    readyDay: today,
  };
}

describe('spawn attempts (BR14.2)', () => {
  it('withholds the spawn on gate failure with no penalty and no event', () => {
    const { kernel, species, seen } = setup('livebearer', { speciesBaseRate: 24 });
    bonded(kernel, species.id, 1);
    // Sick female: the health gate fails while everything else is ideal.
    kernel.store.state.fish.f1 = adultFish('f1', 'female', {
      speciesId: species.id,
      health: 30,
    });
    const healthBefore = kernel.store.state.fish.f1?.health;
    const satietyBefore = kernel.store.state.fish.f1?.satiety;
    for (let i = 0; i < 48; i++) kernel.tick();
    expect(kernel.store.state.pairs.p1?.state).toBe('paired');
    expect(Object.keys(kernel.store.state.cohorts)).toHaveLength(0);
    expect(seen.flat().filter((e) => e.kind === 'breedingStarted')).toHaveLength(0);
    // No punishment beyond withholding: the breeding phase never writes Fish.
    expect(kernel.store.state.fish.f1?.health).toBe(healthBefore);
    expect(kernel.store.state.fish.f1?.satiety).toBeLessThanOrEqual(satietyBefore ?? 100);
  });

  it('pins the attempt gates and the condition formula', () => {
    const { kernel, species } = setup('livebearer');
    bonded(kernel, species.id, 1);
    const state = kernel.store.state;
    const female = state.fish.f1 as Fish;
    const male = state.fish.m1 as Fish;
    const gates = pairGates(state, female, male, species);
    expect(gates).toEqual({
      mature: true,
      health: true,
      satiety: true,
      tempFit: true,
      quality: true,
    });
    // 0.3×1 + 0.3×1 + 0.25×1 + 0.15×1 = 1 at ideal care.
    expect(attemptCondition(state, female, species)).toBeCloseTo(1, 10);
    const params = breedingParamsFor(species);
    expect(params.speciesBaseRate).toBeCloseTo(0.3, 10);
  });

  it('tick inline matches pairGates+gatesPass over the boundary matrix', () => {
    const { kernel, species } = setup('livebearer');
    bonded(kernel, species.id, 1);
    const state = kernel.store.state;
    const baseFemale = state.fish.f1 as Fish;
    const baseMale = state.fish.m1 as Fish;
    // Boundary values straddle each gate threshold. gateReport takes the
    // hoisted tank reads directly, so the matrix drives the exact values
    // the hot loop inlines (no per-pair allocation there; pairGates stays
    // the tested public form of the same five checks).
    const healths = [BREED_HEALTH_GATE - 1, BREED_HEALTH_GATE];
    const satieties = [BREED_SATIETY_GATE - 1, BREED_SATIETY_GATE];
    const qualities = [BREED_QUALITY_GATE - 1, BREED_QUALITY_GATE];
    const tempFits = [BREED_TEMP_FIT_GATE - 0.01, BREED_TEMP_FIT_GATE];
    for (const mature of [true, false]) {
      for (const health of healths) {
        for (const satiety of satieties) {
          for (const quality of qualities) {
            for (const tempFit of tempFits) {
              const female = { ...baseFemale, mature, health, satiety };
              const male = { ...baseMale, mature, health, satiety };
              const gates = gateReport(quality, tempFit, female, male);
              // Hot-loop inline replica (breeding.ts runBreedingTick): the
              // same five checks over the same thresholds.
              const inline =
                female.mature &&
                male.mature &&
                female.health >= BREED_HEALTH_GATE &&
                male.health >= BREED_HEALTH_GATE &&
                female.satiety >= BREED_SATIETY_GATE &&
                male.satiety >= BREED_SATIETY_GATE &&
                tempFit >= BREED_TEMP_FIT_GATE &&
                quality >= BREED_QUALITY_GATE;
              expect(gatesPass(gates)).toBe(inline);
              // Only the all-at-or-above corner passes.
              expect(inline).toBe(
                mature &&
                  health >= BREED_HEALTH_GATE &&
                  satiety >= BREED_SATIETY_GATE &&
                  quality >= BREED_QUALITY_GATE &&
                  tempFit >= BREED_TEMP_FIT_GATE,
              );
            }
          }
        }
      }
    }
    // Spot-check the state-derived public form agrees at the all-pass
    // corner and rejects below the quality bound.
    {
      const female = state.fish.f1 as Fish;
      const male = state.fish.m1 as Fish;
      expect(gatesPass(pairGates(state, female, male, species))).toBe(true);
      const lowQuality = {
        ...state,
        tank: { ...state.tank, water: { ...state.tank.water, waste: 61, nitrate: 0 } },
      };
      expect(gatesPass(pairGates(lowQuality, female, male, species))).toBe(false);
    }
  });
});

describe('livebearer and egg-layer paths (BR14.3–BR14.4)', () => {
  it('conceives on success: gravid with the gestation due date and breedingStarted', () => {
    const { kernel, species, seen } = setup('livebearer', { speciesBaseRate: 24 });
    bonded(kernel, species.id, 1);
    kernel.tick();
    const pair = kernel.store.state.pairs.p1;
    expect(pair?.state).toBe('gravid');
    expect(pair?.readyDay).toBe(1 + 7);
    expect(seen.flat()).toContainEqual({ kind: 'breedingStarted', fishIds: ['f1', 'm1'] });
  });

  it('births a seeded scaled brood, then cools the female down', () => {
    const { kernel, species, seen } = setup('livebearer', {
      clutch: [4, 8],
      gestationDays: 2,
      cycleDays: 5,
      speciesBaseRate: 24,
    });
    bonded(kernel, species.id, 1);
    kernel.tick(); // conception on day 1, due day 3
    expect(kernel.store.state.pairs.p1?.state).toBe('gravid');
    for (let i = 0; i < 80 && Object.keys(kernel.store.state.cohorts).length === 0; i++) {
      kernel.tick();
    }
    const ids = Object.keys(kernel.store.state.cohorts);
    expect(ids).toHaveLength(1);
    const cohort = kernel.store.state.cohorts[ids[0] as string];
    expect(cohort?.stage).toBe('fry');
    expect(cohort?.count).toBeGreaterThanOrEqual(4);
    expect(cohort?.count).toBeLessThanOrEqual(8);
    expect(cohort?.firstFoodDays).toBe(0);
    expect(cohort?.lastFryFedDay).toBe(0);
    expect(seen.flat()).toContainEqual({ kind: 'fryHatched', cohortId: ids[0], count: cohort?.count });
    const pair = kernel.store.state.pairs.p1;
    expect(pair?.state).toBe('cooling');
    expect(pair?.readyDay).toBe(kernel.store.state.clock.gameDay + 5);
  });

  it('lays fertile-rolled eggs that hatch on schedule while the pair rests', () => {
    const { kernel, species, seen } = setup('scatter', {
      clutch: [4, 8],
      hatchDays: 2,
      cycleDays: 9,
      speciesBaseRate: 24,
    });
    const sid = species.id;
    kernel.store.state.fish.f1 = adultFish('f1', 'female', { speciesId: sid });
    kernel.store.state.fish.m1 = adultFish('m1', 'male', { speciesId: sid });
    kernel.store.state.pairs.p1 = {
      id: 'p1', femaleId: 'f1', maleId: 'm1', speciesId: sid, state: 'paired', readyDay: 1,
    };
    kernel.tick(); // laying
    const ids = Object.keys(kernel.store.state.cohorts);
    expect(ids).toHaveLength(1);
    const eggs = kernel.store.state.cohorts[ids[0] as string];
    expect(eggs?.stage).toBe('eggs');
    expect(eggs?.count).toBeGreaterThanOrEqual(1);
    expect(eggs?.count).toBeLessThanOrEqual(8);
    expect(eggs?.hatchDay).toBe(1 + 2);
    expect(seen.flat()).toContainEqual({ kind: 'breedingStarted', fishIds: ['f1', 'm1'] });
    // The pair rests while the eggs incubate.
    expect(kernel.store.state.pairs.p1?.state).toBe('cooling');
    // Eggs neither eat nor decay: counts hold tick after tick until hatch.
    const count = eggs?.count;
    const laidDay = kernel.store.state.clock.gameDay;
    for (let i = 0; i < 80 && kernel.store.state.cohorts[ids[0] as string]?.stage !== 'fry'; i++) {
      kernel.tick();
    }
    const still = kernel.store.state.cohorts[ids[0] as string];
    expect(still?.stage).toBe('fry');
    // No midnight fry-decay touched the eggs in transit: the count holds.
    expect(still?.count).toBe(count);
    expect(seen.flat()).toContainEqual({ kind: 'fryHatched', cohortId: ids[0], count: still?.count });
    expect(kernel.store.state.clock.gameDay).toBeGreaterThanOrEqual(laidDay);
  });

  it('blocks back-to-back spawns inside cycleDays', () => {
    const { kernel, species, seen } = setup('livebearer', {
      gestationDays: 1,
      cycleDays: 4,
      speciesBaseRate: 24,
    });
    bonded(kernel, species.id, 1);
    kernel.tick(); // conception
    const due = kernel.store.state.pairs.p1?.readyDay ?? 0;
    // Fast-forward to the birth tick, then watch the full cooldown: no
    // second conception while cooling, even at p = 1.
    for (let i = 0; i < 30; i++) kernel.tick();
    const starts = seen.flat().filter((e) => e.kind === 'breedingStarted');
    expect(due).toBeGreaterThan(1);
    expect(starts).toHaveLength(1);
  });
});

describe('fry life and cleanup (BR15.1–BR15.2, BR15.4)', () => {
  function midnightSetup() {
    // No water system here: the decay reads the pinned waste/nitrate
    // exactly, so the calibrated keeps assert to the decimal.
    const { kernel, species, seen } = setup('livebearer', {}, false);
    const sid = species.id;
    kernel.store.state.cohorts.c1 = {
      id: 'c1',
      speciesId: sid,
      tankId: 'tank-1',
      bornDay: 1,
      count: 100,
      ageDays: 5,
      genomePool: {},
      survivalFactor: 1,
      stage: 'fry',
      firstFoodDays: 5,
      lastFryFedDay: 1,
    };
    return { kernel, seen };
  }

  it('applies the ideal keep (~0.95) on the midnight tick', () => {
    const { kernel } = midnightSetup();
    // Clock starts day 1 hour 8: 16 ticks land on the hour-0 midnight.
    for (let i = 0; i < 16; i++) kernel.tick();
    expect(kernel.store.state.clock.gameHour).toBe(0);
    const cohort = kernel.store.state.cohorts.c1;
    expect(cohort?.survivalFactor).toBeCloseTo(0.95, 10);
    expect(cohort?.count).toBe(95);
  });

  it('drops to ~0.70 neglected and spares newborns through the grace day', () => {
    // Neglected: quality 0 pins the keep at exactly 0.70 whatever the feeding.
    {
      const { kernel } = midnightSetup();
      kernel.store.state.tank.water.waste = 100; // quality 0
      kernel.store.state.cohorts.c1 = {
        id: 'c1',
        speciesId: 'guppy',
        tankId: 'tank-1',
        bornDay: 1,
        count: 100,
        ageDays: 5,
        genomePool: {},
        survivalFactor: 1,
        stage: 'fry',
        firstFoodDays: 0,
        lastFryFedDay: 0,
      };
      for (let i = 0; i < 16; i++) kernel.tick();
      expect(kernel.store.state.cohorts.c1?.survivalFactor).toBeCloseTo(0.7, 10);
      expect(kernel.store.state.cohorts.c1?.count).toBe(70);
    }
    // Grace: quality 100, nobody fed — the old cohort takes the food
    // penalty (0.825) while the newborn keeps the ideal keep (0.95).
    {
      const { kernel } = midnightSetup();
      kernel.store.state.cohorts.c1 = {
        id: 'c1',
        speciesId: 'guppy',
        tankId: 'tank-1',
        bornDay: 1,
        count: 100,
        ageDays: 5,
        genomePool: {},
        survivalFactor: 1,
        stage: 'fry',
        firstFoodDays: 0,
        lastFryFedDay: 0,
      };
      kernel.store.state.cohorts.newborn = {
        id: 'newborn',
        speciesId: 'guppy',
        tankId: 'tank-1',
        bornDay: 2,
        count: 20,
        ageDays: 0.1,
        genomePool: {},
        survivalFactor: 1,
        stage: 'fry',
        firstFoodDays: 0,
        lastFryFedDay: 0,
      };
      for (let i = 0; i < 16; i++) kernel.tick();
      expect(kernel.store.state.cohorts.c1?.survivalFactor).toBeCloseTo(0.825, 10);
      expect(kernel.store.state.cohorts.c1?.count).toBe(82);
      expect(kernel.store.state.cohorts.newborn?.count).toBe(19);
    }
  });

  it('removes zero-count cohorts and dissolved pairs silently', () => {
    const { kernel, species, seen } = setup('livebearer');
    bonded(kernel, species.id, 1);
    kernel.store.state.cohorts.empty = {
      id: 'empty',
      speciesId: species.id,
      tankId: 'tank-1',
      bornDay: 1,
      count: 0,
      ageDays: 2,
      genomePool: {},
      survivalFactor: 1,
      stage: 'fry',
      firstFoodDays: 0,
      lastFryFedDay: 0,
    };
    delete kernel.store.state.fish.m1;
    const batches = seen.length;
    kernel.tick();
    expect(kernel.store.state.cohorts.empty).toBeUndefined();
    expect(kernel.store.state.pairs.p1).toBeUndefined();
    expect(seen.length).toBe(batches + 1); // the drain still runs
    expect(seen.flat().some((e) => e.kind === 'fishDied')).toBe(false);
  });

  it('ages every cohort an hour per tick from laying', () => {
    const { kernel } = midnightSetup();
    const before = kernel.store.state.cohorts.c1?.ageDays ?? 0;
    kernel.tick();
    expect(kernel.store.state.cohorts.c1?.ageDays).toBeCloseTo(before + 1 / 24, 10);
  });
});
