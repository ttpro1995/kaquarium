// types — U1 shared schema (entities.md, C1). U1 defines every entity
// TYPE; each sim unit owns behaviour over its entity and never redefines
// another unit's type. Fish.tankId is authoritative (Q2-B, no Tank.fishIds).
// GameClock.paused mirrors speed === 0; RngState.seed mirrors GameState.seed.

export type Speed = 0 | 1 | 2 | 4;

export interface GameTime {
  day: number;
  hour: number;
}

export interface GameClock {
  gameDay: number;
  gameHour: number; // 0..23
  speed: Speed; // 0 = paused
  paused: boolean; // INVARIANT: paused == (speed === 0)
}

export interface RngState {
  seed: number; // INVARIANT: mirrors GameState.seed; set once at boot
  a: number; // stream cursor; advances on every draw
}

export type SpeciesArchetype =
  | 'livebearer'
  | 'scatter'
  | 'plant'
  | 'cave'
  | 'bubbleNester'
  | 'annual'
  | 'hardBreed';

export type TankLayer = 'top' | 'middle' | 'bottom';

export interface Species {
  id: string;
  name: Record<string, string>;
  archetype: SpeciesArchetype;
  tier: 1 | 2 | 3;
  care: number;
  buyPrice: number;
  sellBase: number;
  adultSizeCm: number;
  lifespanDays: number;
  maturityDays: number;
  juvenileDays: number;
  diet: { type: string; firstFoodRequired: boolean };
  genes: Record<string, unknown>;
  palette: Record<string, unknown>;
  pattern: string;
  fin: string;
  schooling: number;
  territorial: number;
  layer: TankLayer;
  /** U1 data completion (U2 reads): optional [min, max] °C; absent means tolerant 20-28. */
  tempRangeC?: readonly [number, number];
}

export interface Settings {
  reducedMotion: boolean;
  autoPauseCritical: boolean;
  volume: { master: number; sfx: number };
}

// --- Cross-unit entity shapes (behaviour owned elsewhere, types here) ---

export type FishId = string;
export type TankId = string;
export type CohortId = string;
export type PairId = string;

export interface Fish {
  id: FishId;
  speciesId: string;
  tankId: TankId; // authoritative membership (Q2-B)
  sex: 'male' | 'female';
  stage: 'juvenile' | 'adult' | 'senior';
  ageDays: number;
  sizeCm: number;
  health: number;
  satiety: number;
  stress: number;
  genome: Record<string, unknown>;
  /** U5 data completion (U2 migration fills): permanent first-food penalty. */
  stunted: boolean;
  value: number;
  mature: boolean;
}

export interface TankWater {
  waste: number;
  nitrate: number;
  tempC: number;
}

export type WaterQualityBand = 'good' | 'fair' | 'poor';

export interface FilterSpec {
  level: 1 | 2 | 3;
  conversionRate: number;
}

export interface HeaterSpec {
  installed: boolean;
}

export interface AutoFeederDevice {
  installed: boolean;
}

export interface LightSpec {
  level: 1 | 2 | 3;
}

export interface Equipment {
  filter: FilterSpec;
  heater: HeaterSpec;
  autoFeeder: AutoFeederDevice;
  light: LightSpec;
}

export interface Tank {
  id: TankId;
  tier: number;
  volumeL: number;
  water: TankWater;
  equipment: Equipment;
  bioload: number;
  biofilterMaturity: number;
  /** Edge-trigger for fishSick; updated to the current band every water tick. */
  prevQualityBand: WaterQualityBand;
  /** True while a tankOvercrowded episode is open. */
  overcrowdLatch: boolean;
  /** True while a temperature-stress episode is open. */
  tempPoorLatch: boolean;
}

/** Tier-to-volume pairing (BR8.6, BR9.2): the single source both U1 defaults and U2 validation read. */
export const TIER_VOLUME_L: Record<1 | 2 | 3, number> = { 1: 20, 2: 60, 3: 150 };

