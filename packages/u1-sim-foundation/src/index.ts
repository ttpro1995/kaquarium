// @aquarium/u1-sim-foundation — shared simulation kernel (U1).
// U1 defines every entity type and the integration spine (store, command
// bus, tick registry, event drain, species data, save/load); each sim
// unit owns behaviour over its entity and registers against this kernel.
export type { GameState, GameClock, GameTime, RngState, Species, Settings } from './types.js';
export type {
  Fish,
  FishId,
  Tank,
  TankId,
  TankWater,
  WaterQualityBand,
  FilterSpec,
  HeaterSpec,
  AutoFeederDevice,
  LightSpec,
  Equipment,
  CohortId,
  PairId,
  CohortStage,
  FryCohort,
  PairState,
  BreedingPair,
  FoodKind,
  FoodTarget,
  FoodItem,
  FeedingSchedule,
  FeedingState,
  MarketState,
  Order,
  OrderCustomer,
  OrderStatus,
  PlayerProgression,
  Notification,
  NotificationPriority,
  SaveEnvelope,
  SlotInfo,
  SlotRef,
  SaveChecksum,
  Speed,
} from './types.js';
export {
  createInitialState,
  validateClock,
  validateGameState,
  isClockPaused,
  starterFoodStack,
  tierVolumeL,
  TIER_VOLUME_L,
  STARTER_FOOD_ID,
  defaultTank,
} from './types.js';
export { canonicalJson } from './canonicalJson.js';
export { createRng, type Rng } from './rng.js';
export { createStore, replaceStoreState, type Store, type MutableStore, type FaultDescriptor } from './store.js';
export {
  createRegistry,
  PHASE_ORDER,
  type Phase,
  type Registry,
  type System,
  type TickContext,
} from './registry.js';
export {
  type CommandMap,
  type CommandContext,
  type CommandHandler,
  type CommandOutcome,
  type CommandError,
  type CommandErrorCode,
  declareCommandType,
  declaredCommandTypes,
} from './commands.js';
export { registerKernelCommands, dispatchCommand } from './bus.js';
export {
  type SimEventMap,
  type SimEvent,
  type BaseSimEvent,
  type KnownSimEvent,
  type MoneyChangedPayload,
  type NotificationMapper,
  type SimEventSubscriber,
  drainEventBuffer,
} from './events.js';
export { runTick, type TickResult } from './tick.js';
export { runCatchUp, MAX_CATCH_UP_TICKS, type CatchUpSummary } from './catchup.js';
export { money, level, fishById, fishInTank, sellableFish, notificationQueue, tankWater } from './selectors.js';
export {
  emptyCatalog,
  MemoryCatalog,
  validateSpeciesEntry,
  loadSpeciesCatalog,
  type SpeciesCatalog,
  type CatalogMode,
  type CatalogLogger,
} from './species.js';
export {
  CURRENT_SCHEMA_VERSION,
  CHECKSUM_SCOPE,
  MAX_SAVE_BYTES,
  MAX_FISH,
  MAX_COHORTS,
  MAX_ORDERS,
  MAX_NOTIFICATIONS,
  MAX_FOOD_STACKS,
  MAX_PAIRS,
  MemoryStorage,
  sealEnvelope,
  createSaveSystem,
  type StoragePort,
  type SaveError,
  type SaveErrorCode,
  type SaveOutcome,
  type LoadOutcome,
  type DeleteOutcome,
  type SaveLoadApi,
  type SaveSystemOptions,
  type SaveSystemLogger,
} from './persistence/persistence.js';
export {
  migrateV1ToV2,
  deriveQualityBand,
  deriveOvercrowdLatch,
  deriveTempPoorLatch,
  defaultFoodTarget,
} from './persistence/migration.js';
export { sha256Hex } from './persistence/sha256.js';
export { createKernel, type Kernel, type KernelOptions } from './kernel.js';
