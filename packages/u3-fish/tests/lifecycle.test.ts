// lifecycle.test.ts — TDD Red (Step 9): buy-path + event edge rules (BR11, US2.1).
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  createInitialState,
  createKernel,
  createRng,
  MemoryCatalog,
  type Fish,
  type GameState,
  type Species,
  type TickContext,
} from '@aquarium/u1-sim-foundation';
import type { Genome } from '../src/factories.js';
import { inheritGenome, spawnFish } from '../src/factories.js';
import { genomeQuality, rarityFactor, colourFactor, sizeMultiplier, vigorBonus } from '../src/selectors.js';
import { runFishTick } from '../src/fish.js';
import { register } from '../src/index.js';

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

function matureFish(id: string, overrides: Partial<Fish> = {}): Fish {
  return {
    id,
    speciesId: 'guppy',
    tankId: 'tank-1',
    sex: 'female',
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

describe('buy path over the pure factory (BR11.1, BR11.2)', () => {
  it('distributes sex ~50/50 across 400 seeded spawns', () => {
    const state = createInitialState(99);
    const species = makeSpecies();
    const rng = createRng(state.rngState);
    let males = 0;
    for (let i = 0; i < 400; i++) {
      if (spawnFish(state, species, rng).sex === 'male') males++;
    }
    expect(males).toBeGreaterThanOrEqual(160);
    expect(males).toBeLessThanOrEqual(240);
  });

  it('the factory contributes zero events: the buy trio is the caller trio (U6 level)', () => {
    const kernel = createKernel(5);
    register(kernel.registry);
    const before = kernel.store.version;
    const spawned = spawnFish(kernel.store.state, makeSpecies(), createRng(kernel.store.state.rngState));
    expect(kernel.store.events).toHaveLength(0);
    expect(kernel.store.version).toBe(before);
    // The caller inserts the Fish and emits the W13 trio; U3 emitted nothing.
    expect(spawned.speciesId).toBe('guppy');
    expect(canonicalJson(kernel.store.state.fish)).toBe('{}');
  });

  it('U3 owns no commands: register adds the fish system and nothing else', () => {
    const kernel = createKernel(5);
    const before = kernel.registry.registeredCommandTypes();
    register(kernel.registry);
    expect(kernel.registry.registeredCommandTypes()).toEqual(before);
    expect(kernel.registry.systemsSorted().map((s) => s.id)).toContain('u3.fish');
  });
});

describe('death explanations and maturity events (BR10.4–BR10.6)', () => {
  function tick(state: GameState, catchUp = false) {
    const species = new MemoryCatalog([makeSpecies()]);
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

  it('names temperature deaths environmental: temp-stress kill carries waterQuality', () => {
    const state = createInitialState(21);
    state.tank.water.tempC = 10; // fit 0 against [24,28] → temp stressor active
    state.tank.water.waste = 70; // quality 30: regen off, water stressor also active
    state.tank.equipment.heater.installed = false;
    state.fish.cold = matureFish('cold', { health: 1, satiety: 100 });
    const events = tick(state);
    expect(state.fish.cold).toBeUndefined();
    expect(events).toContainEqual({ kind: 'fishDied', fishId: 'cold', cause: 'waterQuality' });
  });

  it('emits fishMatured adult then senior across a lifespan, mature mirroring stage', () => {
    const state = createInitialState(21);
    state.tank.equipment.heater.installed = true;
    state.fish.life = matureFish('life', {
      stage: 'juvenile',
      mature: false,
      ageDays: 0,
      sizeCm: 2,
      health: 100,
      satiety: 100,
    });
    const species = new MemoryCatalog([makeSpecies()]);
    const seen: string[] = [];
    for (let t = 0; t < 365 * 24 + 5 && state.fish.life !== undefined; t++) {
      state.fish.life.satiety = 100;
      state.tank.water.waste = 0;
      state.tank.water.nitrate = 0;
      const ctx: TickContext = {
        state,
        tick: t + 1,
        now: { day: 1, hour: 0 },
        rng: createRng(state.rngState),
        species,
        events: [],
        catchUp: false,
      };
      runFishTick(ctx);
      for (const e of ctx.events) {
        if (e.kind === 'fishMatured') seen.push((e as { stage: string }).stage);
      }
      if (state.fish.life !== undefined) {
        expect(state.fish.life.mature).toBe(state.fish.life.stage !== 'juvenile');
      }
    }
    expect(seen).toEqual(['adult', 'senior']);
    expect(state.fish.life).toBeUndefined(); // exact old-age end closes the lifespan
  });
});

describe('genome inheritance helper (W15)', () => {
  const sire: Genome = {
    hue: [1, 1],
    pattern: [1, 0],
    tail: [0, 1],
    size: [1, 1],
    vigor: [0, 0],
  };
  const dam: Genome = {
    hue: [0, 0],
    pattern: [0, 1],
    tail: [1, 0],
    size: [0, 0],
    vigor: [1, 1],
  };

  it('takes one allele per locus from each parent via rng', () => {
    const state = createInitialState(33);
    const child = inheritGenome(createRng(state.rngState), sire, dam);
    expect(child.hue).toEqual([1, 0]); // forced: sire only 1s, dam only 0s
    expect(child.size).toEqual([1, 0]);
    expect(child.vigor).toEqual([0, 1]);
    expect(Object.keys(child)).toEqual(['hue', 'pattern', 'tail', 'size', 'vigor']);
  });

  it('never mutates in the MVP: every child allele matches its source parent locus', () => {
    const state = createInitialState(33);
    const rng = createRng(state.rngState);
    for (let i = 0; i < 50; i++) {
      const child = inheritGenome(rng, sire, dam);
      for (const locus of ['hue', 'pattern', 'tail', 'size', 'vigor'] as const) {
        expect(sire[locus]).toContain(child[locus][0]);
        expect(dam[locus]).toContain(child[locus][1]);
      }
    }
  });

  it('derives phenotype inputs: sizeMult, vigor, quality, colour, rarity', () => {
    const premium: Genome = {
      hue: [1, 1],
      pattern: [1, 1],
      tail: [1, 1],
      size: [1, 1],
      vigor: [1, 1],
    };
    const plain: Genome = {
      hue: [0, 0],
      pattern: [0, 0],
      tail: [0, 0],
      size: [0, 0],
      vigor: [0, 0],
    };
    expect(sizeMultiplier(premium)).toBe(1.05);
    expect(sizeMultiplier(plain)).toBe(0.95);
    expect(sizeMultiplier({ ...plain, size: [0, 1] })).toBe(1);
    expect(vigorBonus(premium)).toBe(1);
    expect(vigorBonus(plain)).toBe(0);
    expect(vigorBonus({ ...plain, vigor: [0, 1] })).toBe(0.5);
    expect(genomeQuality(premium)).toBe(1);
    expect(genomeQuality(plain)).toBe(0);
    expect(colourFactor(premium)).toBeGreaterThan(colourFactor(plain));
    expect(rarityFactor(premium)).toBeGreaterThan(rarityFactor(plain));
  });
});
