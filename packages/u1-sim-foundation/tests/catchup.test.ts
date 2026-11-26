import { describe, expect, it } from 'vitest';
import { createRegistry } from '../src/registry.js';
import { createStore, replaceStoreState } from '../src/store.js';
import { runTick } from '../src/tick.js';
import { runCatchUp, MAX_CATCH_UP_TICKS } from '../src/catchup.js';
import { canonicalJson } from '../src/canonicalJson.js';
import { createInitialState } from '../src/types.js';
import { emptyCatalog } from '../src/species.js';
import type { System, TickContext } from '../src/registry.js';
import type { BaseSimEvent, SimEvent } from '../src/events.js';

/**
 * Test doubles for kinds owned by units not in the program yet (U3/U5/U6).
 * The double cast stays here so production types never see test-only kinds.
 */
function foreign(event: BaseSimEvent): SimEvent {
  return event as unknown as SimEvent;
}

function counterSystem(id: string, phase: System['phase'], seen: boolean[]): System {
  return {
    id,
    phase,
    run: (ctx: TickContext) => void seen.push(ctx.catchUp),
  } as unknown as System;
}

function livelyWorld() {
  const store = createStore(createInitialState(33));
  const registry = createRegistry();
  const species = emptyCatalog();
  registry.registerSystem({
    id: 'u.test.hatchery',
    phase: 'breeding',
    run: (ctx: TickContext) => {
      ctx.events.push(foreign({ kind: 'fryHatched', count: 2 }));
      ctx.events.push(foreign({ kind: 'fishMatured', fishId: 'f1', stage: 'adult' }));
    },
  } as unknown as System);
  registry.registerSystem({
    id: 'u.test.mortality',
    phase: 'fish',
    run: (ctx: TickContext) => {
      ctx.events.push(foreign({ kind: 'fishDied', fishId: 'f2', cause: 'oldAge' }));
      ctx.events.push(foreign({ kind: 'fishDied', fishId: 'f3', cause: 'starvation' }));
      ctx.events.push(foreign({ kind: 'orderExpired', orderId: 'o1' }));
    },
  } as unknown as System);
  return { store, registry, species };
}

describe('catch-up + fault containment (BR7.1, NFR4.2)', () => {
  it(`caps the advance at ${MAX_CATCH_UP_TICKS} ticks and discards the rest`, () => {
    const { store, registry, species } = livelyWorld();
    const summary = runCatchUp(store, registry, species, 500);
    expect(summary.ticksRun).toBe(192);
    expect(summary.capped).toBe(true);
    expect(store.tickCount).toBe(192);
  });

  it('threads catchUp=true through the same pipeline (false for live ticks)', () => {
    const store = createStore(createInitialState(33));
    const registry = createRegistry();
    const species = emptyCatalog();
    const seen: boolean[] = [];
    registry.registerSystem(counterSystem('u.test.probe', 'fish', seen));
    runTick(store, registry, species);
    runCatchUp(store, registry, species, 3);
    expect(seen).toEqual([false, true, true, true]);
  });

  it('emits one aggregated whileYouWereAway summary, even for zero elapsed', () => {
    const { store, registry, species } = livelyWorld();
    const batches: SimEvent[][] = [];
    store.subscribe((events) => void batches.push(events));
    const summary = runCatchUp(store, registry, species, 48);
    expect(summary).toMatchObject({
      elapsedDays: 2,
      hatched: 96,
      matured: 48,
      diedOfOldAge: 48,
      ordersExpired: 48,
    });
    const flat = batches.flat();
    const away = flat.filter((e) => e.kind === 'whileYouWereAway');
    expect(away.length).toBe(1);
    expect(away[0]).toMatchObject({ elapsedDays: 2, hatched: 96 });

    const empty = runCatchUp(createStore(createInitialState(1)), createRegistry(), species, 0);
    expect(empty.ticksRun).toBe(0);
  });

  it('stops the clock after catch-up (speed 0 + paused)', () => {
    const { store, registry, species } = livelyWorld();
    runCatchUp(store, registry, species, 25);
    expect(store.state.clock).toMatchObject({ speed: 0, paused: true });
  });

  it('contains faults: halt + getFault + reload-offer recovery', () => {
    const good = createInitialState(44);
    const store = createStore(good);
    const registry = createRegistry();
    const species = emptyCatalog();
    const lastGood = JSON.parse(canonicalJson(good)) as typeof good;
    registry.registerSystem({
      id: 'u.test.boom',
      phase: 'water',
      run: () => {
        throw new Error('filter exploded');
      },
    } as unknown as System);
    expect(() => runTick(store, registry, species)).toThrow('filter exploded');
    expect(store.halted).toBe(true);
    expect(store.getFault()).toMatchObject({ systemId: 'u.test.boom', message: 'filter exploded' });
    expect(() => runTick(store, createRegistry(), species)).toThrow(/halted/);
    // U7's reload-last-autosave offer: swap in the last good state.
    replaceStoreState(store, lastGood);
    expect(store.getFault()).toBeNull();
    expect(store.halted).toBe(false);
    runTick(store, createRegistry(), species);
    expect(store.tickCount).toBe(1);
  });

  it('bumps version once per catch-up tick', () => {
    const { store, registry, species } = livelyWorld();
    runCatchUp(store, registry, species, 5);
    expect(store.version).toBe(5);
    expect(store.dirty).toBe(true);
  });
});
