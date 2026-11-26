// persistence — slots, save/load, JSON export/import (C6, BR6.1–BR6.4).
// One version authority: schemaVersion lives in the envelope only.
// The digest covers the canonical UTF-8 JSON of every envelope field
// except checksum itself. Durability order: write a temporary key,
// read back to verify, swap to the active key; retry once, fall back,
// then warn and disable autosave until the next successful write.
import { canonicalJson } from '../canonicalJson.js';
import { sha256Hex } from './sha256.js';
import { migrateV1ToV2 } from './migration.js';
import { tierVolumeL } from '../types.js';
import { replaceStoreState, type MutableStore } from '../store.js';
import { validateClock, type GameState, type SaveEnvelope, type SlotInfo, type SlotRef } from '../types.js';

export const CURRENT_SCHEMA_VERSION = 2;
export const CHECKSUM_SCOPE = 'schemaVersion + savedAt + playtimeMs + state';

/** NFR4.3: raw save text beyond this never reaches JSON.parse. */
export const MAX_SAVE_BYTES = 2 * 1024 * 1024;

/** NFR4.3 pre-migrate count gate: inflated payloads never reach migrate or the O(fish) scan. */
export const MAX_FISH = 1000;
export const MAX_COHORTS = 500;
export const MAX_ORDERS = 6;
export const MAX_NOTIFICATIONS = 100;
export const MAX_FOOD_STACKS = 24;
export const MAX_PAIRS = 500;

export type SaveErrorCode =
  | 'CORRUPT_JSON'
  | 'INVALID_SHAPE'
  | 'UNSUPPORTED_VERSION'
  | 'CHECKSUM_MISMATCH'
  | 'MIGRATION_FAILED'
  | 'STORAGE_UNAVAILABLE'
  | 'SLOT_NOT_FOUND'
  | 'STALE_SAVE';

export interface SaveError {
  code: SaveErrorCode;
  message: string; // safe to show the player
}

export type SaveOutcome = { ok: true; ref: SlotRef; savedAt: string } | { ok: false; error: SaveError };
export type LoadOutcome = { ok: true; ref: SlotRef; stale: boolean } | { ok: false; error: SaveError };
export type DeleteOutcome = { ok: true; ref: SlotRef } | { ok: false; error: SaveError };


/** Browser storage abstracted so tests inject an in-memory double. */
export interface StoragePort {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryStorage implements StoragePort {
  private readonly data = new Map<string, string>();
  /** Journal of write keys, in order (oldest first). */
  readonly writes: string[] = [];
  /** Throw on the next N writes (fault injection). */
  failWrites = 0;

