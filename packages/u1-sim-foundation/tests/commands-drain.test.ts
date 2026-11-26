import { describe, expect, it } from 'vitest';
import { declareCommandType, registerKernelCommands, dispatchCommand } from '../src/bus.js';
import { createRegistry } from '../src/registry.js';
import { createStore } from '../src/store.js';
import { canonicalJson } from '../src/canonicalJson.js';
import { createInitialState } from '../src/types.js';
import { emptyCatalog } from '../src/species.js';

import type { GameState } from '../src/types.js';
import type { CommandContext, CommandMap } from '../src/commands.js';

declare module '../src/commands.js' {
  interface CommandMap {
    'test.echo': { payload: { text: string }; result: { echoed: boolean } };
  }
}
declareCommandType('test.echo');

function setup() {
  const store = createStore(createInitialState(11));
  const registry = createRegistry();
  registerKernelCommands(registry);
  registry.registerCommand('test.echo', (state: GameState, payload: { text: string }, ctx: CommandContext) => {
    void state;
    ctx.events.push({ kind: 'test.echo', text: payload.text });
    return { ok: true, value: { echoed: true } };
  });
  const species = emptyCatalog();
  return { store, registry, species };
}

describe('command bus + event drain (BR1.2, BR3.1)', () => {
  it('applies a valid settings.update: mutate, drain, bump once, dirty', () => {
    const { store, registry, species } = setup();
    const seen: unknown[][] = [];
    store.subscribe((events) => void seen.push(events));
    const before = store.version;
    const outcome = dispatchCommand(store, registry, species, 'settings.update', {
      reducedMotion: true,
      volume: { master: 0.5 },
    });
    expect(outcome.ok).toBe(true);
    expect(store.state.settings.reducedMotion).toBe(true);
    expect(store.state.settings.volume.master).toBe(0.5);
    expect(store.state.settings.volume.sfx).toBe(0.8);
    expect(store.version).toBe(before + 1);
    expect(store.dirty).toBe(true);
    expect(seen.length).toBe(1);
  });

  it('rejects an invalid settings.update and touches nothing', () => {
    const { store, registry, species } = setup();
    const digest = canonicalJson(store.state);
    let calls = 0;
    store.subscribe(() => void (calls += 1));
    const outcome = dispatchCommand(store, registry, species, 'settings.update', {
      volume: { master: 5 },
    });
    expect(outcome).toEqual({
      ok: false,
      error: { code: 'INVALID_SETTING', message: expect.any(String) },
    });
    expect(canonicalJson(store.state)).toBe(digest);
    expect(store.version).toBe(0);
    expect(store.dirty).toBe(false);
    expect(calls).toBe(0);
  });

  it('mirrors speed and paused, and unpause always restores speed 1 (BR1.2)', () => {
    const { store, registry, species } = setup();
    expect(dispatchCommand(store, registry, species, 'clock.setSpeed', { speed: 4 }).ok).toBe(true);
    expect(store.state.clock).toMatchObject({ speed: 4, paused: false });
    expect(dispatchCommand(store, registry, species, 'clock.setPaused', { paused: true }).ok).toBe(true);
    expect(store.state.clock).toMatchObject({ speed: 0, paused: true });
    expect(dispatchCommand(store, registry, species, 'clock.setPaused', { paused: false }).ok).toBe(true);
    expect(store.state.clock).toMatchObject({ speed: 1, paused: false });
  });

  it('rejects an unknown speed with NOT_AVAILABLE and changes nothing', () => {
    const { store, registry, species } = setup();
    const digest = canonicalJson(store.state);
    const outcome = dispatchCommand(store, registry, species, 'clock.setSpeed', { speed: 3 as 1 });
    expect(outcome).toEqual({
      ok: false,
      error: { code: 'NOT_AVAILABLE', message: expect.any(String) },
    });
    expect(canonicalJson(store.state)).toBe(digest);
    expect(store.version).toBe(0);
  });

  it('returns UNKNOWN_COMMAND for undeclared types without touching state', () => {
    const { store, registry, species } = setup();
    const digest = canonicalJson(store.state);
    const outcome = dispatchCommand(store, registry, species, 'nope.missing' as never, {} as never);
    expect(outcome).toEqual({
      ok: false,
      error: { code: 'UNKNOWN_COMMAND', message: expect.any(String) },
    });
    expect(canonicalJson(store.state)).toBe(digest);
    expect(store.version).toBe(0);
  });

  it('isolates subscribers: one throwing listener never stops the rest', () => {
    const { store, registry, species } = setup();
    const received: unknown[][] = [];
    store.subscribe(() => {
      throw new Error('listener boom');
    });
    store.subscribe((events) => void received.push(events));
    const outcome = dispatchCommand(store, registry, species, 'test.echo', { text: 'hi' });
    expect(outcome.ok).toBe(true);
    expect(received.length).toBe(1);
    expect(received[0]).toEqual([{ kind: 'test.echo', text: 'hi' }]);
    expect(store.events.length).toBe(0);
  });

  it('applies the notification mapper on the command drain', () => {
    const { store, registry, species } = setup();
    registry.registerNotificationMapper((event) =>
      event.kind === 'test.echo'
        ? { id: 'n1', priority: 'info', kind: 'test.echo', subjectId: 's', message: 'echo' }
        : null,
    );
    dispatchCommand(store, registry, species, 'test.echo', { text: 'hi' });
    expect(store.state.notifications.length).toBe(1);
  });

  it('exposes no fault on a fresh store', () => {
    const { store } = setup();
    expect(store.getFault()).toBeNull();
  });
});
