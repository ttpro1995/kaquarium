// breeding — U5 breeding-phase system (W22–W24, BR14.2–BR14.5, BR15.1, BR15.4).
// Runs in the breeding phase (after fish, before commerce): dissolve dead
// refs, promote rested pairs, roll condition-scaled attempts, advance
// gestation/incubation, apply the midnight fry decay, and clean up empties.
// Silent paths emit nothing; XP-relevant events (breedingStarted,
// fryHatched) flow to U6 through the drain. Reads post-U2 water via the U2
// selectors; mutates only U1's pairs/cohorts records (the authorised C2
// breeding writes). All randomness flows through ctx.rng.
import type {
  Fish,
  GameState,
  Species,
} from '@aquarium/u1-sim-foundation/state';
import type { Registry, System, TickContext } from '@aquarium/u1-sim-foundation';
import { tempFitFor, waterQuality } from '@aquarium/u2-tank-water';
import {
  breedingParamsFor,
  DEFAULT_BREEDING_PARAMS,
  drawClutch,
  eggClutchCount,
  makeEggsCohort,
  makeFryCohort,
  nextCohortId,
  rollFertility,
  scaledBroodCount,
  type BreedingParams,
} from './cohorts.js';
import './events.js';

/** Health below this line withholds spawns (BR14.2 gate). */
export const BREED_HEALTH_GATE = 40;

/** Satiety below this line withholds spawns (BR14.2 gate). */
export const BREED_SATIETY_GATE = 30;

/** tempFit below this line withholds spawns (BR14.2 bound gate). */
export const BREED_TEMP_FIT_GATE = 0.5;

/** Water quality below this line withholds spawns (BR14.2 bound gate). */
export const BREED_QUALITY_GATE = 40;

/** Care weights: satiety / water / temperature / calm (BR14.2). */
export const CONDITION_WEIGHTS = {
  satiety: 0.3,
  water: 0.3,
  temp: 0.25,
  calm: 0.15,
} as const;

export interface GateReport {
  mature: boolean;
  health: boolean;
  satiety: boolean;
  tempFit: boolean;
  quality: boolean;
}

/**
 * Gate check over precomputed tank reads. The tick hoists waterQuality /
 * tempFitFor out of the pair loop (breeding never writes water, so one
 * read per species per tick is exact); pairGates below is the same check
 * without the cache for direct callers.
 */
export function gateReport(
  quality: number,
  tempFit: number,
  female: Fish,
  male: Fish,
): GateReport {
  return {
    mature: female.mature && male.mature,
    health: female.health >= BREED_HEALTH_GATE && male.health >= BREED_HEALTH_GATE,
    satiety: female.satiety >= BREED_SATIETY_GATE && male.satiety >= BREED_SATIETY_GATE,
    tempFit: tempFit >= BREED_TEMP_FIT_GATE,
    quality: quality >= BREED_QUALITY_GATE,
  };
}

/**
 * Attempt gates (BR14.2): both members alive, mature, healthy and fed;
 * shared temperature and water bounds. Every gate must hold; a failure
 * withholds the spawn with no penalty and no event.
 */
export function pairGates(
  state: GameState,
  female: Fish,
  male: Fish,
  species: Species | undefined,
): GateReport {
  return gateReport(waterQuality(state), tempFitFor(state, species), female, male);
}

export function gatesPass(gates: GateReport): boolean {
  return gates.mature && gates.health && gates.satiety && gates.tempFit && gates.quality;
}

/**
 * Attempt condition (BR14.2): the scaled form of the bound gates, read off
 * the bearing female plus the shared tank. In [0, 1] at sane inputs.
 * conditionOf is the same formula over hoisted tank reads for the tick.
 */
export function conditionOf(quality: number, tempFit: number, bearer: Fish): number {
  return (
    CONDITION_WEIGHTS.satiety * (bearer.satiety / 100) +
    CONDITION_WEIGHTS.water * (quality / 100) +
    CONDITION_WEIGHTS.temp * tempFit +
    CONDITION_WEIGHTS.calm * (1 - bearer.stress / 100)
  );
}

export function attemptCondition(
  state: GameState,
  bearer: Fish,
  species: Species | undefined,
): number {
  return conditionOf(waterQuality(state), tempFitFor(state, species), bearer);
}

/** Per-tick attempt probability: base rate × condition, spread over 24 ticks. */
export function attemptProbability(speciesBaseRate: number, condition: number): number {
  return (speciesBaseRate * condition) / 24;
}

/** One breeding phase over every pair and cohort in the MVP tank (W22–W24).
 * Passes are fused for the NFR1.1 budget: one aging sweep, one pair sweep
 * (dissolve → promote → attempt → birth in insertion order), one
 * decay-then-hatch-then-cleanup sweep. Order semantics match the staged
 * form: aging precedes decay, decay precedes hatching (midnight-hatched
 * eggs never decay the same tick), newborns skip both aging and decay on
 * their birth tick, and a pair conceived here carries a future readyDay so
 * it can never birth in the same sweep.
 */