  read(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  write(key: string, value: string): void {
    this.writes.push(`write:${key}`);
    if (this.failWrites > 0) {
      this.failWrites -= 1;
      throw new Error(`MemoryStorage: injected write failure for '${key}'`);
    }
    this.data.set(key, value);
  }

  remove(key: string): void {
    this.data.delete(key);
  }
}

const AUTO_PREFIX = 'kaquarium.save.auto.';
const MANUAL_PREFIX = 'kaquarium.save.manual.';
const TEMP_KEY = 'kaquarium.save.tmp';
const ACTIVE_KEY = 'kaquarium.save.activeRef';
const INDEX_KEY = 'kaquarium.save.manual.index';
const NEXT_AUTO_KEY = 'kaquarium.save.auto.next';
const LAST_SEEN_KEY = 'kaquarium.save.lastSeen';

export interface SaveSystemLogger {
  warn(message: string): void;
  info(message: string): void;
}

export interface SaveSystemOptions {
  store: MutableStore;
  primary: StoragePort;
  fallback?: StoragePort;
  now?: () => string;
  logger?: SaveSystemLogger;
  /** from-version -> migrated state, applied iteratively. */
  migrations?: Record<number, (state: unknown) => unknown>;
  playtimeMs?: number;
}

function slotKey(ref: SlotRef): string {
  return ref.kind === 'auto' ? `${AUTO_PREFIX}${ref.index}` : `${MANUAL_PREFIX}${encodeURIComponent(ref.name)}`;
}

function parseSlotRef(raw: string): SlotRef | null {
  try {
    const parsed = JSON.parse(raw) as SlotRef;
    if (parsed && parsed.kind === 'auto' && (parsed.index === 1 || parsed.index === 2 || parsed.index === 3)) {
      return parsed;
    }
    if (parsed && parsed.kind === 'manual' && typeof parsed.name === 'string' && parsed.name.length > 0) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Seal a state into a versioned envelope with a fresh digest (snapshotted). */
export function sealEnvelope(
  state: GameState,
  savedAt: string,
  playtimeMs: number,
  schemaVersion: number = CURRENT_SCHEMA_VERSION,
): SaveEnvelope {
  const snapshot = JSON.parse(JSON.stringify(state)) as GameState;
  const body = { schemaVersion, savedAt, playtimeMs, state: snapshot };
  const value = sha256Hex(canonicalJson(body));
  return {
    schemaVersion,
    savedAt,
    playtimeMs,
    checksum: { algorithm: 'SHA-256', scope: CHECKSUM_SCOPE, value },
    state: snapshot,
  };
}

function recomputeChecksum(envelope: {
  schemaVersion: number;
  savedAt: string;
  playtimeMs: number;
  state: unknown;
}): string {
  return sha256Hex(
    canonicalJson({
      schemaVersion: envelope.schemaVersion,
      savedAt: envelope.savedAt,
      playtimeMs: envelope.playtimeMs,
      state: envelope.state,
    }),
  );
}

const BANNED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Recursive key scan (NFR4.4): rejects prototype-pollution keys at any depth. */
function findBannedKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findBannedKey(item);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value)) {
      if (BANNED_KEYS.has(key)) return key;
      const hit = findBannedKey((value as Record<string, unknown>)[key]);
      if (hit) return hit;
    }
  }
  return null;
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function inRange(value: unknown, min: number, max: number): value is number {
  return isFiniteNumber(value) && value >= min && value <= max;
}

/** Pre-migration count gate (NFR4.3 layer 6): runs on the raw state after checksum, before migrate. */
function countGateErrors(state: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const counts: Array<[string, number]> = [
    ['fish', MAX_FISH],
    ['cohorts', MAX_COHORTS],
    ['orders', MAX_ORDERS],
    ['notifications', MAX_NOTIFICATIONS],
    ['food', MAX_FOOD_STACKS],
  ];
  for (const [field, cap] of counts) {
    const value = state[field];
    const size = Array.isArray(value) ? value.length : isRecord(value) ? Object.keys(value).length : -1;
    if (size >= 0 && size > cap) errors.push(`state.${field} exceeds the import cap of ${cap}`);
  }
  return errors;
}

const WATER_BANDS = new Set(['good', 'fair', 'poor']);
const COHORT_STAGES = new Set(['eggs', 'fry']);
const FOOD_KINDS = new Set(['flakes', 'pellets', 'liveFirst']);
const FOOD_TARGETS = new Set(['fish', 'fry']);
const PAIR_STATES = new Set(['paired', 'gravid', 'cooling']);
const ORDER_CUSTOMERS = new Set(['hobbyist', 'petShop', 'collector']);
const ORDER_STATUSES = new Set(['open', 'fulfilled', 'expired']);

function validateTank(tank: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(tank)) return ['state.tank must be an object'];
  if (!isNonEmptyString(tank.id)) errors.push('state.tank.id must be a non-empty string');
  if (!isInt(tank.tier) || (tank.tier as number) < 1 || (tank.tier as number) > 3) {
    errors.push('state.tank.tier must be an integer 1..3');
  } else {
    let expected = -1;
    try {
      expected = tierVolumeL(tank.tier as number);
    } catch {
      expected = -1;
    }
    if (tank.volumeL !== expected) errors.push('state.tank.volumeL must match its tier (20 / 60 / 150)');
  }
  const water = tank.water;
  if (!isRecord(water)) {
    errors.push('state.tank.water must be an object');
  } else {
    if (!inRange(water.waste, 0, 100)) errors.push('state.tank.water.waste must be a number 0..100');
    if (!inRange(water.nitrate, 0, 100)) errors.push('state.tank.water.nitrate must be a number 0..100');
    if (!inRange(water.tempC, 10, 35)) errors.push('state.tank.water.tempC must be a number 10..35');
  }
  const equipment = tank.equipment;
  if (!isRecord(equipment)) {
    errors.push('state.tank.equipment must be an object');
  } else {
    const filter = equipment.filter;
    if (!isRecord(filter) || !isInt(filter.level) || ![1, 2, 3].includes(filter.level as number)) {
      errors.push('state.tank.equipment.filter.level must be 1 | 2 | 3');
    } else if (!isFiniteNumber(filter.conversionRate) || (filter.conversionRate as number) < 0) {
      errors.push('state.tank.equipment.filter.conversionRate must be a number >= 0');
    }
    for (const device of ['heater', 'autoFeeder'] as const) {
      const entry = equipment[device];
      if (!isRecord(entry) || typeof entry.installed !== 'boolean') {
        errors.push(`state.tank.equipment.${device}.installed must be a boolean`);
      }
    }
    const light = equipment.light;
    if (!isRecord(light) || !isInt(light.level) || ![1, 2, 3].includes(light.level as number)) {
      errors.push('state.tank.equipment.light.level must be 1 | 2 | 3');
    }
  }
  if (!isFiniteNumber(tank.bioload) || (tank.bioload as number) < 0) {
    errors.push('state.tank.bioload must be a number >= 0');
  }
  if (!inRange(tank.biofilterMaturity, 0, 1)) {
    errors.push('state.tank.biofilterMaturity must be a number 0..1');
  }
  if (typeof tank.prevQualityBand !== 'string' || !WATER_BANDS.has(tank.prevQualityBand)) {
    errors.push('state.tank.prevQualityBand must be good | fair | poor');
  }
  for (const latch of ['overcrowdLatch', 'tempPoorLatch'] as const) {
    if (typeof tank[latch] !== 'boolean') errors.push(`state.tank.${latch} must be a boolean`);
  }
  return errors;
}

