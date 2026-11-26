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
}

export interface Settings {
  reducedMotion: boolean;
  autoPauseCritical: boolean;
  volume: { master: number; sfx: number };
}

// --- Cross-unit entity shapes (behaviour owned elsewhere, types here) ---

export type FishId = string;
export type TankId = string;

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
  value: number;
  mature: boolean;
}

export interface TankWater {
  waste: number;
  temperature: number;
  ph: number;
}

export interface Tank {
  id: TankId;
  tier: number;
  volumeL: number;
  water: TankWater;
  equipment: string[];
  bioload: number;
  biofilterMaturity: number;
}

export interface FryCohort {
  id: string;
  speciesId: string;
  tankId: TankId;
  bornDay: number;
  count: number;
  ageDays: number;
  genomePool: Record<string, unknown>;
  survivalFactor: number;
}

export interface FoodItem {
  id: string;
  kind: string;
  qty: number;
  quality: number;
  shelfLifeDays: number;
}

export interface MarketState {
  speciesId: string;
  demand: number;
  trend: number;
  activeEvent?: string;
}

export type OrderStatus = 'open' | 'fulfilled' | 'expired';

export interface Order {
  id: string;
  speciesId: string;
  quantity: number;
  deadline: number;
  minQuality: number;
  reward: number;
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
  subjectId: string;
  message: string;
}

export interface GameState {
  seed: number;
  rngState: RngState;
  clock: GameClock;
  money: number;
  reputation: number;
  progression: PlayerProgression;
  tank: Tank;
  fish: Record<FishId, Fish>;
  cohorts: Record<string, FryCohort>;
  food: Record<string, FoodItem>;
  market: Record<string, MarketState>;
  orders: Order[];
  notifications: Notification[];
  settings: Settings;
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
    volumeL: 50,
    water: { waste: 0, temperature: 24, ph: 7 },
    equipment: [],
    bioload: 0,
    biofilterMaturity: 0,
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
