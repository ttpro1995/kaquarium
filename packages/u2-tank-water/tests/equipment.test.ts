// equipment.test.ts — TDD Red (Step 9): tank.buyEquipment / tank.upgradeTier (W10, BR9.1–BR9.2, AC1.3.1).
import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  createRng,
  emptyCatalog,
  MemoryCatalog,
  type CommandContext,
  type GameState,
} from '@aquarium/u1-sim-foundation';
import { buyEquipment, upgradeTier } from '../src/commands.js';
import { waterSystem, tempFitFor, projectedBioload } from '../src/water.js';
import type { Species } from '@aquarium/u1-sim-foundation';

function makeCtx(state: GameState): CommandContext {
  return {
    now: { day: state.clock.gameDay, hour: state.clock.gameHour },
    rng: createRng(state.rngState),
    species: emptyCatalog(),
    events: [],
  };
}

function tropical(): Species {
  return {
    id: 'trop', name: { en: 'T' }, archetype: 'livebearer', tier: 1, care: 1,
    buyPrice: 10, sellBase: 8, adultSizeCm: 5, lifespanDays: 365, maturityDays: 90,
    juvenileDays: 30, diet: { type: 'flake', firstFoodRequired: false }, genes: {},
    palette: {}, pattern: 's', fin: 'f', schooling: 0, territorial: 0,
    layer: 'middle', tempRangeC: [24, 28],
  };
}

