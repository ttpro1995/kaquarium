// store — the read-only shell binding over the U1 kernel (C1; W38).
// U7 never writes GameState: screens read a frozen snapshot built from the
// sim's own selectors, and player intent travels only through `dispatch`.
// The snapshot is rebuilt at most once per store version (no per-tick
// re-read while the version is unchanged) and every selector result inside
// it is deep-frozen, so a component cannot mutate the sim through the view.
// `resync` re-reads on demand (ticks/catch-up that bypass the shell
// dispatch) but notifies subscribers only when the snapshot changed.
import type { GameState, Settings } from '@aquarium/u1-sim-foundation/state';
import type { CommandMap, CommandOutcome } from '@aquarium/u1-sim-foundation/commands';
import type { Kernel } from '@aquarium/u1-sim-foundation';
import {
  level,
  money,
  notificationQueue,
  tankWater,
} from '@aquarium/u1-sim-foundation';
import {
  bioloadOf,
  capacity,
  qualityBandOf,
  waterQuality,
} from '@aquarium/u2-tank-water';
import { feedingProgram, foodStock, isExpired } from '@aquarium/u4-feeding';
import { cohortsInTank, pairsInTank } from '@aquarium/u5-breeding';
import { levelProgress } from '@aquarium/u6-commerce';

export interface FishView {
  readonly id: string;
  readonly speciesId: string;
  readonly tankId: string;
  readonly health: number;
  readonly satiety: number;
  readonly sizeCm: number;
  readonly stage: string;
  readonly mature: boolean;
  readonly value: number;
}

export interface WaterView {
  readonly waste: number;
  readonly nitrate: number;
  readonly tempC: number;
  readonly quality: number;
  readonly band: string;
  readonly bioload: number;
  readonly capacity: number;
}

export interface SettingsView {
  readonly reducedMotion: boolean;
  readonly autoPauseCritical: boolean;
  readonly volume: { readonly master: number; readonly sfx: number };
}

export interface OrderView {
  readonly id: string;
  readonly speciesId: string;
  readonly quantity: number;
  readonly deadlineDay: number;
  readonly status: string;
  readonly reward: number;
  readonly minHealth: number;
  readonly minSizeCm: number;
}

export interface NotificationView {
  readonly id: string;
  readonly priority: string;
  readonly kind: string;
  readonly message: string;
  readonly subjectId?: string;
}

export interface PairView {
  readonly id: string;
  readonly state: string;
  readonly readyDay: number;
}

export interface CohortView {
  readonly id: string;
  readonly stage: string;
  readonly count: number;
  readonly ageDays: number;
}

export interface FoodStackView {
  readonly id: string;
  readonly kind: string;
  readonly qty: number;
  readonly expired: boolean;
}

export interface ShellSnapshot {
  readonly version: number;
  readonly money: number;
  readonly reputation: number;
  readonly level: number;
  readonly xp: number;
  readonly xpToNext: number | null;
  readonly gameDay: number;
  readonly gameHour: number;
  readonly speed: number;
  readonly paused: boolean;
  readonly unreadCount: number;
  readonly fish: readonly FishView[];
  readonly water: WaterView;
  readonly settings: SettingsView;
  readonly orders: readonly OrderView[];
  readonly notifications: readonly NotificationView[];
  readonly pairs: readonly PairView[];
  readonly cohorts: readonly CohortView[];
  readonly foodStacks: readonly FoodStackView[];
  readonly feederInstalled: boolean;
}

export type SnapshotListener = (snap: Readonly<ShellSnapshot>) => void;

export interface ShellStore {
  snapshot(): Readonly<ShellSnapshot>;
  subscribe(listener: SnapshotListener): () => void;
  resync(): void;
  dispatch<K extends keyof CommandMap>(
    type: K,
    payload: CommandMap[K]['payload'],
  ): CommandOutcome<CommandMap[K]['result']>;
  getVersion(): number;
}

/** Recursively freeze a freshly built snapshot tree. No cycles by construction. */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    return Object.freeze(value);
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) deepFreeze(record[key]);
  return Object.freeze(value);
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => isDeepEqual(item, (b as unknown[])[index]));
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra);
  if (ka.length !== Object.keys(rb).length) return false;
  return ka.every((key) => isDeepEqual(ra[key], rb[key]));
}

/** Pure build from the sim's own selectors. Every nested object is fresh —
 *  the snapshot shares no references with kernel state. */
