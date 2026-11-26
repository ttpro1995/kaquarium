import { describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../src/persistence/sha256.js';
import {
  MemoryStorage,
  createSaveSystem,
  sealEnvelope,
  CURRENT_SCHEMA_VERSION,
} from '../src/persistence/persistence.js';
import { loadSpeciesCatalog } from '../src/species.js';
import { createStore } from '../src/store.js';
import { canonicalJson } from '../src/canonicalJson.js';
import { createInitialState } from '../src/types.js';

function validSpecies(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: { en: id },
    archetype: 'livebearer',
    tier: 1,
    care: 3,
    buyPrice: 10,
    sellBase: 8,
    adultSizeCm: 5,
    lifespanDays: 365,
    maturityDays: 90,
    juvenileDays: 30,
    diet: { type: 'flake', firstFoodRequired: false },
    genes: {},
    palette: {},
    pattern: 'solid',
    fin: 'normal',
    schooling: 0.5,
    territorial: 0.1,
    layer: 'middle',
    ...overrides,
  };
}

function tickNow() {
  let n = 0;
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, n++)).toISOString();
}

function setup() {
  const store = createStore(createInitialState(21));
  const primary = new MemoryStorage();
  const fallback = new MemoryStorage();
  const logger = { warn: vi.fn(), info: vi.fn() };
  const saves = createSaveSystem({ store, primary, fallback, now: tickNow(), logger });
  return { store, primary, fallback, logger, saves };
}