function validateCollections(state: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!isRecord(state.fish)) {
    errors.push('state.fish must be an object');
  } else {
    for (const id of Object.keys(state.fish)) {
      const entry = (state.fish as Record<string, unknown>)[id];
      if (!isRecord(entry)) {
        errors.push(`state.fish.${id} must be an object`);
        continue;
      }
      if (!isRecord(entry.genome)) errors.push(`state.fish.${id}.genome must be a record`);
      if (typeof entry.stunted !== 'boolean') errors.push(`state.fish.${id}.stunted must be a boolean`);
    }
  }
  if (!isRecord(state.cohorts)) {
    errors.push('state.cohorts must be an object');
  } else {
    for (const id of Object.keys(state.cohorts)) {
      const entry = (state.cohorts as Record<string, unknown>)[id];
      if (!isRecord(entry)) {
        errors.push(`state.cohorts.${id} must be an object`);
        continue;
      }
      if (typeof entry.stage !== 'string' || !COHORT_STAGES.has(entry.stage)) {
        errors.push(`state.cohorts.${id}.stage must be eggs | fry`);
      }
      if (!isInt(entry.count) || (entry.count as number) < 0) {
        errors.push(`state.cohorts.${id}.count must be an integer >= 0`);
      }
      if (!isFiniteNumber(entry.ageDays) || (entry.ageDays as number) < 0) {
        errors.push(`state.cohorts.${id}.ageDays must be a number >= 0`);
      }
      if (!isRecord(entry.genomePool)) errors.push(`state.cohorts.${id}.genomePool must be a record`);
      for (const counter of ['firstFoodDays', 'lastFryFedDay'] as const) {
        if (!isInt(entry[counter]) || ((entry[counter] as number) as number) < 0) {
          errors.push(`state.cohorts.${id}.${counter} must be an integer >= 0`);
        }
      }
    }
  }
  if (!isRecord(state.food)) {
    errors.push('state.food must be an object');
  } else {
    for (const id of Object.keys(state.food)) {
      const entry = (state.food as Record<string, unknown>)[id];
      if (!isRecord(entry)) {
        errors.push(`state.food.${id} must be an object`);
        continue;
      }
      if (typeof entry.kind !== 'string' || !FOOD_KINDS.has(entry.kind)) {
        errors.push(`state.food.${id}.kind must be flakes | pellets | liveFirst`);
      }
      if (!isInt(entry.qty) || (entry.qty as number) < 1) {
        errors.push(`state.food.${id}.qty must be an integer >= 1`);
      }
      if (!isInt(entry.acquiredDay) || (entry.acquiredDay as number) < 1) {
        errors.push(`state.food.${id}.acquiredDay must be an integer >= 1`);
      }
      if (typeof entry.target !== 'string' || !FOOD_TARGETS.has(entry.target)) {
        errors.push(`state.food.${id}.target must be fish | fry`);
      }
    }
  }
  if (!isRecord(state.market)) {
    errors.push('state.market must be an object');
  } else {
    for (const id of Object.keys(state.market)) {
      const entry = (state.market as Record<string, unknown>)[id];
      if (!isRecord(entry)) {
        errors.push(`state.market.${id} must be an object`);
        continue;
      }
      if (!isFiniteNumber(entry.demand) || (entry.demand as number) < 0) {
        errors.push(`state.market.${id}.demand must be a number >= 0`);
      }
      if (!isInt(entry.trend) || ![-1, 0, 1].includes(entry.trend as number)) {
        errors.push(`state.market.${id}.trend must be -1 | 0 | 1`);
      }
      if (!isInt(entry.lastTrendDay) || (entry.lastTrendDay as number) < 1) {
        errors.push(`state.market.${id}.lastTrendDay must be an integer >= 1`);
      }
    }
  }
  if (!Array.isArray(state.orders)) {
    errors.push('state.orders must be an array');
  } else {
    for (const [index, order] of (state.orders as unknown[]).entries()) {
      if (!isRecord(order)) {
        errors.push(`state.orders[${index}] must be an object`);
        continue;
      }
      if (!isNonEmptyString(order.id)) errors.push(`state.orders[${index}].id must be a non-empty string`);
      if (!isNonEmptyString(order.speciesId)) errors.push(`state.orders[${index}].speciesId must be a non-empty string`);
      if (typeof order.customer !== 'string' || !ORDER_CUSTOMERS.has(order.customer)) {
        errors.push(`state.orders[${index}].customer must be hobbyist | petShop | collector`);
      }
      if (!isInt(order.quantity) || (order.quantity as number) < 1) {
        errors.push(`state.orders[${index}].quantity must be an integer >= 1`);
      }
      if (!isInt(order.minHealth)) errors.push(`state.orders[${index}].minHealth must be an integer`);
      if (!isFiniteNumber(order.minSizeCm) || (order.minSizeCm as number) < 0) {
        errors.push(`state.orders[${index}].minSizeCm must be a number >= 0`);
      }
      if (!isFiniteNumber(order.multiplier)) errors.push(`state.orders[${index}].multiplier must be a number`);
      if (!isInt(order.reward)) errors.push(`state.orders[${index}].reward must be an integer`);
      if (!isInt(order.deadlineDay)) errors.push(`state.orders[${index}].deadlineDay must be an integer`);
      if (typeof order.status !== 'string' || !ORDER_STATUSES.has(order.status)) {
        errors.push(`state.orders[${index}].status must be open | fulfilled | expired`);
      }
    }
  }
  if (!Array.isArray(state.notifications)) {
    errors.push('state.notifications must be an array');
  } else {
    for (const [index, note] of (state.notifications as unknown[]).entries()) {
      if (!isRecord(note)) {
        errors.push(`state.notifications[${index}] must be an object`);
        continue;
      }
      for (const field of ['id', 'priority', 'kind', 'message'] as const) {
        if (typeof note[field] !== 'string') errors.push(`state.notifications[${index}].${field} must be a string`);
      }
      if (note.subjectId !== undefined && typeof note.subjectId !== 'string') {
        errors.push(`state.notifications[${index}].subjectId must be a string when present`);
      }
    }
  }
  if (!isRecord(state.pairs)) {
    errors.push('state.pairs must be an object');
  } else {
    const ids = Object.keys(state.pairs);
    if (ids.length > MAX_PAIRS) errors.push(`state.pairs exceeds the import cap of ${MAX_PAIRS}`);
    for (const id of ids) {
      const entry = (state.pairs as Record<string, unknown>)[id];
      if (!isRecord(entry)) {
        errors.push(`state.pairs.${id} must be an object`);
        continue;
      }
      for (const field of ['id', 'femaleId', 'maleId', 'speciesId'] as const) {
        if (!isNonEmptyString(entry[field])) errors.push(`state.pairs.${id}.${field} must be a non-empty string`);
      }
      if (typeof entry.state !== 'string' || !PAIR_STATES.has(entry.state)) {
        errors.push(`state.pairs.${id}.state must be paired | gravid | cooling`);
      }
      if (!isInt(entry.readyDay) || (entry.readyDay as number) < 0) {
        errors.push(`state.pairs.${id}.readyDay must be an integer >= 0`);
      }
    }
  }
  // Feeding program deep validation lands with U4; the barrier requires the section present.
  if (!isRecord(state.feeding)) {
    errors.push('state.feeding must be an object');
  } else if (
    (state.feeding as Record<string, unknown>).schedule !== null &&
    !isRecord((state.feeding as Record<string, unknown>).schedule)
  ) {
    errors.push('state.feeding.schedule must be null or an object');
  }
  return errors;
}

