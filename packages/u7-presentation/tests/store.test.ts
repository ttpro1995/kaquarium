// store.test.ts — Layer A Red: shell-store binding contract (C1; W38).
// The shell wrapper subscribes to the real U1 store, snapshots selectors on
// version bumps only, and never exposes a GameState writer. TDD: these tests
// were written before src/shell/store.ts and src/shell/settings.ts existed.
import { describe, expect, it } from 'vitest';
import { createKernel, type Kernel } from '@aquarium/u1-sim-foundation';
import { register as registerWater } from '@aquarium/u2-tank-water';
import { register as registerFish } from '@aquarium/u3-fish';
import { register as registerFeeding } from '@aquarium/u4-feeding';
import { register as registerBreeding } from '@aquarium/u5-breeding';
import { register as registerCommerce } from '@aquarium/u6-commerce';
import { createShellStore } from '../src/shell/store.js';
import { buildSettingsUpdate } from '../src/shell/settings.js';

function bootKernel(): Kernel {
  const kernel = createKernel(42);
  registerWater(kernel.registry);
  registerFish(kernel.registry);
  registerFeeding(kernel.registry);
  registerBreeding(kernel.registry);
  registerCommerce(kernel.registry);
  return kernel;
}

describe('shell store surface', () => {
  it('exposes read + dispatch only, never a GameState writer', () => {
    const store = createShellStore(bootKernel());
    const keys = Object.keys(store).sort();
    expect(keys).toEqual(['dispatch', 'getVersion', 'resync', 'snapshot', 'subscribe']);
    expect((store as unknown as Record<string, unknown>).state).toBeUndefined();
    expect((store as unknown as Record<string, unknown>).store).toBeUndefined();
  });

  it('snapshot reflects live selector values after boot', () => {
    const kernel = bootKernel();
    const store = createShellStore(kernel);
    const snap = store.snapshot();
    expect(snap.money).toBe(kernel.store.state.money);
    expect(snap.gameDay).toBe(kernel.store.state.clock.gameDay);
    expect(snap.gameHour).toBe(kernel.store.state.clock.gameHour);
    expect(snap.paused).toBe(kernel.store.state.clock.paused);
    expect(snap.settings.reducedMotion).toBe(false);
    expect(snap.version).toBe(kernel.store.version);
  });
});

describe('snapshot freezing (retry pin)', () => {
  it('deep-freezes the whole snapshot: top-level mutation throws', () => {
    const store = createShellStore(bootKernel());
    const snap = store.snapshot();
    expect(Object.isFrozen(snap)).toBe(true);
    expect(() => {
      (snap as unknown as Record<string, unknown>).money = 999_999;
    }).toThrow(TypeError);
  });

  it('freezes every nested selector result, not just .state', () => {
    const store = createShellStore(bootKernel());
    const snap = store.snapshot();
    expect(Object.isFrozen(snap.settings)).toBe(true);
    expect(Object.isFrozen(snap.settings.volume)).toBe(true);
    expect(Object.isFrozen(snap.water)).toBe(true);
    expect(Object.isFrozen(snap.fish)).toBe(true);
    expect(Object.isFrozen(snap.orders)).toBe(true);
    expect(Object.isFrozen(snap.notifications)).toBe(true);
    expect(() => {
      (snap.settings.volume as unknown as Record<string, unknown>).master = 0;
    }).toThrow(TypeError);
    expect(() => {
      (snap.fish as unknown as unknown[]).push({ id: 'hack' });
    }).toThrow(TypeError);
    expect(() => {
      (snap.water as unknown as Record<string, unknown>).waste = -1;
    }).toThrow(TypeError);
  });

  it('mutation attempts leave kernel state untouched', () => {
    const kernel = bootKernel();
    const store = createShellStore(kernel);
    const before = JSON.parse(JSON.stringify(kernel.store.state)) as unknown;
    const snap = store.snapshot();
    for (const attempt of [
      () => {
        (snap as unknown as Record<string, unknown>).money = -5;
      },
      () => {
        (snap.settings as unknown as Record<string, unknown>).reducedMotion = true;
      },
      () => {
        (snap.notifications as unknown as unknown[]).length = 0;
      },
    ]) {
      expect(attempt).toThrow(TypeError);
    }
    expect(kernel.store.state).toEqual(before);
  });

  it('shares no references with kernel state', () => {
    const kernel = bootKernel();
    const store = createShellStore(kernel);
    const snap = store.snapshot();
    expect(snap.settings).not.toBe(kernel.store.state.settings);
    expect(snap.water).not.toBe(kernel.store.state.tank.water);
  });
});