export function buildSnapshot(state: GameState, version: number): ShellSnapshot {
  const progress = levelProgress(state);
  const water = tankWater(state);
  const queue = notificationQueue(state);
  const program = feedingProgram(state);
  const fish = Object.values(state.fish)
    .map((f) => ({
      id: f.id,
      speciesId: f.speciesId,
      tankId: f.tankId,
      health: f.health,
      satiety: f.satiety,
      sizeCm: f.sizeCm,
      stage: f.stage,
      mature: f.mature,
      value: f.value,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const settings: Settings = state.settings;
  return deepFreeze({
    version,
    money: money(state),
    reputation: state.reputation,
    level: level(state),
    xp: progress.xp,
    xpToNext: progress.xpToNext,
    gameDay: state.clock.gameDay,
    gameHour: state.clock.gameHour,
    speed: state.clock.speed,
    paused: state.clock.paused,
    unreadCount: queue.length,
    fish,
    water: {
      waste: water.waste,
      nitrate: water.nitrate,
      tempC: water.tempC,
      quality: waterQuality(state),
      band: qualityBandOf(water.waste, water.nitrate),
      bioload: bioloadOf(state),
      capacity: capacity(state),
    },
    settings: {
      reducedMotion: settings.reducedMotion,
      autoPauseCritical: settings.autoPauseCritical,
      volume: { master: settings.volume.master, sfx: settings.volume.sfx },
    },
    orders: state.orders.map((o) => ({
      id: o.id,
      speciesId: o.speciesId,
      quantity: o.quantity,
      deadlineDay: o.deadlineDay,
      status: o.status,
      reward: o.reward,
      minHealth: o.minHealth,
      minSizeCm: o.minSizeCm,
    })),
    notifications: queue.map((n) =>
      n.subjectId === undefined
        ? { id: n.id, priority: n.priority, kind: n.kind, message: n.message }
        : { id: n.id, priority: n.priority, kind: n.kind, message: n.message, subjectId: n.subjectId },
    ),
    pairs: pairsInTank(state).map((p) => ({ id: p.id, state: p.state, readyDay: p.readyDay })),
    cohorts: cohortsInTank(state).map((c) => ({
      id: c.id,
      stage: c.stage,
      count: c.count,
      ageDays: c.ageDays,
    })),
    foodStacks: foodStock(state).map((s) => ({
      id: s.id,
      kind: s.kind,
      qty: s.qty,
      expired: isExpired(s, state.clock.gameDay),
    })),
    feederInstalled: program.installed,
  });
}

export function createShellStore(kernel: Kernel): ShellStore {
  let cached: { version: number; snap: Readonly<ShellSnapshot> } | null = null;
  let lastNotified: Readonly<ShellSnapshot> | null = null;
  const listeners = new Set<SnapshotListener>();

  function current(): Readonly<ShellSnapshot> {
    const version = kernel.store.version;
    if (cached !== null && cached.version === version) return cached.snap;
    const snap = buildSnapshot(kernel.store.state, version);
    cached = { version, snap };
    return snap;
  }

  function resync(): void {
    const snap = current();
    if (lastNotified !== null && (lastNotified === snap || isDeepEqual(lastNotified, snap))) {
      return;
    }
    lastNotified = snap;
    if (listeners.size === 0) return;
    for (const listener of [...listeners]) listener(snap);
  }

  // U1 drains subscribers BEFORE it bumps the version (drain, then
  // version += 1), so a listener that rebuilds synchronously would cache a
  // stale version key. The shell therefore resyncs on two paths: (1) the
  // dispatch wrapper below, which runs after the bump, and (2) a deferred
  // resync for ticks/catch-up that bypass the wrapper — by the time the
  // microtask runs, the bump has landed.
  kernel.store.subscribe(() => {
    void Promise.resolve().then(() => {
      resync();
    });
  });

  return {
    snapshot(): Readonly<ShellSnapshot> {
      return current();
    },
    subscribe(listener: SnapshotListener): () => void {
      // Baseline on first subscribe: subscribers read the present via
      // snapshot(); subscribe delivers future changes only, so a manual
      // resync with no intervening change stays silent.
      if (lastNotified === null) lastNotified = current();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    resync,
    dispatch(type, payload) {
      const outcome = kernel.dispatch(type, payload);
      resync();
      return outcome;
    },
    getVersion(): number {
      return kernel.store.version;
    },
  };
}
