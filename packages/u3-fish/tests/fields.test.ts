// fields.test.ts — TDD Red (Step 3): spawnFish field rules (FR4.1–FR4.3; BR11.1).
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  createInitialState,
  createRng,
  type Fish,
  type GameState,
  type Species,
} from '@aquarium/u1-sim-foundation';
import { spawnFish } from '../src/factories.js';

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
    ...overrides,
  };
}

function setup(seed = 7): { state: GameState; species: Species } {
  return { state: createInitialState(seed), species: makeSpecies() };
}

describe('spawnFish field rules (BR11.1)', () => {
  it('builds a juvenile with zero age, full health, satiety 80, mature false, stunted false', () => {
    const { state, species } = setup();
    const fish = spawnFish(state, species, createRng(state.rngState));
    expect(fish.speciesId).toBe('guppy');
    expect(fish.tankId).toBe('tank-1');
    expect(fish.stage).toBe('juvenile');
    expect(fish.ageDays).toBe(0);
    expect(fish.health).toBe(100);
    expect(fish.satiety).toBe(80);
    expect(fish.stress).toBe(0);
    expect(fish.mature).toBe(false);
    expect(fish.stunted).toBe(false);
  });

  it('assigns sex 50/50 via the seeded stream (both sexes over 200 spawns)', () => {
    const { state, species } = setup();
    const rng = createRng(state.rngState);
    let males = 0;
    for (let i = 0; i < 200; i++) {
      if (spawnFish(state, species, rng).sex === 'male') males++;
    }
    expect(males).toBeGreaterThan(70);
    expect(200 - males).toBeGreaterThan(70);
  });

  it('sizes juveniles at 50–70% of adultSizeCm', () => {
    const { state, species } = setup();
    const rng = createRng(state.rngState);
    for (let i = 0; i < 50; i++) {
      const size = spawnFish(state, species, rng).sizeCm;
      expect(size).toBeGreaterThanOrEqual(2.5);
      expect(size).toBeLessThanOrEqual(3.5);
    }
  });

  it('rolls a five-locus genome of 0/1 alleles, deterministically per seed', () => {
    const first = spawnFish(setup().state, makeSpecies(), createRng(createInitialState(7).rngState));
    const second = spawnFish(setup().state, makeSpecies(), createRng(createInitialState(7).rngState));
    expect(first.genome).toEqual(second.genome);
    for (const locus of ['hue', 'pattern', 'tail', 'size', 'vigor'] as const) {
      const pair = (first.genome as Record<string, unknown>)[locus];
      expect(Array.isArray(pair)).toBe(true);
      expect((pair as unknown[]).length).toBe(2);
      for (const allele of pair as unknown[]) expect([0, 1]).toContain(allele);
    }
  });

  it('sets parents null and caches value at buyPrice', () => {
    const { state, species } = setup();
    const fish = spawnFish(state, species, createRng(state.rngState));
    expect((fish as unknown as Record<string, unknown>).parents).toBeNull();
    expect(fish.value).toBe(10);
  });

  it('mutates nothing but the rng cursor: game state identical, stream advanced', () => {
    const { state, species } = setup();
    const strip = (s: GameState) => {
      const { rngState: _cursor, ...rest } = s;
      return canonicalJson(rest);
    };
    const before = strip(state);
    const cursorBefore = state.rngState.a;
    spawnFish(state, species, createRng(state.rngState));
    expect(strip(state)).toBe(before);
    // The single seeded stream advances by construction (BR2.1); the
    // factory takes no events array and appends no events anywhere.
    expect(state.rngState.a).not.toBe(cursorBefore);
  });

  it('emits nothing and is deterministic: same seed plus call order, same fish', () => {
    const mk = () => {
      const s = setup();
      return { s: s.state, fish: spawnFish(s.state, s.species, createRng(s.state.rngState)) };
    };
    const a = mk();
    const b = mk();
    expect(a).toEqual(b);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('rejects species outside the valid catalogue as UNKNOWN_ENTITY', () => {
    const { state } = setup();
    const bogus = makeSpecies({ id: '' });
    expect(() => spawnFish(state, bogus, createRng(state.rngState))).toThrow('UNKNOWN_ENTITY');
  });
});

describe('Fish type conformance', () => {
  it('spawned fish satisfy the shared Fish shape in stable key order', () => {
    const { state, species } = setup();
    const fish: Fish = spawnFish(state, species, createRng(state.rngState));
    expect(Object.keys(fish)).toEqual([
      'id',
      'speciesId',
      'tankId',
      'sex',
      'stage',
      'ageDays',
      'sizeCm',
      'health',
      'satiety',
      'stress',
      'genome',
      'stunted',
      'value',
      'mature',
      'parents',
    ]);
  });
});