describe('version-gated memoization (no per-tick re-read)', () => {
  it('returns the same snapshot reference while the version is unchanged', () => {
    const store = createShellStore(bootKernel());
    expect(store.snapshot()).toBe(store.snapshot());
  });

  it('snapshot takes no selector argument (inline closures cannot defeat the cache)', () => {
    const store = createShellStore(bootKernel());
    expect(store.snapshot.length).toBe(0);
  });

  it('rebuilds once per accepted dispatch and refreshes from the store', () => {
    const kernel = bootKernel();
    const store = createShellStore(kernel);
    const before = store.snapshot();
    const outcome = store.dispatch('clock.setSpeed', { speed: 2 });
    expect(outcome.ok).toBe(true);
    const after = store.snapshot();
    expect(after).not.toBe(before);
    expect(after.version).toBe(before.version + 1);
    expect(after.speed).toBe(2);
  });

  it('a rejected dispatch neither bumps the version nor rebuilds', () => {
    const store = createShellStore(bootKernel());
    const before = store.snapshot();
    const outcome = store.dispatch('clock.setSpeed', { speed: 7 as never });
    expect(outcome.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });
});

describe('resync notifies only on change', () => {
  it('does not notify when nothing changed', () => {
    const store = createShellStore(bootKernel());
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.resync();
    store.resync();
    expect(calls).toBe(0);
  });

  it('notifies once per accepted dispatch and settles afterwards', () => {
    const store = createShellStore(bootKernel());
    const seen: number[] = [];
    store.subscribe((snap) => {
      seen.push(snap.version);
    });
    store.dispatch('clock.setSpeed', { speed: 4 });
    expect(seen.length).toBe(1);
    store.resync();
    expect(seen.length).toBe(1);
  });

  it('picks up ticks that bypass the shell dispatch and notifies once', async () => {
    const kernel = bootKernel();
    const store = createShellStore(kernel);
    const seen: number[] = [];
    store.subscribe((snap) => {
      seen.push(snap.version);
    });
    kernel.tick();
    // The tick drains subscribers before U1 bumps the version, so the shell
    // picks the bump up on a deferred resync (the App frame loop also calls
    // resync explicitly after every batch).
    await Promise.resolve();
    expect(seen.length).toBe(1);
    expect(store.snapshot().version).toBe(kernel.store.version);
  });

  it('unsubscribe stops delivery', () => {
    const store = createShellStore(bootKernel());
    let calls = 0;
    const off = store.subscribe(() => {
      calls += 1;
    });
    off();
    store.dispatch('clock.setSpeed', { speed: 2 });
    expect(calls).toBe(0);
  });
});

describe('settings diff (changed fields only)', () => {
  it('returns only the changed top-level field', () => {
    const store = createShellStore(bootKernel());
    const patch = buildSettingsUpdate(store.snapshot().settings, { reducedMotion: true });
    expect(patch).toEqual({ reducedMotion: true });
  });

  it('returns null when nothing changed so callers skip the dispatch', () => {
    const store = createShellStore(bootKernel());
    expect(buildSettingsUpdate(store.snapshot().settings, {})).toBeNull();
    expect(
      buildSettingsUpdate(store.snapshot().settings, {
        reducedMotion: false,
        volume: { master: 0.8, sfx: 0.8 },
      }),
    ).toBeNull();
  });

  it('diffs volume field-by-field', () => {
    const store = createShellStore(bootKernel());
    const patch = buildSettingsUpdate(store.snapshot().settings, {
      volume: { master: 0.3, sfx: 0.8 },
    });
    expect(patch).toEqual({ volume: { master: 0.3 } });
  });

  it('diffs autoPauseCritical like any other top-level field', () => {
    const store = createShellStore(bootKernel());
    expect(store.snapshot().settings.autoPauseCritical).toBe(true);
    const patch = buildSettingsUpdate(store.snapshot().settings, { autoPauseCritical: false });
    expect(patch).toEqual({ autoPauseCritical: false });
  });
});
