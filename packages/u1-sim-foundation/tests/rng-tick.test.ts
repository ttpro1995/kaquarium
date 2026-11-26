import { describe, expect, it } from 'vitest';
import { createRng } from '../src/rng.js';
import { createRegistry, PHASE_ORDER } from '../src/registry.js';
import { createStore } from '../src/store.js';
import { runTick } from '../src/tick.js';
import { createInitialState } from '../src/types.js';
import { emptyCatalog } from '../src/species.js';
import type { BaseSimEvent } from '../src/events.js';
import type { System } from '../src/registry.js';

function recorder(order: string[], id: string, phase: System['phase']) {
  return {
    id,
    phase,
    run(ctx: { events: BaseSimEvent[]; state: { money: number } }) {
      order.push(id);
      ctx.events.push({ kind: 'test.ping', seq: order.length });
      ctx.state.money += 1;
    },
  } as unknown as System;
}

describe('RNG + tick pipeline + registry (BR1.1, BR2.1, BR4.1, BR4.2)', () => {
  it('replays the same draw sequence from the same seed (BR2.1)', () => {
    const a = createInitialState(42);
    const b = createInitialState(42);
    const ra = createRng(a.rngState);
    const rb = createRng(b.rngState);
    const sa = Array.from({ length: 10 }, () => ra.next());
    const sb = Array.from({ length: 10 }, () => rb.next());
    expect(sa).toEqual(sb);
  });

  it('draws bounded integers and picks, refusing empty inputs', () => {
    const s = createInitialState(3);
    const r = createRng(s.rngState);
    for (let i = 0; i < 50; i++) {
      const n = r.nextInt(1, 3);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
    expect(r.pick(['a', 'b'])).toMatch(/^[ab]$/);
    expect(() => r.nextInt(5, 4)).toThrow();
    expect(() => r.pick([])).toThrow();
  });

  it('diverges for different seeds and advances the cursor', () => {
    const s = createInitialState(1);
    const r = createRng(s.rngState);
    const before = s.rngState.a;
    const first = [r.next(), r.next(), r.next()];
    expect(s.rngState.a).not.toBe(before);
    const other = createRng(createInitialState(2).rngState);
    const second = [other.next(), other.next(), other.next()];
    expect(first).not.toEqual(second);
  });

  it('runs phases in canonical order regardless of registration order (BR4.1)', () => {
    const store = createStore(createInitialState(5));
    const registry = createRegistry();
    const order: string[] = [];
    const reversed = [...PHASE_ORDER].reverse();
    for (const phase of reversed) recorder(order, `u.test.${phase}`, phase);
    for (const phase of reversed) registry.registerSystem(recorder(order, `u.test.${phase}`, phase));
    runTick(store, registry, emptyCatalog());
    expect(order).toEqual([
      'u.test.feeding',
      'u.test.water',
      'u.test.fish',
      'u.test.breeding',
      'u.test.commerce',
      'u.test.notify',
    ]);
  });

  it('advances one game hour, bumps version once, marks dirty (BR1.1)', () => {
    const store = createStore(createInitialState(5));
    const registry = createRegistry();
    runTick(store, registry, emptyCatalog());
    expect(store.state.clock.gameHour).toBe(9);
    expect(store.version).toBe(1);
    expect(store.dirty).toBe(true);
  });

  it('rolls the hour into the next day', () => {
    const state = createInitialState(5);
    state.clock.gameHour = 23;
    const store = createStore(state);
    runTick(store, createRegistry(), emptyCatalog());
    expect(store.state.clock.gameHour).toBe(0);
    expect(store.state.clock.gameDay).toBe(2);
  });

  it('throws on duplicate system, command, or mapper registration (BR4.2)', () => {
    const registry = createRegistry();
    const sys = recorder([], 'u.test.dup', 'fish');
    registry.registerSystem(sys);
    expect(() => registry.registerSystem(sys)).toThrow();
    const handler = (() => ({ ok: true, value: undefined })) as never;
    registry.registerCommand('settings.update', handler);
    expect(() => registry.registerCommand('settings.update', handler)).toThrow();
    const mapper = (() => null) as never;
    registry.registerNotificationMapper(mapper);
    expect(() => registry.registerNotificationMapper(mapper)).toThrow();
  });

  it('fails the exhaustiveness gate when a declared command has no handler (BR4.2)', () => {
    const registry = createRegistry();
    expect(() => registry.assertExhaustive()).toThrow();
  });

  it('halts the loop and records a fault when a system throws (NFR4.2)', () => {
    const store = createStore(createInitialState(5));
    const registry = createRegistry();
    registry.registerSystem({
      id: 'u.test.boom',
      phase: 'fish',
      run: () => {
        throw new Error('boom');
      },
    });
    expect(() => runTick(store, registry, emptyCatalog())).toThrow('boom');
    expect(store.halted).toBe(true);
    expect(store.getFault()).toMatchObject({ systemId: 'u.test.boom' });
    expect(() => runTick(store, createRegistry(), emptyCatalog())).toThrow(/halted/);
  });
});