/** Structural check of the migrated state; clock invariant included. */
function validateStateShape(state: unknown): string[] {
  if (!isRecord(state)) return ['state must be an object'];
  const errors: string[] = [];
  if (!isInt(state.seed) || (state.seed as number) < 0) errors.push('state.seed must be an integer >= 0');
  if (!isRecord(state.rngState) || !isInt(state.rngState.seed) || !isInt(state.rngState.a)) {
    errors.push('state.rngState must be { seed: integer, a: integer }');
  } else if (state.rngState.seed !== state.seed) {
    errors.push('state.rngState.seed must mirror state.seed');
  }
  if (!isRecord(state.clock)) {
    errors.push('state.clock must be an object');
  } else {
    errors.push(
      ...validateClock(state.clock as never).map((e) => `state.clock: ${e}`),
    );
  }
  if (!isInt(state.money) || (state.money as number) < 0) errors.push('state.money must be an integer >= 0');
  if (!isInt(state.reputation) || (state.reputation as number) < 0) {
    errors.push('state.reputation must be an integer >= 0');
  }
  if (!isRecord(state.settings)) {
    errors.push('state.settings must be an object');
  } else {
    const settings = state.settings as Record<string, unknown>;
    for (const flag of ['reducedMotion', 'autoPauseCritical'] as const) {
      if (typeof settings[flag] !== 'boolean') errors.push(`state.settings.${flag} must be a boolean`);
    }
    const volume = settings.volume;
    if (!isRecord(volume)) {
      errors.push('state.settings.volume must be an object');
    } else {
      for (const channel of ['master', 'sfx'] as const) {
        if (!inRange(volume[channel], 0, 1)) errors.push(`state.settings.volume.${channel} must be a number 0..1`);
      }
    }
  }
  if (!isRecord(state.progression)) {
    errors.push('state.progression must be an object');
  } else {
    const progression = state.progression as Record<string, unknown>;
    if (!isInt(progression.level) || !([1, 2, 3] as number[]).includes(progression.level as number)) {
      errors.push('state.progression.level must be 1 | 2 | 3');
    }
    if (!isInt(progression.xp) || (progression.xp as number) < 0) {
      errors.push('state.progression.xp must be an integer >= 0');
    }
    if (!Array.isArray(progression.unlocks) || !(progression.unlocks as unknown[]).every((u) => typeof u === 'string')) {
      errors.push('state.progression.unlocks must be a string[]');
    }
  }
  errors.push(...validateTank(state.tank));
  errors.push(...validateCollections(state));
  return errors;
}

