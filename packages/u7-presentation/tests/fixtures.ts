// fixtures — deterministic sim content for U7 shell tests.
// A two-species dev catalogue (valid per C5), the six real sim units
// registered, and helpers to mint the fish/pairs/cohorts/orders the panel
// actions need. Never the 30-species dataset except the Store 30-row test.
import { createKernel, type Kernel } from '@aquarium/u1-sim-foundation';
import type { Fish, Species } from '@aquarium/u1-sim-foundation/state';
import { register as registerWater } from '@aquarium/u2-tank-water';
import { register as registerFish } from '@aquarium/u3-fish';
import { register as registerFeeding } from '@aquarium/u4-feeding';
import { register as registerBreeding } from '@aquarium/u5-breeding';
import { register as registerCommerce } from '@aquarium/u6-commerce';

export function testSpecies(id: string, overrides: Partial<Species> = {}): Species {
  return {
    id,
    name: { en: id },
    archetype: 'livebearer',
    tier: 1,
    care: 1,
    buyPrice: 10,
    sellBase: 8,
    adultSizeCm: 3,
    lifespanDays: 365,
    maturityDays: 30,
    juvenileDays: 10,
    diet: { type: 'flake', firstFoodRequired: false },
    genes: {},
    palette: { body: 'teal', belly: 'silver' },
    pattern: 'stripes',
    fin: 'veil',
    schooling: 0.5,
    territorial: 0.2,
    layer: 'middle',
    tempRangeC: [24, 28],
    ...overrides,
  };
}

export const GENOME = {
  hue: [1, 0],
  pattern: [0, 1],
  tail: [1, 1],
  size: [0, 0],
  vigor: [1, 0],
};

export function bootTestKernel(
  seed = 7,
  species: Species[] = [testSpecies('guppy')],
  opts: { now?: () => string } = {},
): Kernel {
  const kernel = createKernel(seed, {
    speciesFiles: species.map((data) => ({ file: `${data.id}.json`, data })),
    speciesMode: 'dev',
    ...(opts.now !== undefined ? { now: opts.now } : {}),
  });
  registerWater(kernel.registry);
  registerFish(kernel.registry);
  registerFeeding(kernel.registry);
  registerBreeding(kernel.registry);
  registerCommerce(kernel.registry);
  return kernel;
}

/** A healthy adult fish placed straight into the MVP tank. */
export function addFish(
  kernel: Kernel,
  id: string,
  speciesId: string,
  sex: 'male' | 'female',
  overrides: Partial<Fish> = {},
): Fish {
  const fish: Fish = {
    id,
    speciesId,
    tankId: kernel.store.state.tank.id,
    sex,
    stage: 'adult',
    ageDays: 100,
    sizeCm: 3,
    health: 90,
    satiety: 80,
    stress: 0,
    genome: { ...GENOME },
    stunted: false,
    value: 10,
    mature: true,
    ...overrides,
  };
  kernel.store.state.fish[id] = fish;
  return fish;
}

/** A fry-stage cohort ready to grade (ageDays past juvenileDays). */
export function addFryCohort(kernel: Kernel, id: string, speciesId: string, count = 4) {
  const cohort = {
    id,
    speciesId,
    tankId: kernel.store.state.tank.id,
    bornDay: kernel.store.state.clock.gameDay - 20,
    count,
    ageDays: 20,
    genomePool: { sire: { ...GENOME }, dam: { ...GENOME }, sireId: null, damId: null },
    survivalFactor: 1,
    stage: 'fry' as const,
    hatchDay: kernel.store.state.clock.gameDay - 10,
    firstFoodDays: 2,
    lastFryFedDay: kernel.store.state.clock.gameDay - 1,
  };
  kernel.store.state.cohorts[id] = cohort;
  return cohort;
}
