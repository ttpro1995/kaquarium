// commands.test.ts — U5 API Red phase (US5.1–US5.3).
// Pair/unpair/grade through the real bus: precedence UNKNOWN_ENTITY >
// INVALID_SETTING, the trio breedingStarted/fryHatched/cohortGraded,
// nothing on rejection, and the pure gradePreview selector.
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  createKernel,
  type Fish,
  type SimEvent,
  type Species,
} from '@aquarium/u1-sim-foundation';
import { register as registerBreeding } from '../src/index.js';
import { breedingReadiness, cohortsInTank, gradePreview, pairsInTank } from '../src/selectors.js';

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

function setup() {
  const species = guppy();
  const kernel = createKernel(97, { speciesFiles: [{ file: 'guppy.json', data: species }] });
  registerBreeding(kernel.registry);
  const seen: SimEvent[][] = [];
  kernel.store.subscribe((events) => {
    seen.push(events);
  });
  kernel.store.state.fish.f1 = adultFish('f1', 'female');
  kernel.store.state.fish.m1 = adultFish('m1', 'male');
  return { kernel, species, seen };
}

function readyCohort(kernel: ReturnType<typeof createKernel>, species: Species, count = 10) {
  kernel.store.state.cohorts.c1 = {
    id: 'c1',
    speciesId: species.id,
    tankId: 'tank-1',
    bornDay: 1,
    count,
    ageDays: 30,
    genomePool: {
      sire: {
        hue: [1, 1],
        pattern: [1, 1],
        tail: [1, 1],
        size: [1, 1],
        vigor: [1, 1],
      },
      dam: {
        hue: [0, 0],
        pattern: [0, 0],
        tail: [0, 0],
        size: [0, 0],
        vigor: [0, 0],
      },
      sireId: 'm1',
      damId: 'f1',
    },
    survivalFactor: 1,
    stage: 'fry',
    firstFoodDays: 3,
    lastFryFedDay: 4,
  };
}

describe('breeding.pair / breeding.unpair (US5.1)', () => {
  it('pairs over the bus: one version bump, panel-visible, no event', () => {
    const { kernel, seen } = setup();
    const version = kernel.store.version;
    const outcome = kernel.dispatch('breeding.pair', { femaleId: 'f1', maleId: 'm1' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.pairId).toMatch(/^pair-/);
    expect(kernel.store.version).toBe(version + 1);
    expect(pairsInTank(kernel.store.state)).toHaveLength(1);
    expect(seen.flat()).toHaveLength(0);
  });

  it('orders precedence UNKNOWN_ENTITY before INVALID_SETTING and locks gravid females', () => {
    const { kernel, seen } = setup();
    // Unknown fish beats even a wrong-sex slot on the known side.
    expect(kernel.dispatch('breeding.pair', { femaleId: 'ghost', maleId: 'f1' })).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'UNKNOWN_ENTITY' }),
    });
    const ok = kernel.dispatch('breeding.pair', { femaleId: 'f1', maleId: 'm1' });
    expect(ok.ok).toBe(true);
    const pairId = ok.ok ? ok.value.pairId : '';
    // Gravid re-pairing never resets gestation.
    const bond = kernel.store.state.pairs[pairId];
    if (bond === undefined) throw new Error('test setup: pair missing');
    bond.state = 'gravid';
    bond.readyDay = 40;
    expect(kernel.dispatch('breeding.pair', { femaleId: 'f1', maleId: 'm1' })).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_SETTING' }),
    });
    expect(kernel.store.state.pairs[pairId]?.readyDay).toBe(40);
    // Rejections change nothing and emit nothing.
    expect(seen.flat()).toHaveLength(0);
  });

  it('unpaires over the bus and rejects unknown bonds', () => {
    const { kernel, seen } = setup();
    const ok = kernel.dispatch('breeding.pair', { femaleId: 'f1', maleId: 'm1' });
    expect(ok.ok).toBe(true);
    const pairId = ok.ok ? ok.value.pairId : '';
    expect(kernel.dispatch('breeding.unpair', { pairId })).toEqual({ ok: true, value: { removed: true } });
    expect(kernel.store.state.pairs[pairId]).toBeUndefined();
    expect(kernel.dispatch('breeding.unpair', { pairId })).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'UNKNOWN_ENTITY' }),
    });
    expect(seen.flat()).toHaveLength(0);
  });
});