interface ValidatedLoad {
  state: GameState;
  stale: boolean;
  savedAt: string;
}

export interface SaveLoadApi {
  autosave(): SaveOutcome;
  saveToSlot(name: string): SaveOutcome;
  listSlots(): SlotInfo[];
  load(ref: SlotRef, opts?: { confirmStale?: boolean }): LoadOutcome;
  deleteSlot(ref: SlotRef): DeleteOutcome;
  exportFile(): string;
  importFile(text: string, opts?: { confirmStale?: boolean }): LoadOutcome;
  isAutosaveEnabled(): boolean;
}

export function createSaveSystem(opts: SaveSystemOptions): SaveLoadApi {
  const { store, primary } = opts;
  const fallback = opts.fallback ?? null;
  // Save-envelope wall-clock stamp only (C6 savedAt); never drives simulation
  // state, which flows through ctx.rng and the tick. Injectable for tests.
  // eslint-disable-next-line no-restricted-globals -- NFR3.2 targets systems/handlers, not save metadata
  const now = opts.now ?? (() => new Date().toISOString());
  const logger = opts.logger ?? { warn: () => undefined, info: () => undefined };
  // Forward chain ships with the built v1 -> v2 migration; callers may add later steps.
  const migrations = opts.migrations ?? { 1: migrateV1ToV2 };
  let playtimeMs = opts.playtimeMs ?? 0;
  let autosaveEnabled = true;
  let memoryLastSeen = '';
  let activeRef: SlotRef | null = null;

  try {
    const raw = primary.read(ACTIVE_KEY);
    activeRef = raw ? parseSlotRef(raw) : null;
  } catch {
    activeRef = null;
  }

  function readLastSeen(): string {
    let stored = '';
    try {
      stored = primary.read(LAST_SEEN_KEY) ?? '';
    } catch {
      stored = '';
    }
    if (!stored && fallback) {
      try {
        stored = fallback.read(LAST_SEEN_KEY) ?? '';
      } catch {
        stored = '';
      }
    }
    return [memoryLastSeen, stored].sort().pop() ?? '';
  }

  function writeLastSeen(value: string): void {
    memoryLastSeen = [memoryLastSeen, value].sort().pop() ?? value;
    for (const storage of [primary, fallback]) {
      if (!storage) continue;
      try {
        storage.write(LAST_SEEN_KEY, memoryLastSeen);
      } catch {
        // best-effort; the write path reports its own failures
      }
    }
  }

  function storages(): StoragePort[] {
    return fallback ? [primary, fallback] : [primary];
  }

  /** Write temp, read back to verify, swap to the slot key. */
  function writeVerified(storage: StoragePort, key: string, text: string): boolean {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        storage.write(TEMP_KEY, text);
        const roundTrip = storage.read(TEMP_KEY);
        if (roundTrip === null) continue;
        const parsed = JSON.parse(roundTrip) as SaveEnvelope;
        if (!isRecord(parsed) || !isRecord(parsed.checksum)) continue;
        if (recomputeChecksum(parsed as never) !== (parsed.checksum as { value: string }).value) continue;
        storage.write(key, text);
        const swapped = storage.read(key);
        if (swapped !== text) continue;
        try {
          storage.remove(TEMP_KEY);
        } catch {
          // temp cleanup is best-effort
        }
        return true;
      } catch {
        // retry once, then let the caller fall through
      }
    }
    return false;
  }

  function persistEnvelope(envelope: SaveEnvelope, key: string): boolean {
    const text = JSON.stringify(envelope);
    if (writeVerified(primary, key, text)) return true;
    if (fallback && writeVerified(fallback, key, text)) return true;
    return false;
  }

  function validateAndMigrate(parsed: unknown, confirmStale: boolean): ValidatedLoad | SaveError {
    if (!isRecord(parsed)) return { code: 'INVALID_SHAPE', message: 'Save must be a JSON object.' };
    const banned = findBannedKey(parsed);
    if (banned) {
      return { code: 'INVALID_SHAPE', message: `Forbidden key '${banned}' in save data.` };
    }
    if (
      !isInt(parsed.schemaVersion) ||
      typeof parsed.savedAt !== 'string' ||
      !isInt(parsed.playtimeMs) ||
      (parsed.playtimeMs as number) < 0 ||
      !isRecord(parsed.checksum) ||
      !isRecord(parsed.state)
    ) {
      return { code: 'INVALID_SHAPE', message: 'Save envelope is missing required fields.' };
    }
    const version = parsed.schemaVersion as number;
    if (version > CURRENT_SCHEMA_VERSION) {
      return { code: 'UNSUPPORTED_VERSION', message: `Schema version ${version} is newer than ${CURRENT_SCHEMA_VERSION}.` };
    }
    const checksum = parsed.checksum as { algorithm?: unknown; value?: unknown };
    if (checksum.algorithm !== 'SHA-256' || typeof checksum.value !== 'string') {
      return { code: 'INVALID_SHAPE', message: 'Save checksum must be a SHA-256 digest.' };
    }
    const envelope = parsed as { schemaVersion: number; savedAt: string; playtimeMs: number; state: unknown };
    if (recomputeChecksum(envelope) !== (checksum.value as string)) {
      return { code: 'CHECKSUM_MISMATCH', message: 'Save data was altered or truncated.' };
    }
    let state: unknown = envelope.state;
    let from = version;
    const gate = isRecord(state) ? countGateErrors(state) : [];
    if (gate.length > 0) {
      return { code: 'INVALID_SHAPE', message: `Save state is invalid: ${gate[0] as string}` };
    }
    while (from < CURRENT_SCHEMA_VERSION) {
      const migrate = migrations[from];
      if (!migrate) {
        return { code: 'MIGRATION_FAILED', message: `No migration from schema version ${from}.` };
      }
      try {
        state = migrate(state);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { code: 'MIGRATION_FAILED', message: `Migration from version ${from} failed: ${message}` };
      }
      from += 1;
    }
    const shapeErrors = validateStateShape(state);
    if (shapeErrors.length > 0) {
      return { code: 'INVALID_SHAPE', message: `Save state is invalid: ${shapeErrors[0] as string}` };
    }
    const lastSeen = readLastSeen();
    const stale = lastSeen !== '' && (envelope.savedAt as string) < lastSeen;
    if (stale && !confirmStale) {
      return { code: 'STALE_SAVE', message: 'This save predates the newest one seen; confirm to load it anyway.' };
    }
    return { state: state as GameState, stale, savedAt: envelope.savedAt as string };
  }

  function describeSlot(ref: SlotRef, envelope: SaveEnvelope): SlotInfo {
    return {
      ref,
      savedAt: envelope.savedAt,
      level: (envelope.state.progression as unknown as { level: number }).level,
      money: envelope.state.money,
      playtimeMs: envelope.playtimeMs,
    };
  }

  function readEnvelope(ref: SlotRef): SaveEnvelope | null {
    for (const storage of storages()) {
      let raw: string | null = null;
      try {
        raw = storage.read(slotKey(ref));
      } catch {
        continue;
      }
      if (raw === null) continue;
      try {
        return JSON.parse(raw) as SaveEnvelope;
      } catch {
        continue;
      }
    }
    return null;
  }

  function manualNames(): string[] {
    for (const storage of storages()) {
      try {
        const raw = storage.read(INDEX_KEY);
        if (raw === null) continue;
        const names = JSON.parse(raw) as unknown;
        if (Array.isArray(names)) return names.filter((n): n is string => typeof n === 'string');
      } catch {
        continue;
      }
    }
    return [];
  }

  function storeManualNames(names: string[]): void {
    const text = JSON.stringify(names);
    try {
      primary.write(INDEX_KEY, text);
    } catch {
      if (!fallback) throw new Error('manual index unwritable');
      fallback.write(INDEX_KEY, text);
    }
  }

  function currentAutoIndex(): 1 | 2 | 3 {
    try {
      const raw = primary.read(NEXT_AUTO_KEY);
      if (raw !== null) {
        const n = Number.parseInt(raw, 10);
        if (n === 1 || n === 2 || n === 3) return n;
      }
    } catch {
      // rotation counter is best-effort; fall through to slot 1
    }
    return 1;
  }

  function advanceAutoIndex(current: 1 | 2 | 3): void {
    try {
      primary.write(NEXT_AUTO_KEY, String((current % 3) + 1));
    } catch {
      // rotation counter is best-effort; the slot write is authoritative
    }
  }

  function recordSuccess(ref: SlotRef, savedAt: string): void {
    activeRef = ref;
    autosaveEnabled = true;
    writeLastSeen(savedAt);
    try {
      primary.write(ACTIVE_KEY, JSON.stringify(ref));
    } catch {
      // active pointer is best-effort
    }
  }

  return {
    autosave(): SaveOutcome {
      const savedAt = now();
      const ref: SlotRef = { kind: 'auto', index: currentAutoIndex() };
      const envelope = sealEnvelope(store.state, savedAt, playtimeMs);
      if (!persistEnvelope(envelope, slotKey(ref))) {
        autosaveEnabled = false;
        logger.warn('Autosave failed on every store; autosave disabled until the next successful write.');
        return { ok: false, error: { code: 'STORAGE_UNAVAILABLE', message: 'No save store could be written.' } };
      }
      advanceAutoIndex(ref.index);
      recordSuccess(ref, savedAt);
      return { ok: true, ref, savedAt };
    },

    saveToSlot(name: string): SaveOutcome {
      if (typeof name !== 'string' || name.length === 0) {
        return { ok: false, error: { code: 'INVALID_SHAPE', message: 'Slot name must be a non-empty string.' } };
      }
      const savedAt = now();
      const ref: SlotRef = { kind: 'manual', name };
      const envelope = sealEnvelope(store.state, savedAt, playtimeMs);
      if (!persistEnvelope(envelope, slotKey(ref))) {
        return { ok: false, error: { code: 'STORAGE_UNAVAILABLE', message: 'No save store could be written.' } };
      }
      const names = manualNames();
      if (!names.includes(name)) {
        try {
          storeManualNames([...names, name]);
        } catch {
          return { ok: false, error: { code: 'STORAGE_UNAVAILABLE', message: 'No save store could be written.' } };
        }
      }
      recordSuccess(ref, savedAt);
      return { ok: true, ref, savedAt };
    },

    listSlots(): SlotInfo[] {
      const infos: SlotInfo[] = [];
      for (const index of [1, 2, 3] as const) {
        const ref: SlotRef = { kind: 'auto', index };
        const envelope = readEnvelope(ref);
        if (envelope) {
          try {
            infos.push(describeSlot(ref, envelope));
          } catch {
            // skip entries that no longer describe a readable state
          }
        }
      }
      for (const name of manualNames()) {
        const ref: SlotRef = { kind: 'manual', name };
        const envelope = readEnvelope(ref);
        if (envelope) {
          try {
            infos.push(describeSlot(ref, envelope));
          } catch {
            // skip entries that no longer describe a readable state
          }
        }
      }
      return infos;
    },

    load(ref: SlotRef, opts?: { confirmStale?: boolean }): LoadOutcome {
      const envelope = readEnvelope(ref);
      if (!envelope) {
        return { ok: false, error: { code: 'SLOT_NOT_FOUND', message: 'The named slot holds no save.' } };
      }
      const validated = validateAndMigrate(envelope, opts?.confirmStale ?? false);
      if ('code' in validated) return { ok: false, error: validated };
      replaceStoreState(store, validated.state);
      playtimeMs = envelope.playtimeMs;
      recordSuccess(ref, validated.savedAt);
      return { ok: true, ref, stale: validated.stale };
    },

    deleteSlot(ref: SlotRef): DeleteOutcome {
      const envelope = readEnvelope(ref);
      if (!envelope) {
        return { ok: false, error: { code: 'SLOT_NOT_FOUND', message: 'The named slot holds no save.' } };
      }
      for (const storage of storages()) {
        try {
          storage.remove(slotKey(ref));
        } catch {
          // keep removing from the other store
        }
      }
      if (ref.kind === 'manual') {
        try {
          storeManualNames(manualNames().filter((n) => n !== ref.name));
        } catch {
          // index cleanup is best-effort once the payload is gone
        }
      }
      if (activeRef && activeRef.kind === ref.kind) {
        const same =
          ref.kind === 'auto'
            ? (activeRef as { index: number }).index === (ref as { index: number }).index
            : (activeRef as { name: string }).name === (ref as { name: string }).name;
        if (same) activeRef = null;
      }
      // Loaded in-memory state is never touched by a slot delete (BR6.4).
      return { ok: true, ref };
    },

    exportFile(): string {
      return JSON.stringify(sealEnvelope(store.state, now(), playtimeMs));
    },

    importFile(text: string, opts?: { confirmStale?: boolean }): LoadOutcome {
      if (text.length > MAX_SAVE_BYTES) {
        return { ok: false, error: { code: 'INVALID_SHAPE', message: 'Save text exceeds the 2 MB import limit.' } };
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { ok: false, error: { code: 'CORRUPT_JSON', message: 'The file is not JSON.' } };
      }
      const validated = validateAndMigrate(parsed, opts?.confirmStale ?? false);
      if ('code' in validated) return { ok: false, error: validated };
      replaceStoreState(store, validated.state);
      playtimeMs = (parsed as SaveEnvelope).playtimeMs;
      writeLastSeen(validated.savedAt);
      return { ok: true, ref: activeRef ?? { kind: 'manual', name: 'import' }, stale: validated.stale };
    },

    isAutosaveEnabled(): boolean {
      return autosaveEnabled;
    },
  };
}
