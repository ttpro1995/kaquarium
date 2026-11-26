// selectors — U5-owned pure readers for the U7 breeding screen.
// Nothing here mutates; every function is safe to call mid-tick.
// pairsInTank / cohortsInTank scope the panels to the MVP tank;
// breedingReadiness breaks down the next attempt; gradePreview projects
// the capacity guard and the stunt outcome without mutating.
import type {
  BreedingPair,
  FryCohort,
  GameState,
  Species,
} from '@aquarium/u1-sim-foundation/state';
import { COHORT_LOAD_PER_FRY } from '@aquarium/u2-tank-water';
import { attemptCondition, attemptProbability, gatesPass, pairGates, type GateReport } from './breeding.js';
import { breedingParamsFor } from './cohorts.js';

/** Every live bond whose female swims in the MVP tank. */
export function pairsInTank(state: GameState): BreedingPair[] {
  const out: BreedingPair[] = [];
  const pairs = state.pairs;
  for (const id in pairs) {
    const pair = pairs[id];
    if (pair === undefined) continue;
    const female = state.fish[pair.femaleId];
    if (female !== undefined && female.tankId === state.tank.id) out.push(pair);
  }
  return out;
}

/** Every cohort incubating or growing in the MVP tank. */
export function cohortsInTank(state: GameState): FryCohort[] {
  const out: FryCohort[] = [];
  const cohorts = state.cohorts;
  for (const id in cohorts) {
    const cohort = cohorts[id];
    if (cohort !== undefined && cohort.tankId === state.tank.id) out.push(cohort);
  }
  return out;
}

export interface BreedingReadiness {
  pairId: string;
  state: BreedingPair['state'];
  readyDay: number;
  condition: number;
  probabilityPerTick: number;
  gates: GateReport;
  passes: boolean;
}

/**
 * Condition breakdown for one bond (U7 breeding screen): gates, the
 * scaled condition, and the per-tick attempt probability. Unknown pairs
 * read as undefined, mirroring U3's healthOf.
 */
export function breedingReadiness(
  state: GameState,
  pairId: string,
  species: Species | undefined,
): BreedingReadiness | undefined {
  const pair = state.pairs[pairId];
  if (pair === undefined) return undefined;
  const female = state.fish[pair.femaleId];
  const male = state.fish[pair.maleId];
  if (female === undefined || male === undefined) return undefined;
  const gates = pairGates(state, female, male, species);
  const condition = attemptCondition(state, female, species);
  return {
    pairId: pair.id,
    state: pair.state,
    readyDay: pair.readyDay,
    condition,
    probabilityPerTick: attemptProbability(breedingParamsFor(species).speciesBaseRate, condition),
    gates,
    passes: pair.state === 'paired' && gatesPass(gates),
  };
}

export type GradePreviewReason = 'eggs' | 'not-ready' | 'invalid-count' | 'tank-full' | null;

export interface GradePreview {
  cohortId: string;
  count: number;
  ready: boolean;
  reason: GradePreviewReason;
  projectedLoad: number;
  capacity: number;
  fits: boolean;
  stunted: boolean;
}

/**
 * Confirm-screen projection (BR15.2, BR15.3): the same batch formula the
 * grade command enforces, plus the stunt outcome — computed, never
 * written. Unknown cohorts or species read as undefined.
 */
export function gradePreview(
  state: GameState,
  species: Species | undefined,
  cohortId: string,
  count: number,
): GradePreview | undefined {
  const cohort = state.cohorts[cohortId];
  if (cohort === undefined || species === undefined) return undefined;
  const capacity = state.tank.volumeL;
  const stunted = cohort.firstFoodDays < species.juvenileDays / 2;
  if (cohort.stage === 'eggs') {
    return {
      cohortId, count, ready: false, reason: 'eggs',
      projectedLoad: state.tank.bioload, capacity, fits: false, stunted,
    };
  }
  if (cohort.ageDays < species.juvenileDays) {
    return {
      cohortId, count, ready: false, reason: 'not-ready',
      projectedLoad: state.tank.bioload, capacity, fits: false, stunted,
    };
  }
  if (!Number.isInteger(count) || count < 1 || count > cohort.count) {
    return {
      cohortId, count, ready: false, reason: 'invalid-count',
      projectedLoad: state.tank.bioload, capacity, fits: false, stunted,
    };
  }
  const projectedLoad = state.tank.bioload + count * (species.adultSizeCm - COHORT_LOAD_PER_FRY);
  const fits = projectedLoad <= capacity;
  return {
    cohortId,
    count,
    ready: fits,
    reason: fits ? null : 'tank-full',
    projectedLoad,
    capacity,
    fits,
    stunted,
  };
}