export function tierVolumeL(tier: number): number {
  if (tier === 1 || tier === 2 || tier === 3) return TIER_VOLUME_L[tier];
  throw new Error(`tierVolumeL: unknown tier ${tier}`);
}

export type CohortStage = 'eggs' | 'fry';

export interface FryCohort {
  id: string;
  speciesId: string;
  tankId: TankId;
  bornDay: number;
  count: number;
  ageDays: number;
  genomePool: Record<string, unknown>;
  survivalFactor: number;
  stage: CohortStage;
  /** Set for eggs; fry stage begins at hatchDay. */
  hatchDay?: number;
  /** Distinct game days with >=1 fry feeding; written by U4 feedFry (types fixed in U5). */
  firstFoodDays: number;
  /** 0 = never; day idempotency key. */
  lastFryFedDay: number;
}

/** Player-formed pair bond; all pregnancy/cooldown state lives here, never on Fish. */
export type PairState = 'paired' | 'gravid' | 'cooling';

export interface BreedingPair {
  id: PairId;
  femaleId: FishId;
  maleId: FishId;
  speciesId: string;
  state: PairState;
  /** Birth due (gravid) or cooldown end (cooling); attempts run while paired. */
  readyDay: number;
}

export type FoodKind = 'flakes' | 'pellets' | 'liveFirst';
export type FoodTarget = 'fish' | 'fry';

export interface FoodItem {
  id: string;
  kind: string;
  qty: number;
  quality: number;
  shelfLifeDays: number;
  /** Game day of purchase; expiry origin (U4-added). */
  acquiredDay: number;
  /** liveFirst is fry-flagged; flakes/pellets are fish food (U4-added). */
  target: FoodTarget;
}

/** Auto-feeder program; lives in GameState.feeding.schedule (null = no program). */
export interface FeedingSchedule {
  /** Fish-target kinds only; fry food never auto-dispenses. */
  foodKind: string;
  portions: number;
  intervalHours: number;
  /** Absolute game-hour of the last run; absolute clock, deterministic. */
  lastRunHour: number;
}

export interface FeedingState {
  schedule: FeedingSchedule | null;
}

export interface MarketState {
  speciesId: string;
  demand: number;
  trend: number;
  activeEvent?: string;
  /** Game day of the last trend roll; drives the 3-day cycle. */
  lastTrendDay: number;
}

export type OrderStatus = 'open' | 'fulfilled' | 'expired';

export type OrderCustomer = 'hobbyist' | 'petShop' | 'collector';

export interface Order {
  id: string;
  speciesId: string;
  customer: OrderCustomer;
  quantity: number;
  minHealth: number;
  /** Species market size; fulfil fish must meet it. */
  minSizeCm: number;
  /** 1.2 / 1.05 / 1.5 by customer; fulfil-time reward basis. */
  multiplier: number;
  /** Board estimate at generation; replaced by the actual fulfil-time amount on fulfil. */
  reward: number;
  /** 3-7 days out; expiry at day boundary past deadline. */
  deadlineDay: number;
  status: OrderStatus;
}

export interface PlayerProgression {
  level: number; // 1..3
  xp: number;
  unlocks: string[];
}

export type NotificationPriority = 'info' | 'warn' | 'critical';

export interface Notification {
  id: string;
  priority: NotificationPriority;
  kind: string;
  /** Fish/cohort/order id the UI focuses; absent for summaries. */
  subjectId?: string;
  message: string;
}

