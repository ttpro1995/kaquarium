// pairs.test.ts — U5 data-model Red phase (FR5.1–FR5.3; BR14.1, BR15.4).
// Pair/unpair validation (eligibility, gravid/cooling re-pair rejected,
// archetype gate, silent dissolution) and cohort construction (fertility
// roll range, hatchDay, zeroed counters).
import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  createRng,
  type Fish,
  type Species,
} from '@aquarium/u1-sim-foundation';
import {
  createPair,
  dissolveDeadPairs,
  findPairByFemale,
  isBreedableArchetype,
  promoteCoolingPairs,
  validatePairing,
} from '../src/pairs.js';
import {
  breedingParamsFor,
  drawClutch,
  makeEggsCohort,
  makeFryCohort,
  rollFertility,
  stuntedAtGrading,
} from '../src/cohorts.js';

function livebearer(extra: Record<string, unknown> = {}): Species {
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
    satiety: 80,
    stress: 0,
    genome: {},
    stunted: false,
    value: 10,
    mature: true,
    ...overrides,
  };
}

function pairedState() {
  const state = createInitialState(11);
  state.fish.f1 = adultFish('f1', 'female');
  state.fish.m1 = adultFish('m1', 'male');
  const species = livebearer();
  return { state, species };
}

describe('pairing validation (BR14.1)', () => {
  it('creates a paired pair with readyDay = today for two eligible adults', () => {
    const { state, species } = pairedState();
    const checked = validatePairing(state, () => species, 'f1', 'm1');
    expect(checked).toEqual({ ok: true });
    const pair = createPair(state, createRng(state.rngState), 'f1', 'm1', 7);
    expect(pair.state).toBe('paired');
    expect(pair.readyDay).toBe(7);
    expect(pair.speciesId).toBe('guppy');
    expect(state.pairs[pair.id]).toBe(pair);
  });

  it('reports UNKNOWN_ENTITY when a member is missing, ahead of any setting check', () => {
    const { state, species } = pairedState();
    // Male also carries a wrong-sex slot: the unknown fish still wins.
    const result = validatePairing(state, () => species, 'ghost', 'f1');
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'UNKNOWN_ENTITY' }),
    });
  });

  it('rejects a wrong-sex slot with INVALID_SETTING', () => {
    const { state, species } = pairedState();
    const result = validatePairing(state, () => species, 'm1', 'f1');
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_SETTING' }),
    });
  });

  it('rejects a cross-species bond with INVALID_SETTING', () => {
    const { state, species } = pairedState();
    state.fish.m1 = adultFish('m1', 'male', { speciesId: 'molly' });
    const result = validatePairing(state, () => species, 'f1', 'm1');
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_SETTING' }),
    });
  });

  it('gates non-breeding archetypes with INVALID_SETTING', () => {
    expect(isBreedableArchetype('livebearer')).toBe(true);
    expect(isBreedableArchetype('scatter')).toBe(true);
    expect(isBreedableArchetype('plant')).toBe(true);
    expect(isBreedableArchetype('cave')).toBe(false);
    const { state } = pairedState();
    const cave = livebearer({ archetype: 'cave' });
    const result = validatePairing(state, () => cave, 'f1', 'm1');
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_SETTING' }),
    });
  });

  it('rejects immature fish with INVALID_SETTING', () => {
    const { state, species } = pairedState();
    state.fish.f1 = adultFish('f1', 'female', { stage: 'juvenile', mature: false });
    const result = validatePairing(state, () => species, 'f1', 'm1');
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_SETTING' }),
    });
  });

  it('never resets gestation or cooldown: gravid/cooling re-pair is rejected, paired replaces', () => {
    const { state, species } = pairedState();
    const rng = createRng(state.rngState);
    const first = createPair(state, rng, 'f1', 'm1', 7);
    // A paired bond replaces: same female, new bond, old bond gone.
    const second = createPair(state, rng, 'f1', 'm1', 9);
    expect(state.pairs[first.id]).toBeUndefined();
    expect(state.pairs[second.id]?.readyDay).toBe(9);
    expect(findPairByFemale(state, 'f1')?.id).toBe(second.id);
    // Gravid locks the female: re-pairing is rejected, never reset.
    second.state = 'gravid';
    second.readyDay = 20;
    expect(validatePairing(state, () => species, 'f1', 'm1')).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_SETTING' }),
    });
    expect(second.readyDay).toBe(20);
    // Cooling locks the female too.
    second.state = 'cooling';
    expect(validatePairing(state, () => species, 'f1', 'm1')).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_SETTING' }),
    });
  });

  it('dissolves pairs with a missing member silently and promotes cooling at readyDay', () => {
    const { state } = pairedState();
    const rng = createRng(state.rngState);
    const pair = createPair(state, rng, 'f1', 'm1', 7);
    pair.state = 'cooling';
    pair.readyDay = 10;
    delete state.fish.m1;
    expect(dissolveDeadPairs(state)).toEqual([pair.id]);
    expect(state.pairs[pair.id]).toBeUndefined();
    // A live cooling pair promotes back to paired once today reaches readyDay.
    state.fish.m1 = adultFish('m1', 'male');
    const resting = createPair(state, rng, 'f1', 'm1', 4);
    resting.state = 'cooling';
    resting.readyDay = 10;
    expect(promoteCoolingPairs(state, 9)).toEqual([]);
    expect(resting.state).toBe('cooling');
    expect(promoteCoolingPairs(state, 10)).toEqual([resting.id]);
    expect(resting.state).toBe('paired');
  });
});

