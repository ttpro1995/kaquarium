// index — U6 composition surface. U7's composition root imports this
// module, which loads the CommandMap/SimEventMap augmentations and
// registers the commerce + notify systems, the five commands, and the
// single notification mapper against the U1 kernel.
import type { Registry } from '@aquarium/u1-sim-foundation';
import './events.js';
import './commands.js';
import { registerCommerce } from './commerce.js';
import { registerCommands } from './commands.js';
import { commerceNotificationMapper } from './notifications.js';

export function register(registry: Registry): void {
  registerCommerce(registry);
  registerCommands(registry);
  registry.registerNotificationMapper(commerceNotificationMapper);
}

export {
  SELL_HEALTH_GATE,
  SIZE_FACTOR_MIN,
  SIZE_FACTOR_MAX,
  MARKET_FACTOR_MIN,
  MARKET_FACTOR_MAX,
  clamp,
  sizeFactor,
  ageFactor,
  colourFactor,
  rarityFactor,
  healthFactor,
  geneticsFactor,
  marketFactor,
  formulaPrice,
  isSellableHealth,
  priceForFish,
} from './pricing.js';
export {
  SATURATION_PER_SALE,
  DEMAND_RECOVERY,
  TREND_CYCLE_DAYS,
  demandFor,
  trendFor,
  ensureMarketEntry,
  ensureMarketEntries,
  applySaleSaturation,
  recoverDemand,
  rollTrend,
  maybeRollTrends,
} from './market.js';
export {
  CUSTOMER_PARAMS,
  BOARD_MIN,
  BOARD_MAX,
  BOARD_EXTRA_P,
  customerPool,
  estimateReward,
  fulfilReward,
  generateOrder,
  openOrders,
  upkeepBoard,
  expireOrders,
  pruneBoard,
  type CustomerParams,
} from './orders.js';
export {
  SALE_XP_DIVISOR,
  HATCH_XP,
  FULFIL_XP_DIVISOR,
  LEVEL_XP,
  MAX_LEVEL,
  UNLOCKS,
  xpForSale,
  xpForReward,
  addXp,
} from './progression.js';
export {
  ELECTRICITY_COST,
  applyMidnightCosts,
  refreshFishValues,
  fastPriceForFish,
  hatchEventsSeen,
  runCommerceTick,
  runNotifyTick,
  commerceSystem,
  notifySystem,
  registerCommerce,
  boardOrders,
  type FishSickCause,
} from './commerce.js';
export {
  MAX_NOTIFICATIONS,
  commerceNotificationMapper,
  enforceQueueCap,
} from './notifications.js';
export {
  buyFish,
  sellFish,
  sellBulk,
  fulfil,
  dismiss,
  registerCommands,
  type BuyFishPayload,
  type BuyFishResult,
  type SellFishPayload,
  type SellFishResult,
  type SellBulkPayload,
  type SellBulkResult,
  type FulfilPayload,
  type FulfilResult,
  type DismissPayload,
  type DismissResult,
} from './commands.js';
export {
  sellPrice,
  bulkPreview,
  orderRewardPreview,
  buyableSpecies,
  levelProgress,
  notificationQueue,
  type SpeciesOf,
  type BulkPreviewItem,
  type BulkPreview,
  type LevelProgress,
} from './selectors.js';