export interface GameState {
  seed: number;
  rngState: RngState;
  clock: GameClock;
  money: number; // $FISH, always >= 0, integer
  reputation: number; // integer, floor 0
  progression: PlayerProgression;
  tank: Tank; // the single MVP tank, behaviour owned by U2
  fish: Record<FishId, Fish>;
  cohorts: Record<string, FryCohort>;
  food: Record<string, FoodItem>;
  market: Record<string, MarketState>;
  orders: Order[];
  notifications: Notification[];
  settings: Settings;
  /** U5 data completion: player-formed pair bonds; pre-U5 saves gain {} from migration. */
  pairs: Record<PairId, BreedingPair>;
  /** U4 data completion: auto-feeder program slot; empty until programmed. */
  feeding: FeedingState;
}

export type SlotRef =
  | { kind: 'auto'; index: 1 | 2 | 3 }
  | { kind: 'manual'; name: string };

export interface SlotInfo {
  ref: SlotRef;
  savedAt: string;
  level: number;
  money: number;
  playtimeMs: number;
}

export interface SaveChecksum {
  algorithm: 'SHA-256';
  scope: string;
  value: string;
}

export interface SaveEnvelope {
  schemaVersion: number;
  savedAt: string;
  playtimeMs: number;
  checksum: SaveChecksum;
  state: GameState;
}

export const START_MONEY = 100;
export const START_DAY = 1;
export const START_HOUR = 8;

export function defaultSettings(): Settings {
  return { reducedMotion: false, autoPauseCritical: true, volume: { master: 0.8, sfx: 0.8 } };
}

export function defaultTank(): Tank {
  return {
    id: 'tank-1',
    tier: 1,
    volumeL: 20,
    water: { waste: 0, nitrate: 0, tempC: 24 },
    equipment: {
      filter: { level: 1, conversionRate: 2 },
      heater: { installed: false },
      autoFeeder: { installed: false },
      light: { level: 1 },
    },
    bioload: 0,
    biofilterMaturity: 0,
    prevQualityBand: 'good',
    overcrowdLatch: false,
    tempPoorLatch: false,
  };
}

export function createInitialState(seed: number, opts?: { speed?: Speed; money?: number }): GameState {
  if (!Number.isInteger(seed) || seed < 0) throw new Error('createInitialState: seed must be an integer >= 0');
  const speed: Speed = opts?.speed ?? 1;
  return {
    seed,
    rngState: { seed, a: seed >>> 0 },
    clock: { gameDay: START_DAY, gameHour: START_HOUR, speed, paused: speed === 0 },
    money: opts?.money ?? START_MONEY,
    reputation: 0,
    progression: { level: 1, xp: 0, unlocks: [] },
    tank: defaultTank(),
    fish: {},
    cohorts: {},
    food: {},
    market: {},
    orders: [],
    notifications: [],
    settings: defaultSettings(),
    pairs: {},
    feeding: { schedule: null },
  };
}

const SPEEDS: readonly number[] = [0, 1, 2, 4];

/** Mirror rule (BR1.3): paused holds exactly when speed is 0. */
export function isClockPaused(speed: Speed): boolean {
  return speed === 0;
}

/** Clock constraint check (BR1.3). Returns a list of violations; empty = valid. */
export function validateClock(clock: GameClock): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(clock.gameDay) || clock.gameDay < 0) errors.push('gameDay must be an integer >= 0');
  if (!Number.isInteger(clock.gameHour) || clock.gameHour < 0 || clock.gameHour > 23) {
    errors.push('gameHour must be an integer 0..23');
  }
  if (!SPEEDS.includes(clock.speed)) errors.push('speed must be one of 0|1|2|4');
  if (clock.paused !== isClockPaused(clock.speed)) errors.push('paused must equal (speed === 0)');
  return errors;
}

/** Shallow structural check over the kernel-owned invariants. */
export function validateGameState(state: GameState): string[] {
  const errors: string[] = [];
  errors.push(...validateClock(state.clock).map((e) => `clock: ${e}`));
  if (state.rngState.seed !== state.seed) errors.push('rngState.seed must mirror GameState.seed');
  if (!Number.isInteger(state.money) || state.money < 0) errors.push('money must be an integer >= 0');
  return errors;
}
