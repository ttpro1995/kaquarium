// migration.test.ts — TDD Red (Step 3): v1 -> v2 migration + import barrier.
// Failing until U1 types.ts alignment + persistence/migration.ts land.
import { describe, expect, it } from 'vitest';
import {
  createKernel,
  createInitialState,
  sealEnvelope,
} from '@aquarium/u1-sim-foundation';
import { migrateV1ToV2 } from '@aquarium/u1-sim-foundation';

/** Minimal v1-shaped state: the exact old Tank shape, no latches, no v2 fields. */
function v1Fixture(overrides: Record<string, unknown> = {}): unknown {
  return {
    seed: 7,
    rngState: { seed: 7, a: 7 },
    clock: { gameDay: 1, gameHour: 8, speed: 1, paused: false },
    money: 100,
    reputation: 0,
    progression: { level: 1, xp: 0, unlocks: [] },
    tank: {
      id: 'tank-1',
      tier: 1,
      volumeL: 50,
      water: { waste: 0, temperature: 24, ph: 7 },
      equipment: [],
      bioload: 0,
      biofilterMaturity: 0,
    },
    fish: {},
    cohorts: {},
    food: {},
    market: {},
    orders: [],
    notifications: [],
    settings: { reducedMotion: false, autoPauseCritical: true, volume: { master: 0.8, sfx: 0.8 } },
    ...overrides,
  };
}

describe('v1 -> v2 migration (breaking-change register)', () => {
  it('migrates the pristine v1 default to exactly a fresh v2 save', () => {
    const migrated = migrateV1ToV2(v1Fixture());
    expect(migrated).toEqual(createInitialState(7));
  });

  it('converts water chemistry, equipment, volume, and derives latches', () => {
    const migrated = migrateV1ToV2(
      v1Fixture({
        tank: {
          id: 'tank-1',
          tier: 1,
          volumeL: 50,
          water: { waste: 60, temperature: 10, ph: 7 },
          equipment: [],
          bioload: 25,
          biofilterMaturity: 0.5,
        },
        fish: {
          f1: {
            id: 'f1', speciesId: 's', tankId: 'tank-1', sex: 'male', stage: 'adult',
            ageDays: 10, sizeCm: 5, health: 80, satiety: 80, stress: 0,
            genome: {}, value: 10, mature: true,
          },
        },
      }),
    ) as Record<string, any>;
    expect(migrated.tank.water).toEqual({ waste: 60, nitrate: 0, tempC: 10 });
    expect(migrated.tank.equipment).toEqual({
      filter: { level: 1, conversionRate: 2 },
      heater: { installed: false },
      autoFeeder: { installed: false },
      light: { level: 1 },
    });
    expect(migrated.tank.volumeL).toBe(20);
    expect(migrated.tank.prevQualityBand).toBe('fair');
    expect(migrated.tank.overcrowdLatch).toBe(true);
    expect(migrated.tank.tempPoorLatch).toBe(true);
    expect(migrated.fish.f1.stunted).toBe(false);
  });

  it('converts orders, food, cohorts, market, and notifications per the register', () => {
    const migrated = migrateV1ToV2(
      v1Fixture({
        clock: { gameDay: 5, gameHour: 8, speed: 1, paused: false },
        food: {
          st1: { id: 'st1', kind: 'flakes', qty: 4, quality: 0.7, shelfLifeDays: 30 },
          st2: { id: 'st2', kind: 'liveFirst', qty: 2, quality: 1.0, shelfLifeDays: 7 },
        },
        cohorts: {
          c1: { id: 'c1', speciesId: 's', tankId: 'tank-1', bornDay: 2, count: 6, ageDays: 1, genomePool: {}, survivalFactor: 1 },
        },
        market: { s: { speciesId: 's', demand: 1, trend: 0 } },
        orders: [
          { id: 'o1', speciesId: 's', quantity: 2, deadline: 9, minQuality: 50, reward: 40, status: 'open' },
          { id: 'o2', speciesId: 's', quantity: 1, deadline: 1, minQuality: 40, reward: 20, status: 'open' },
        ],
        notifications: [{ id: 'n1', priority: 'info', kind: 'x', message: 'hi' }],
      }),
    ) as Record<string, any>;
    expect(migrated.feeding).toEqual({ schedule: null });
    expect(migrated.pairs).toEqual({});
    expect(migrated.food.st1).toMatchObject({ acquiredDay: 5, target: 'fish' });
    expect(migrated.food.st2).toMatchObject({ acquiredDay: 5, target: 'fry' });
    expect(migrated.cohorts.c1).toMatchObject({ firstFoodDays: 0, lastFryFedDay: 0, stage: 'fry' });
    expect(migrated.market.s.lastTrendDay).toBe(5);
    expect(migrated.orders[0]).toMatchObject({
      deadlineDay: 9, minHealth: 50, customer: 'hobbyist', multiplier: 1.2, minSizeCm: 0,
    });
    expect(migrated.orders[0]).not.toHaveProperty('deadline');
    expect(migrated.orders[0]).not.toHaveProperty('minQuality');
    expect(migrated.orders[1].deadlineDay).toBe(8);
    expect(migrated.notifications[0].subjectId).toBe('');
  });

  it('refuses a v1 payload with an unknown tier', () => {
    expect(() =>
      migrateV1ToV2(v1Fixture({ tank: { id: 't', tier: 9, volumeL: 50, water: {}, equipment: [], bioload: 0, biofilterMaturity: 0 } })),
    ).toThrow();
  });
});