describe('tank.buyEquipment (BR9.1)', () => {
  it('buys filter L2 with unlock + funds: installs, resets maturity, emits the pair', () => {
    const state = createInitialState(3);
    state.money = 500;
    state.progression.unlocks = ['equipment.filter2'];
    state.tank.biofilterMaturity = 0.8;
    const ctx = makeCtx(state);
    const outcome = buyEquipment(state, { kind: 'filter', level: 2 }, ctx);
    expect(outcome).toEqual({ ok: true, value: { kind: 'filter', level: 2, price: 150 } });
    expect(state.tank.equipment.filter).toEqual({ level: 2, conversionRate: 5 });
    expect(state.tank.biofilterMaturity).toBe(0);
    expect(state.money).toBe(350);
    expect(ctx.events).toEqual([
      { kind: 'equipmentUpgraded', equipment: 'filter:2' },
      { kind: 'moneyChanged', delta: -150, balance: 350 },
    ]);
  });

  it('buys heater, light, and autoFeeder at the spec prices with their unlocks', () => {
    const state = createInitialState(3);
    state.money = 1000;
    state.progression.unlocks = ['equipment.heater', 'equipment.light2', 'equipment.light3', 'equipment.autofeeder'];
    expect(buyEquipment(state, { kind: 'heater', level: 1 }, makeCtx(state))).toMatchObject({ ok: true });
    expect(state.money).toBe(880);
    expect(buyEquipment(state, { kind: 'light', level: 2 }, makeCtx(state))).toMatchObject({ ok: true });
    expect(buyEquipment(state, { kind: 'light', level: 3 }, makeCtx(state))).toMatchObject({ ok: true });
    expect(buyEquipment(state, { kind: 'autoFeeder', level: 1 }, makeCtx(state))).toMatchObject({ ok: true });
    expect(state.money).toBe(1000 - 120 - 80 - 200 - 150);
    expect(state.tank.equipment.heater.installed).toBe(true);
    expect(state.tank.equipment.autoFeeder.installed).toBe(true);
    expect(state.tank.equipment.light.level).toBe(3);
  });

  it('a bought heater holds the tropical range over time', () => {
    const state = createInitialState(3);
    state.money = 500;
    state.progression.unlocks = ['equipment.heater'];
    state.tank.water.tempC = 22;
    buyEquipment(state, { kind: 'heater', level: 1 }, makeCtx(state));
    const species = new MemoryCatalog([tropical()]);
    for (let tick = 0; tick < 60; tick++) {
      waterSystem.run({
        state, tick, now: { day: 1, hour: 0 }, rng: createRng(state.rngState),
        species, events: [], catchUp: false,
      });
    }
    expect(state.tank.water.tempC).toBeCloseTo(26, 1);
    expect(tempFitFor(state, tropical())).toBe(1);
  });

  it('rejects unknown kinds/levels, locked gear, and already-installed levels without mutating', () => {
    const state = createInitialState(3);
    state.money = 1000;
    const before = JSON.parse(JSON.stringify(state));
    expect(buyEquipment(state, { kind: 'sonar', level: 1 } as never, makeCtx(state))).toMatchObject({
      ok: false, error: { code: 'UNKNOWN_ENTITY' },
    });
    expect(buyEquipment(state, { kind: 'heater', level: 2 }, makeCtx(state))).toMatchObject({
      ok: false, error: { code: 'UNKNOWN_ENTITY' },
    });
    expect(buyEquipment(state, { kind: 'filter', level: 3 }, makeCtx(state))).toMatchObject({
      ok: false, error: { code: 'NOT_AVAILABLE' },
    });
    state.progression.unlocks = ['equipment.heater'];
    expect(buyEquipment(state, { kind: 'heater', level: 1 }, makeCtx(state))).toMatchObject({ ok: true });
    expect(buyEquipment(state, { kind: 'heater', level: 1 }, makeCtx(state))).toMatchObject({
      ok: false, error: { code: 'INVALID_QUANTITY' },
    });
    state.progression.unlocks = ['equipment.filter2'];
    expect(buyEquipment(state, { kind: 'filter', level: 2 }, makeCtx(state))).toMatchObject({ ok: true });
    expect(buyEquipment(state, { kind: 'filter', level: 1 }, makeCtx(state))).toMatchObject({
      ok: false, error: { code: 'INVALID_QUANTITY' },
    });
    expect(state.money).toBe(1000 - 120 - 150);
    expect(JSON.parse(JSON.stringify(state.tank.equipment))).toEqual({
      filter: { level: 2, conversionRate: 5 },
      heater: { installed: true },
      autoFeeder: { installed: false },
      light: { level: 1 },
    });
    void before;
  });

  it('INSUFFICIENT_FUNDS is atomic: money, equipment, and events untouched', () => {
    const state = createInitialState(3);
    state.money = 100;
    state.progression.unlocks = ['equipment.filter2'];
    const before = JSON.parse(JSON.stringify(state));
    const ctx = makeCtx(state);
    expect(buyEquipment(state, { kind: 'filter', level: 2 }, ctx)).toMatchObject({
      ok: false, error: { code: 'INSUFFICIENT_FUNDS' },
    });
    expect(state.money).toBe(100);
    expect(ctx.events).toEqual([]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(before);
  });
});

describe('tank.upgradeTier (BR9.2)', () => {
  it('upgrades tier 1 -> 2 for 300 and 2 -> 3 for 800, keeping heater and maturity', () => {
    const state = createInitialState(3);
    state.money = 2000;
    state.progression.unlocks = ['tier.2', 'tier.3', 'equipment.heater'];
    buyEquipment(state, { kind: 'heater', level: 1 }, makeCtx(state));
    state.tank.biofilterMaturity = 0.9;
    const ctx = makeCtx(state);
    expect(upgradeTier(state, { tier: 2 }, ctx)).toEqual({
      ok: true, value: { tier: 2, volumeL: 60, price: 300 },
    });
    expect(state.tank.volumeL).toBe(60);
    expect(state.tank.equipment.heater.installed).toBe(true);
    expect(state.tank.biofilterMaturity).toBe(0.9);
    expect(upgradeTier(state, { tier: 3 }, ctx)).toEqual({
      ok: true, value: { tier: 3, volumeL: 150, price: 800 },
    });
    expect(state.tank.volumeL).toBe(150);
    expect(state.money).toBe(2000 - 120 - 300 - 800);
    expect(ctx.events).toEqual([
      { kind: 'tierUpgraded', tier: 2 },
      { kind: 'moneyChanged', delta: -300, balance: 2000 - 120 - 300 },
      { kind: 'tierUpgraded', tier: 3 },
      { kind: 'moneyChanged', delta: -800, balance: 2000 - 120 - 300 - 800 },
    ]);
  });

  it('capacity is bioload-based: a crowd of tiny fish passes while one huge fish breaches', () => {
    const state = createInitialState(3);
    for (let i = 0; i < 100; i++) {
      state.fish[`f${i}`] = {
        id: `f${i}`, speciesId: 'trop', tankId: 'tank-1', sex: 'male', stage: 'adult',
        ageDays: 1, sizeCm: 0.1, health: 90, satiety: 0, stress: 0, genome: {},
        stunted: false, value: 1, mature: true,
      };
    }
    state.tank.bioload = 100 * 0.1 * 0.8; // 8
    expect(projectedBioload(state, 5)).toBe(13); // head-count would refuse 100 fish; load passes
    expect(projectedBioload(state, 5) <= 20).toBe(true);
    expect(projectedBioload(state, 15)).toBe(23);
    expect(projectedBioload(state, 15) <= 20).toBe(false);
  });
});