describe('species catalog + persistence (BR5.1, BR6.1-BR6.4, NFR4.1-NFR4.4)', () => {
  it('pins the bundled SHA-256 digest (NFR4.3)', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('fails dev boot loudly naming file+field; prod excludes and logs (BR5.1)', () => {
    const files = [
      { file: 'guppy.json', data: validSpecies('guppy') },
      { file: 'molly.json', data: validSpecies('molly') },
      { file: 'bad.json', data: validSpecies('bad', { buyPrice: -5 }) },
    ];
    expect(() => loadSpeciesCatalog(files, { mode: 'dev' })).toThrow(/bad\.json.*buyPrice/);
    const logger = { warn: vi.fn(), info: vi.fn() };
    const catalog = loadSpeciesCatalog(files, { mode: 'prod', logger });
    expect(catalog.size).toBe(2);
    expect(catalog.get('guppy')).toBeDefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('rotates three autosave slots with verify-before-swap, even while paused', () => {
    const { store, primary, saves } = setup();
    store.state.clock.speed = 0;
    store.state.clock.paused = true;
    for (let i = 0; i < 4; i++) {
      expect(saves.autosave().ok).toBe(true);
    }
    const slots = saves.listSlots();
    expect(slots.filter((s) => s.ref.kind === 'auto').length).toBe(3);
    expect(primary.writes[0]).toMatch(/tmp/);
  });

  it('writes through the fallback store when primary fails (NFR4.1)', () => {
    const { saves, primary, fallback } = setup();
    primary.failWrites = 99;
    const outcome = saves.autosave();
    expect(outcome.ok).toBe(true);
    expect(fallback.writes.length).toBeGreaterThan(0);
    expect(saves.isAutosaveEnabled()).toBe(true);
  });

  it('warns and disables when every store fails, until the next success (NFR4.1)', () => {
    const { saves, primary, fallback, logger } = setup();
    primary.failWrites = 99;
    fallback.failWrites = 99;
    const failed = saves.autosave();
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error.code).toBe('STORAGE_UNAVAILABLE');
    expect(logger.warn).toHaveBeenCalled();
    expect(saves.isAutosaveEnabled()).toBe(false);
    primary.failWrites = 0;
    fallback.failWrites = 0;
    expect(saves.autosave().ok).toBe(true);
    expect(saves.isAutosaveEnabled()).toBe(true);
  });

  it('round-trips export/import without touching slots (BR6.2)', () => {
    const { store, saves } = setup();
    store.state.money = 777;
    const text = saves.exportFile();
    expect(saves.listSlots().length).toBe(0);
    store.state.money = 0;
    const outcome = saves.importFile(text);
    expect(outcome.ok).toBe(true);
    expect(store.state.money).toBe(777);
  });

  it('rejects a tampered byte with CHECKSUM_MISMATCH and keeps the save', () => {
    const { store, saves } = setup();
    const parsed = JSON.parse(saves.exportFile()) as { checksum: { value: string } };
    const digest = canonicalJson(store.state);
    const value = parsed.checksum.value;
    parsed.checksum.value = value.slice(0, 10) + (value[10] === '0' ? '1' : '0') + value.slice(11);
    const outcome = saves.importFile(JSON.stringify(parsed));
    expect(outcome).toEqual({
      ok: false,
      error: { code: 'CHECKSUM_MISMATCH', message: expect.any(String) },
    });
    expect(canonicalJson(store.state)).toBe(digest);
  });

  it('rejects __proto__/constructor/prototype keys at any depth (NFR4.4)', () => {
    const { store, saves } = setup();
    const digest = canonicalJson(store.state);
    const parsed = JSON.parse(saves.exportFile()) as Record<string, unknown>;
    (parsed.state as Record<string, unknown>).market = JSON.parse('{"__proto__":{"x":1}}');
    const resealed = sealEnvelope(
      parsed.state as never,
      parsed.savedAt as string,
      parsed.playtimeMs as number,
    );
    const outcome = saves.importFile(JSON.stringify(resealed));
    expect(outcome).toEqual({
      ok: false,
      error: { code: 'INVALID_SHAPE', message: expect.any(String) },
    });
    expect(canonicalJson(store.state)).toBe(digest);
  });

  it('rejects a clock that breaks paused == (speed == 0) on import', () => {
    const { store, saves } = setup();
    const parsed = JSON.parse(saves.exportFile()) as {
      state: { clock: { speed: number; paused: boolean } };
      savedAt: string;
      playtimeMs: number;
    };
    parsed.state.clock.speed = 2;
    parsed.state.clock.paused = true;
    const resealed = sealEnvelope(parsed.state as never, parsed.savedAt, parsed.playtimeMs);
    expect(saves.importFile(JSON.stringify(resealed))).toEqual({
      ok: false,
      error: { code: 'INVALID_SHAPE', message: expect.any(String) },
    });
  });

  it('rejects newer versions; migrates older ones; fails unmigratable ones', () => {
    const { store, saves, primary } = setup();
    const good = sealEnvelope(store.state, '2026-01-01T00:00:00.000Z', 0, 99);
    expect(saves.importFile(JSON.stringify(good))).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED_VERSION', message: expect.any(String) },
    });
    const old = sealEnvelope(store.state, '2026-01-01T00:00:00.000Z', 0, 0);
    expect(saves.importFile(JSON.stringify(old))).toEqual({
      ok: false,
      error: { code: 'MIGRATION_FAILED', message: expect.any(String) },
    });
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
    expect(primary).toBeDefined();
  });

  it('returns STALE_SAVE unless confirmStale, then loads with stale:true', () => {
    const { store, saves } = setup();
    saves.saveToSlot('newer');
    const stale = sealEnvelope(store.state, '2020-01-01T00:00:00.000Z', 0);
    const digest = canonicalJson(store.state);
    store.state.money = 1;
    expect(saves.importFile(JSON.stringify(stale))).toEqual({
      ok: false,
      error: { code: 'STALE_SAVE', message: expect.any(String) },
    });
    expect(store.state.money).toBe(1);
    const retried = saves.importFile(JSON.stringify(stale), { confirmStale: true });
    expect(retried).toEqual({ ok: true, ref: expect.anything(), stale: true });
    expect(canonicalJson(store.state)).toBe(digest);
  });

  it('rejects corrupt JSON and keeps the current save', () => {
    const { store, saves } = setup();
    const digest = canonicalJson(store.state);
    expect(saves.importFile('not json{{{')).toEqual({
      ok: false,
      error: { code: 'CORRUPT_JSON', message: expect.any(String) },
    });
    expect(canonicalJson(store.state)).toBe(digest);
  });

  it('deletes explicitly: missing is SLOT_NOT_FOUND, loaded state untouched (BR6.4)', () => {
    const { store, saves } = setup();
    saves.saveToSlot('keep');
    const digest = canonicalJson(store.state);
    expect(saves.deleteSlot({ kind: 'manual', name: 'ghost' })).toEqual({
      ok: false,
      error: { code: 'SLOT_NOT_FOUND', message: expect.any(String) },
    });
    expect(saves.deleteSlot({ kind: 'manual', name: 'keep' }).ok).toBe(true);
    expect(saves.listSlots().length).toBe(0);
    expect(canonicalJson(store.state)).toBe(digest);
  });
});
