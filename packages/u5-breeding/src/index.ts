// index — U5 composition surface. U7's composition root imports this
// module, which loads the CommandMap/SimEventMap augmentations and
// registers the u5.breeding system plus the breeding.* commands against
// the U1 kernel.
import type { Registry } from '@aquarium/u1-sim-foundation';
import './events.js';
import './commands.js';
import { registerBreeding } from './breeding.js';
import { registerCommands } from './commands.js';

export function register(registry: Registry): void {
  registerBreeding(registry);
  registerCommands(registry);
}

export {
  BREEDABLE_ARCHETYPES,
  isBreedableArchetype,
  validatePairing,
  findPairByFemale,
  nextPairId,
  createPair,
  dissolveDeadPairs,
  promoteCoolingPairs,
  type PairingError,
  type PairingErrorCode,
  type PairingCheck,
  type SpeciesOf,
  type BreedableArchetype,
} from './pairs.js';
export {
  DEFAULT_BREEDING_PARAMS,
  breedingParamsFor,
  nextCohortId,
  drawClutch,
  rollFertility,
  scaledBroodCount,
  eggClutchCount,
  stuntedAtGrading,
  makeFryCohort,
  makeEggsCohort,
  type BreedingParams,
  type CohortSeed,
} from './cohorts.js';
export {
  BREED_HEALTH_GATE,
  BREED_SATIETY_GATE,
  BREED_TEMP_FIT_GATE,
  BREED_QUALITY_GATE,
  CONDITION_WEIGHTS,
  pairGates,
  gateReport,
  gatesPass,
  attemptCondition,
  conditionOf,
  attemptProbability,
  runBreedingTick,
  breedingSystem,
  registerBreeding,
  type GateReport,
} from './breeding.js';
export {
  NURSERY_LOAD_PER_FRY,
  pair,
  unpair,
  grade,
  registerCommands,
  type PairPayload,
  type PairResult,
  type UnpairPayload,
  type UnpairResult,
  type GradePayload,
  type GradeResult,
} from './commands.js';
export {
  pairsInTank,
  cohortsInTank,
  breedingReadiness,
  gradePreview,
  type BreedingReadiness,
  type GradePreview,
  type GradePreviewReason,
} from './selectors.js';
