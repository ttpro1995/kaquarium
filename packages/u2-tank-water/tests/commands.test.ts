// commands.test.ts — integration through the real U1 bus + registry (W9, W10).
import { describe, expect, it } from 'vitest';
import { createKernel, type SimEvent } from '@aquarium/u1-sim-foundation';
import { register } from '../src/index.js';

function setup() {
  const kernel = createKernel(3);
  register(kernel.registry);
  const seen: SimEvent[][] = [];
  kernel.store.subscribe((events) => {
    seen.push(events);
  });
  return { kernel, seen };
}

describe('tank commands through the bus (W9, W10)', () => {
  it('tank.waterChange deducts the volume fee and emits the pair through the drain', () => {
    const { kernel, seen } = setup();
    kernel.store.state.money = 500;
    kernel.store.state.tank.water.waste = 80;
    kernel.store.state.tank.water.nitrate = 40;
    const version = kernel.store.version;
    const outcome = kernel.dispatch('tank.waterChange', { portionPct: 50 });
    expect(outcome).toEqual({ ok: true, value: { fee: 5, waste: 40, nitrate: 20 } });
    expect(kernel.store.state.money).toBe(495);
    expect(kernel.store.version).toBe(version + 1);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual([
      { kind: 'waterChanged', wasteDelta: 40 },
      { kind: 'moneyChanged', delta: -5, balance: 495 },
    ]);
  });

  it('tank.upgradeTier deducts and emits the pair through the drain', () => {
    const { kernel, seen } = setup();
    kernel.store.state.money = 1000;
    kernel.store.state.progression.unlocks = ['tier.2'];
    const outcome = kernel.dispatch('tank.upgradeTier', { tier: 2 });
    expect(outcome).toEqual({ ok: true, value: { tier: 2, volumeL: 60, price: 300 } });
    expect(kernel.store.state.tank.volumeL).toBe(60);
    expect(kernel.store.state.money).toBe(700);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual([
      { kind: 'tierUpgraded', tier: 2 },
      { kind: 'moneyChanged', delta: -300, balance: 700 },
    ]);
  });

  it('rejected commands change nothing, emit nothing, and bump nothing', () => {
    const { kernel, seen } = setup();
    kernel.store.state.money = 500;
    const version = kernel.store.version;
    expect(kernel.dispatch('tank.waterChange', { portionPct: 5 })).toMatchObject({
      ok: false, error: { code: 'INVALID_QUANTITY' },
    });
    expect(kernel.dispatch('tank.upgradeTier', { tier: 2 })).toMatchObject({
      ok: false, error: { code: 'NOT_AVAILABLE' },
    });
    expect(kernel.store.state.money).toBe(500);
    expect(kernel.store.state.tank.volumeL).toBe(20);
    expect(kernel.store.version).toBe(version);
    expect(seen).toHaveLength(0);
    expect(kernel.store.state.notifications).toEqual([]);
  });

  it('a full tick runs the registered u2.water system in phase order', () => {
    const { kernel } = setup();
    kernel.store.state.fish.f1 = {
      id: 'f1', speciesId: 'trop', tankId: 'tank-1', sex: 'male', stage: 'adult',
      ageDays: 1, sizeCm: 5, health: 90, satiety: 80, stress: 0, genome: {},
      stunted: false, value: 10, mature: true,
    };
    kernel.tick();
    // species unknown to the empty catalogue: falls back to body size, 5 x 1.2 = 6
    expect(kernel.store.state.tank.bioload).toBeCloseTo(6);
    expect(kernel.store.version).toBe(1);
  });
});