describe('import barrier (NFR4.3)', () => {
  it('rejects oversize text before parsing', () => {
    const kernel = createKernel(7);
    const text = kernel.saves.exportFile() + ' '.repeat(2 * 1024 * 1024);
    expect(text.length).toBeGreaterThan(2 * 1024 * 1024);
    expect(kernel.saves.importFile(text)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SHAPE' },
    });
    expect(kernel.store.state.money).toBe(100);
  });

  it('rejects banned prototype-pollution keys', () => {
    const kernel = createKernel(7);
    const state = JSON.parse(kernel.saves.exportFile()).state as Record<string, unknown>;
    (state as Record<string, unknown>).fish = JSON.parse('{"__proto__": {"x": 1}}');
    const text = JSON.stringify(sealEnvelope(state as never, '2026-01-01T00:00:00.000Z', 0));
    expect(kernel.saves.importFile(text)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SHAPE' },
    });
  });

  it('rejects over-count payloads before migration', () => {
    const kernel = createKernel(7);
    const state = JSON.parse(kernel.saves.exportFile()).state as Record<string, any>;
    state.orders = Array.from({ length: 7 }, (_, i) => ({
      id: `o${i}`, speciesId: 's', quantity: 1, deadlineDay: 9, minHealth: 40,
      minSizeCm: 0, customer: 'hobbyist', multiplier: 1.2, reward: 10, status: 'open',
    }));
    const text = JSON.stringify(sealEnvelope(state as never, '2026-01-01T00:00:00.000Z', 0));
    expect(kernel.saves.importFile(text)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SHAPE' },
    });
  });

  it('rejects out-of-range chemistry', () => {
    const kernel = createKernel(7);
    const state = JSON.parse(kernel.saves.exportFile()).state as Record<string, any>;
    state.tank.water.waste = 101;
    const text = JSON.stringify(sealEnvelope(state as never, '2026-01-01T00:00:00.000Z', 0));
    expect(kernel.saves.importFile(text)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SHAPE' },
    });
  });

  it('rejects a hand-stamped v2 save missing latch fields', () => {
    const kernel = createKernel(7);
    const state = JSON.parse(kernel.saves.exportFile()).state as Record<string, any>;
    delete state.tank.prevQualityBand;
    delete state.tank.overcrowdLatch;
    delete state.tank.tempPoorLatch;
    const text = JSON.stringify(sealEnvelope(state as never, '2026-01-01T00:00:00.000Z', 0));
    expect(kernel.saves.importFile(text)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SHAPE' },
    });
  });

  it('loads a sealed v1 save through the forward migration', () => {
    const kernel = createKernel(11);
    const text = JSON.stringify(sealEnvelope(v1Fixture() as never, '2026-01-01T00:00:00.000Z', 0, 1));
    const result = kernel.saves.importFile(text);
    expect(result.ok).toBe(true);
    expect(kernel.store.state.tank.volumeL).toBe(20);
    expect(kernel.store.state.tank.water).toEqual({ waste: 0, nitrate: 0, tempC: 24 });
    expect(kernel.store.state.pairs).toEqual({});
    expect(kernel.store.state.feeding).toEqual({ schedule: null });
  });
});
