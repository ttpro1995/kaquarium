// index — U2 composition surface. U7's composition root imports this module,
// which loads the CommandMap/SimEventMap augmentations and registers the
// u2.water system plus the tank.* commands against the U1 kernel.
import type { Registry } from '@aquarium/u1-sim-foundation';
import './events.js';
import './commands.js';
import { registerWater } from './water.js';
import { registerCommands } from './commands.js';

export function register(registry: Registry): void {
  registerWater(registry);
  registerCommands(registry);
}

export {
  waterSystem,
  runWaterTick,
  registerWater,
  tankWater,
  waterQuality,
  capacity,
  projectedBioload,
  bioloadOf,
  tempFitFor,
  recomputeBioload,
  qualityBandOf,
  activityOf,
  tempFit,
  tempTargetC,
  clampChem,
  WASTE_RATE,
  NITRATE_RATIO,
  MATURITY_PER_TICK,
  TEMP_DRIFT,
  HEATER_TARGET_C,
  AMBIENT_TARGET_C,
  TEMP_MIN_C,
  TEMP_MAX_C,
  FILTER_CONVERSION,
  COHORT_LOAD_PER_FRY,
  TOLERANT_RANGE_C,
  TEMP_POOR_FIT,
} from './water.js';
export {
  waterChange,
  buyEquipment,
  upgradeTier,
  registerCommands,
  EQUIPMENT_UNLOCKS,
  TIER_UNLOCKS,
  type EquipmentKind,
  type WaterChangePayload,
  type WaterChangeResult,
  type BuyEquipmentPayload,
  type BuyEquipmentResult,
  type UpgradeTierPayload,
  type UpgradeTierResult,
} from './commands.js';
