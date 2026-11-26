// index — U4 composition surface. U7's composition root imports this
// module, which loads the CommandMap/SimEventMap augmentations and
// registers the u4.feeding system plus the feeding.* commands against
// the U1 kernel.
import type { Registry } from '@aquarium/u1-sim-foundation';
import './events.js';
import './commands.js';
import { registerFeeding } from './feeding.js';
import { registerCommands } from './commands.js';

export function register(registry: Registry): void {
  registerFeeding(registry);
  registerCommands(registry);
}

export {
  FOOD_CATALOG,
  WASTE_PER_PORTION,
  SATIETY_PER_PORTION,
  isFoodKind,
  isExpired,
  restorePerPortion,
  usableFoodStacks,
  nextFoodId,
  makeStack,
  type FoodKind,
  type FoodCatalogueRow,
} from './food.js';
export {
  isScheduleKind,
  absoluteHour,
  emptySchedule,
  makeSchedule,
  isScheduleDue,
  validateScheduleInput,
  type ScheduleFoodKind,
  type ScheduleInput,
} from './schedule.js';
export {
  dispenseToFish,
  dispenseToFry,
  expirySweep,
  runFeedingTick,
  feedingSystem,
  registerFeeding,
  type DispenseResult,
} from './feeding.js';
export {
  buyFood,
  feedFish,
  feedFry,
  setAutoFeeder,
  spend,
  registerCommands,
} from './commands.js';
export type {
  BuyFoodPayload,
  BuyFoodResult,
  FeedFishPayload,
  FeedFishResult,
  FeedFryPayload,
  FeedFryResult,
  SetAutoFeederPayload,
  SetAutoFeederResult,
} from './commands.js';
export {
  foodStock,
  usableFood,
  feedingProgram,
  type FeedingProgram,
} from './selectors.js';
