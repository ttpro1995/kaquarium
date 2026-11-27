// unlocks-crosscheck.test.ts — U2/U6 unlock-ID contract (adversarial review follow-up).
// Every unlock id U2 gates a purchase on must be awarded by U6 progression;
// the equipmentUpgraded event format is "<kind>:<level>".
// Fails until U2 exports its canonical unlock tables and U6 consumes them.
import { describe, expect, it } from 'vitest';
import { createInitialState, createRng, emptyCatalog, type GameState } from '@aquarium/u1-sim-foundation';
import type { CommandContext } from '@aquarium/u1-sim-foundation';
import { EQUIPMENT_UNLOCKS, TIER_UNLOCKS, buyEquipment } from '@aquarium/u2-tank-water';
import { UNLOCKS } from '../src/progression.js';

function makeCtx(state: GameState): CommandContext {
  return {
    now: { day: state.clock.gameDay, hour: state.clock.gameHour },
    rng: createRng(state.rngState),
    species: emptyCatalog(),
    events: [],
  };
}

describe('U2-gated unlock ids are a subset of U6 progression awards', () => {
  it('every U2-gated id is awarded by some U6 level', () => {
    const awarded = new Set<string>([...UNLOCKS[2], ...UNLOCKS[3]]);
    const gated: string[] = [
      ...Object.values(EQUIPMENT_UNLOCKS).flatMap((byLevel) =>
        Object.values(byLevel).filter((id): id is string => typeof id === 'string'),
      ),
      ...Object.values(TIER_UNLOCKS).filter((id): id is string => typeof id === 'string'),
    ];
    expect(gated.length).toBeGreaterThan(0);
    for (const id of gated) {
      expect(awarded.has(id)).toBe(true);
    }
  });

  it('equipmentUpgraded format is "<kind>:<level>" for every gated purchase', () => {
    const cases = [
      { kind: 'filter', level: 2, unlock: 'equipment.filter2' },
      { kind: 'filter', level: 3, unlock: 'equipment.filter3' },
      { kind: 'heater', level: 1, unlock: 'equipment.heater' },
      { kind: 'light', level: 2, unlock: 'equipment.light2' },
      { kind: 'light', level: 3, unlock: 'equipment.light3' },
      { kind: 'autoFeeder', level: 1, unlock: 'equipment.autofeeder' },
    ] as const;
    for (const { kind, level, unlock } of cases) {
      const state = createInitialState(3);
      state.money = 1000;
      expect(EQUIPMENT_UNLOCKS[kind][level]).toBe(unlock);
      state.progression.unlocks = [unlock];
      const ctx = makeCtx(state);
      // Light L3 chains on L2; unlock both for that case.
      if (kind === 'light' && level === 3) {
        state.progression.unlocks.push('equipment.light2');
        buyEquipment(state, { kind: 'light', level: 2 }, makeCtx(state));
      }
      const outcome = buyEquipment(state, { kind, level }, ctx);
      expect(outcome.ok).toBe(true);
      expect(ctx.events[0]).toEqual({ kind: 'equipmentUpgraded', equipment: `${kind}:${String(level)}` });
    }
  });
});