describe('cohort construction (FR5.1–FR5.3; BR14.3–BR14.4)', () => {
  it('draws the seeded clutch inside the catalogue range with zeroed counters', () => {
    const params = breedingParamsFor(livebearer({ clutch: [4, 8] }));
    expect(params.clutchMin).toBe(4);
    expect(params.clutchMax).toBe(8);
    const rng = createRng({ seed: 5, a: 5 });
    for (let i = 0; i < 50; i++) {
      const clutch = drawClutch(rng, params);
      expect(Number.isInteger(clutch)).toBe(true);
      expect(clutch).toBeGreaterThanOrEqual(4);
      expect(clutch).toBeLessThanOrEqual(8);
    }
  });

  it('rolls fertility inside 0.6–0.9 and stamps hatchDay on eggs cohorts', () => {
    const rng = createRng({ seed: 9, a: 9 });
    for (let i = 0; i < 50; i++) {
      const fertility = rollFertility(rng);
      expect(fertility).toBeGreaterThanOrEqual(0.6);
      expect(fertility).toBeLessThanOrEqual(0.9);
    }
    const cohort = makeEggsCohort({
      id: 'cohort-1',
      speciesId: 'danio',
      tankId: 'tank-1',
      bornDay: 12,
      count: 6,
      hatchDay: 15,
      sireGenome: {},
      damGenome: {},
      sireId: 'm1',
      damId: 'f1',
    });
    expect(cohort.stage).toBe('eggs');
    expect(cohort.hatchDay).toBe(15);
    expect(cohort.firstFoodDays).toBe(0);
    expect(cohort.lastFryFedDay).toBe(0);
  });

  it('flags the stunt from the first-food test (BR15.2)', () => {
    const cohort = makeFryCohort({
      id: 'cohort-1',
      speciesId: 'guppy',
      tankId: 'tank-1',
      bornDay: 12,
      count: 6,
      sireGenome: {},
      damGenome: {},
      sireId: 'm1',
      damId: 'f1',
    });
    // juvenileDays 30 → fed on fewer than 15 distinct days stunts.
    expect(stuntedAtGrading({ ...cohort, firstFoodDays: 3 }, 30)).toBe(true);
    expect(stuntedAtGrading({ ...cohort, firstFoodDays: 15 }, 30)).toBe(false);
  });
});
