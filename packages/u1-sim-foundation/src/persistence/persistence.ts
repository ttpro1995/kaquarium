// persistence — slots, save/load, JSON export/import (C6, BR6.1–BR6.4).
// One version authority: schemaVersion lives in the envelope only.
// The digest covers the canonical UTF-8 JSON of every envelope field
// except checksum itself. Durability order: write a temporary key,
// read back to verify, swap to the active key; retry once, fall back,
// then warn and disable autosave until the next successful write.
import { canonicalJson } from '../canonicalJson.js';
import { sha256Hex } from './sha256.js';
import { replaceStoreState, type MutableStore } from '../store.js';
import { validateClock, type GameState, type SaveEnvelope, type SlotInfo, type SlotRef } from '../types.js';

export const CURRENT_SCHEMA_VERSION = 1;
export const CHECKSUM_SCOPE = 'schemaVersion + savedAt + playtimeMs + state';

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
  if (!isRecord(state.settings)) errors.push('state.settings must be an object');
  if (!isRecord(state.progression)) errors.push('state.progression must be an object');
  if (!isRecord(state.tank)) errors.push('state.tank must be an object');
  for (const field of ['fish', 'cohorts', 'food', 'market'] as const) {
    if (!isRecord(state[field])) errors.push(`state.${field} must be an object`);
  }
  if (!Array.isArray(state.orders)) errors.push('state.orders must be an array');
  if (!Array.isArray(state.notifications)) errors.push('state.notifications must be an array');
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
  const migrations = opts.migrations ?? {};
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
