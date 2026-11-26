// index — U3 composition surface. U7's composition root imports this
// module, which loads the SimEventMap augmentation and registers the
// u3.fish system against the U1 kernel. U3 owns no commands: buying
// is U6's atomic command over the pure spawnFish factory, and births
// flow through U5 cohorts — this unit acts via its system plus the
// factories and selectors below.
import type { Registry } from '@aquarium/u1-sim-foundation';
import './events.js';
import { registerFish } from './fish.js';

export function register(registry: Registry): void {
  registerFish(registry);
}

export {
  fishSystem,
  runFishTick,
  registerFish,
  nextStage,
  neglectCause,
  deathCause,
  SATIETY_DECAY,
  REGEN_BASE,
  HUNGER_WEIGHT,
  POOR_WATER_WEIGHT,
  TEMP_WEIGHT,
  CROWD_WEIGHT,
  HUNGER_BELOW,
  POOR_WATER_BELOW,
  CLEAN_WATER_AT_LEAST,
  TEMP_STRESS_BELOW,
  SENIOR_FRACTION,
  CATCH_UP_HEALTH_FLOOR,
  FALLBACK_MATURITY_DAYS,
  FALLBACK_LIFESPAN_DAYS,
  type StageTransition,
  type DeathCause,
} from './fish.js';
export {
  spawnFish,
  inheritGenome,
  GENOME_LOCI,
  SPAWN_PREMIUM_P,
  SPAWN_SIZE_MIN,
  SPAWN_SIZE_SPAN,
  SPAWN_SATIETY,
  type Allele,
  type LocusPair,
  type Genome,
  type GenomeLocus,
  type SpawnedFish,
} from './factories.js';
export {
  healthBand,
  healthOf,
  overcrowded,
  crowdFactor,
  growthCondition,
  alleleSum,
  sizeMultiplier,
  vigorBonus,
  genomeQuality,
  colourFactor,
  rarityFactor,
  SICK_BELOW,
  CRITICAL_BELOW,
  type HealthBand,
} from './selectors.js';