export function runBreedingTick(ctx: TickContext): void {
  const state = ctx.state;
  const today = ctx.now.day;
  // Hoisted tank reads: breeding never writes water, so one read per tick
  // is exact. Per-species rows resolve once and ride a one-entry cache —
  // the common case is a single breeding species per tank.
  const quality = waterQuality(state);
  let cachedSpeciesId: string | undefined;
  let cachedTempFit = 1;
  let cachedParams: BreedingParams = DEFAULT_BREEDING_PARAMS;
  const envFor = (species: Species | undefined, speciesId: string): void => {
    if (cachedSpeciesId === speciesId && cachedSpeciesId !== undefined) return;
    cachedSpeciesId = speciesId;
    cachedTempFit = tempFitFor(state, species);
    cachedParams = breedingParamsFor(species);
  };

  const pairs = state.pairs;
  const cohorts = state.cohorts;

  // W24 step 1 first half: every cohort ages an hour from laying, both stages.
  for (const id in cohorts) {
    const cohort = cohorts[id];
    if (cohort !== undefined) cohort.ageDays += 1 / 24;
  }

  // W24 step 1 second half (BR15.1): day-boundary decay for fry only.
  if (ctx.now.hour === 0) {
    for (const id in cohorts) {
      const cohort = cohorts[id];
      if (cohort === undefined || cohort.stage !== 'fry') continue;
      const foodOK = cohort.ageDays < 1
        ? 1
        : cohort.firstFoodDays >= Math.floor(cohort.ageDays) * 0.5
          ? 1
          : 0.5;
      const dailyKeep = 0.7 + 0.25 * (quality / 100) * foodOK;
      cohort.survivalFactor = dailyKeep;
      cohort.count = Math.floor(cohort.count * dailyKeep);
    }
  }

  // W22 step 2–3 + W23 (BR14.2–BR14.5, BR15.4): one sweep per pair.
  for (const id in pairs) {
    const pair = pairs[id];
    if (pair === undefined) continue;
    const female = state.fish[pair.femaleId];
    const male = state.fish[pair.maleId];
    if (female === undefined || male === undefined) {
      delete pairs[id];
      continue;
    }
    if (pair.state === 'cooling' && today >= pair.readyDay) pair.state = 'paired';
    const species = ctx.species.get(pair.speciesId);
    envFor(species, pair.speciesId);
    if (pair.state === 'paired') {
      // Hot-path inline of gateReport (no per-pair allocation; pairGates
      // stays the tested public form of the same five checks).
      const gatesPass =
        female.mature &&
        male.mature &&
        female.health >= BREED_HEALTH_GATE &&
        male.health >= BREED_HEALTH_GATE &&
        female.satiety >= BREED_SATIETY_GATE &&
        male.satiety >= BREED_SATIETY_GATE &&
        cachedTempFit >= BREED_TEMP_FIT_GATE &&
        quality >= BREED_QUALITY_GATE;
      if (!gatesPass) continue;
      const params = cachedParams;
      const condition = conditionOf(quality, cachedTempFit, female);
      if (ctx.rng.next() >= attemptProbability(params.speciesBaseRate, condition)) continue;
      if (species?.archetype === 'livebearer') {
        // W23a: conception. Pregnancy lives on the pair; birth at readyDay.
        pair.state = 'gravid';
        pair.readyDay = today + params.gestationDays;
        ctx.events.push({ kind: 'breedingStarted', fishIds: [pair.femaleId, pair.maleId] });
        continue;
      }
      // W23b: laying. Eggs incubate while the pair rests independently —
      // clutches may overlap when readyDay arrives before hatchDay.
      const clutch0 = drawClutch(ctx.rng, params);
      const fertility = rollFertility(ctx.rng);
      const count = eggClutchCount(clutch0, fertility, condition);
      const cohortId = nextCohortId(ctx.rng);
      cohorts[cohortId] = makeEggsCohort({
        id: cohortId,
        speciesId: pair.speciesId,
        tankId: state.tank.id,
        bornDay: today,
        count,
        hatchDay: today + params.hatchDays,
        sireGenome: (male.genome ?? {}) as Record<string, unknown>,
        damGenome: (female.genome ?? {}) as Record<string, unknown>,
        sireId: male.id,
        damId: female.id,
      });
      pair.state = 'cooling';
      pair.readyDay = today + params.cycleDays;
      ctx.events.push({ kind: 'breedingStarted', fishIds: [pair.femaleId, pair.maleId] });
      continue;
    }
    if (pair.state !== 'gravid' || today < pair.readyDay) continue;
    // W23a birth: a gravid pair due today drops one fry cohort and rests.
    const params = cachedParams;
    const condition = conditionOf(quality, cachedTempFit, female);
    const clutch0 = drawClutch(ctx.rng, params);
    const count = scaledBroodCount({
      clutch0,
      motherSizeCm: female.sizeCm,
      adultSizeCm: species?.adultSizeCm ?? female.sizeCm,
      condition,
      params,
    });
    const cohortId = nextCohortId(ctx.rng);
    cohorts[cohortId] = makeFryCohort({
      id: cohortId,
      speciesId: pair.speciesId,
      tankId: state.tank.id,
      bornDay: today,
      count,
      sireGenome: (male.genome ?? {}) as Record<string, unknown>,
      damGenome: (female.genome ?? {}) as Record<string, unknown>,
      sireId: male.id,
      damId: female.id,
    });
    pair.state = 'cooling';
    pair.readyDay = today + params.cycleDays;
    ctx.events.push({ kind: 'fryHatched', cohortId, count });
  }

  // W23b hatch + BR15.4: eggs due today become fry (the pair is untouched),
  // then emptied cohorts leave silently.
  for (const id in cohorts) {
    const cohort = cohorts[id];
    if (cohort === undefined) continue;
    if (cohort.stage === 'eggs' && today >= (cohort.hatchDay ?? today + 1)) {
      cohort.stage = 'fry';
      ctx.events.push({ kind: 'fryHatched', cohortId: cohort.id, count: cohort.count });
    }
    if (cohort.count <= 0) delete cohorts[id];
  }
}

export const breedingSystem: System = {
  id: 'u5.breeding',
  phase: 'breeding',
  run: runBreedingTick,
};

export function registerBreeding(registry: Registry): void {
  registry.registerSystem(breedingSystem);
}