describe('breeding.grade (US5.2–US5.3)', () => {
  it('grades ready fry into U3-rule Fish with parents and the stunt flag', () => {
    const { kernel, species, seen } = setup();
    readyCohort(kernel, species, 10);
    const fishBefore = Object.keys(kernel.store.state.fish).length;
    const outcome = kernel.dispatch('breeding.grade', { cohortId: 'c1', count: 4 });
    expect(outcome).toEqual({ ok: true, value: { graded: 4, stunted: 4 } });
    // firstFoodDays 3 < juvenileDays/2 = 15 → every graded fish stunted.
    const newborns = Object.values(kernel.store.state.fish).slice(fishBefore);
    expect(newborns).toHaveLength(4);
    for (const fish of newborns) {
      expect(fish?.stage).toBe('juvenile');
      expect(fish?.sizeCm).toBeGreaterThanOrEqual(2.5);
      expect(fish?.sizeCm).toBeLessThanOrEqual(3.5);
      expect(fish?.stunted).toBe(true);
      expect((fish as unknown as { parents: unknown }).parents).toEqual(['f1', 'm1']);
      expect(Object.keys((fish?.genome ?? {}) as object)).toHaveLength(5);
    }
    // The remainder stays a fry cohort with its age continuing.
    expect(kernel.store.state.cohorts.c1?.count).toBe(6);
    expect(seen.flat()).toContainEqual({ kind: 'cohortGraded', cohortId: 'c1', count: 4 });
  });

  it('rejects eggs, unready fry, and bad counts without mutating', () => {
    const { kernel } = setup();
    readyCohort(kernel, kernel.species.get('guppy') as Species, 10);
    const before = canonicalJson({
      fish: kernel.store.state.fish,
      cohorts: kernel.store.state.cohorts,
    });
    kernel.store.state.cohorts.c1 = {
      id: 'c1',
      speciesId: 'guppy',
      tankId: 'tank-1',
      bornDay: 1,
      count: 10,
      ageDays: 30,
      genomePool: (kernel.store.state.cohorts.c1 as { genomePool: Record<string, unknown> }).genomePool,
      survivalFactor: 1,
      stage: 'eggs',
      hatchDay: 9,
      firstFoodDays: 3,
      lastFryFedDay: 4,
    };
    expect(kernel.dispatch('breeding.grade', { cohortId: 'c1', count: 2 })).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_SETTING' }),
    });
    const eggs = kernel.store.state.cohorts.c1;
    if (eggs === undefined) throw new Error('test setup: cohort missing');
    eggs.stage = 'fry';
    eggs.ageDays = 3;
    delete eggs.hatchDay;
    expect(kernel.dispatch('breeding.grade', { cohortId: 'c1', count: 2 })).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_SETTING' }),
    });
    expect(kernel.dispatch('breeding.grade', { cohortId: 'nope', count: 2 })).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'UNKNOWN_ENTITY' }),
    });
    const unready = kernel.store.state.cohorts.c1;
    if (unready === undefined) throw new Error('test setup: cohort missing');
    unready.stage = 'fry';
    unready.ageDays = 30;
    // Non-string ids and catalogue-invalid cohorts reject as unknown entities.
    expect(kernel.dispatch('breeding.pair', { femaleId: 7, maleId: 'm1' } as never)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'UNKNOWN_ENTITY' }),
    });
    expect(kernel.dispatch('breeding.unpair', { pairId: 7 } as never)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'UNKNOWN_ENTITY' }),
    });
    kernel.store.state.cohorts.stray = {
      id: 'stray',
      speciesId: 'nope',
      tankId: 'tank-1',
      bornDay: 1,
      count: 3,
      ageDays: 30,
      genomePool: {},
      survivalFactor: 1,
      stage: 'fry',
      firstFoodDays: 0,
      lastFryFedDay: 0,
    };
    expect(kernel.dispatch('breeding.grade', { cohortId: 'stray', count: 1 })).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'UNKNOWN_ENTITY' }),
    });
    delete kernel.store.state.cohorts.stray;
    for (const count of [0, 11, 2.5]) {
      expect(kernel.dispatch('breeding.grade', { cohortId: 'c1', count })).toEqual({
        ok: false,
        error: expect.objectContaining({ code: 'INVALID_QUANTITY' }),
      });
    }
    // Restore the fixture exactly: the eggs probe above left a hatchDay key.
    readyCohort(kernel, kernel.species.get('guppy') as Species, 10);
    expect(canonicalJson({ fish: kernel.store.state.fish, cohorts: kernel.store.state.cohorts })).toBe(before);
  });

  it('guards capacity with the batch formula, all-or-nothing', () => {
    const { kernel, species } = setup();
    // Bioload 0, volume 20: 4 × (5 − 0.05) = 19.8 fits, 5 × 4.95 = 24.75 does not.
    readyCohort(kernel, species, 10);
    expect(kernel.dispatch('breeding.grade', { cohortId: 'c1', count: 5 })).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'TANK_FULL' }),
    });
    expect(kernel.store.state.cohorts.c1?.count).toBe(10);
    expect(Object.keys(kernel.store.state.fish)).toHaveLength(2);
    expect(kernel.dispatch('breeding.grade', { cohortId: 'c1', count: 4 })).toEqual({
      ok: true,
      value: { graded: 4, stunted: 4 },
    });
  });

  it('emits the lifecycle trio and previews without mutating', () => {    const fertile = guppy({ clutch: [6, 6], gestationDays: 1, cycleDays: 30, speciesBaseRate: 24 });
    const kernel = createKernel(97, { speciesFiles: [{ file: 'guppy.json', data: fertile }] });
    registerBreeding(kernel.registry);
    const seen: SimEvent[][] = [];
    kernel.store.subscribe((events) => {
      seen.push(events);
    });
    kernel.store.state.fish.f1 = adultFish('f1', 'female');
    kernel.store.state.fish.m1 = adultFish('m1', 'male');
    expect(kernel.dispatch('breeding.pair', { femaleId: 'f1', maleId: 'm1' }).ok).toBe(true);
    for (let i = 0; i < 40 && Object.keys(kernel.store.state.cohorts).length === 0; i++) kernel.tick();
    const flat = seen.flat();
    expect(flat).toContainEqual({ kind: 'breedingStarted', fishIds: ['f1', 'm1'] });
    const hatched = flat.find((e) => e.kind === 'fryHatched');
    expect(hatched).toMatchObject({ kind: 'fryHatched', count: 6 });
    // Grade the born cohort to close the trio.
    const cohortId = (hatched as unknown as { cohortId: string }).cohortId;
    const born = kernel.store.state.cohorts[cohortId];
    if (born !== undefined) born.ageDays = 30;
    kernel.store.state.tank.volumeL = 1000; // room for the whole brood
    const brood = born?.count ?? 0;
    expect(brood).toBeGreaterThan(0);
    const before = canonicalJson({ fish: kernel.store.state.fish, cohorts: kernel.store.state.cohorts });
    const preview = gradePreview(kernel.store.state, fertile, cohortId, brood);
    expect(preview?.ready).toBe(true);
    expect(preview?.stunted).toBe(true); // never fed → stunt
    expect(canonicalJson({ fish: kernel.store.state.fish, cohorts: kernel.store.state.cohorts })).toBe(before);
    expect(kernel.dispatch('breeding.grade', { cohortId, count: brood }).ok).toBe(true);
    expect(seen.flat()).toContainEqual({ kind: 'cohortGraded', cohortId, count: brood });
    // Readiness and tank scope stay consistent after the lifecycle.
    expect(cohortsInTank(kernel.store.state)).toHaveLength(0);
    expect(breedingReadiness(kernel.store.state, 'missing', fertile)).toBeUndefined();
  });
});

describe('breeding selectors (U7 panels)', () => {
  it('scopes panels to the tank and breaks down readiness per pair', () => {
    const { kernel, species } = setup();
    const ok = kernel.dispatch('breeding.pair', { femaleId: 'f1', maleId: 'm1' });
    const pairId = ok.ok ? ok.value.pairId : '';
    const readiness = breedingReadiness(kernel.store.state, pairId, species);
    expect(readiness).toMatchObject({
      pairId,
      state: 'paired',
      readyDay: 1,
      passes: true,
      gates: { mature: true, health: true, satiety: true, tempFit: true, quality: true },
    });
    expect(readiness?.condition).toBeCloseTo(1, 10);
    expect(readiness?.probabilityPerTick).toBeCloseTo(0.3 / 24, 10);
    expect(pairsInTank(kernel.store.state)).toHaveLength(1);
    expect(cohortsInTank(kernel.store.state)).toHaveLength(0);
    // A bond whose female swims elsewhere is not on this tank's panel.
    kernel.store.state.fish.f1 = { ...kernel.store.state.fish.f1, tankId: 'other' } as Fish;
    expect(pairsInTank(kernel.store.state)).toHaveLength(0);
    // Unknown species falls back to the tolerant defaults, mirroring tempFitFor.
    expect(breedingReadiness(kernel.store.state, pairId, undefined)?.passes).toBe(true);
    expect(gradePreview(kernel.store.state, undefined, 'c1', 1)).toBeUndefined();
  });

  it('previews every grade outcome without mutating', () => {
    const { kernel, species } = setup();
    readyCohort(kernel, species, 10);
    const before = canonicalJson({ fish: kernel.store.state.fish, cohorts: kernel.store.state.cohorts });
    // Ready batch fits: 4 × 4.95 = 19.8 ≤ 20.
    expect(gradePreview(kernel.store.state, species, 'c1', 4)).toMatchObject({
      ready: true, reason: null, fits: true, stunted: true, capacity: 20,
    });
    // The same batch over capacity.
    expect(gradePreview(kernel.store.state, species, 'c1', 5)).toMatchObject({
      ready: false, reason: 'tank-full', fits: false,
    });
    // Bad counts.
    expect(gradePreview(kernel.store.state, species, 'c1', 0)?.reason).toBe('invalid-count');
    expect(gradePreview(kernel.store.state, species, 'c1', 11)?.reason).toBe('invalid-count');
    // Unready fry.
    const young = kernel.store.state.cohorts.c1;
    if (young === undefined) throw new Error('test setup: cohort missing');
    young.ageDays = 3;
    expect(gradePreview(kernel.store.state, species, 'c1', 2)?.reason).toBe('not-ready');
    // Eggs never grade.
    young.stage = 'eggs';
    expect(gradePreview(kernel.store.state, species, 'c1', 2)?.reason).toBe('eggs');
    // Unknown cohorts.
    expect(gradePreview(kernel.store.state, species, 'nope', 1)).toBeUndefined();
    // Nothing mutated along the way.
    readyCohort(kernel, species, 10);
    expect(canonicalJson({ fish: kernel.store.state.fish, cohorts: kernel.store.state.cohorts })).toBe(before);
  });
});
