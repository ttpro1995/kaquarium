// @vitest-environment jsdom
// boot.test.ts — Layer D Red: the composition root boots the kernel, calls
// all six register() calls, asserts the catalogue exhaustive, and MOUNTS
// the Svelte shell with all 13 screens rendered. TankCanvas really
// instantiates Pixi through injectable factories and soft-fails without
// WebGL. Written before App.svelte existed.
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mount, unmount } from 'svelte';
import App from '../src/App.svelte';
import { createAppKernel, readSeed } from '../src/shell/boot.js';
import { checkFault, reloadToAutosave, watchFaults } from '../src/shell/fault.js';
import { runAwaySequence } from '../src/shell/away.js';
import { mountTankCanvas } from '../src/tank/pixiStage.js';
import { tintFor, tintHex } from '../src/tank/lighting.js';
import { testSpecies } from './fixtures.js';

const SCREENS = [
  'hud',
  'toolbar',
  'tank-canvas',
  'fish-panel',
  'roster-panel',
  'store-panel',
  'feeding-panel',
  'breeding-panel',
  'orders-panel',
  'tank-panel',
  'save-panel',
  'settings-panel',
  'bell-panel',
];

const mounted: unknown[] = [];
const hosts: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounted.splice(0)) {
    try {
      unmount(app as Record<string, unknown>);
    } catch {
      // best-effort teardown
    }
  }
  for (const host of hosts.splice(0)) host.remove();
  vi.unstubAllGlobals();
});

function mountApp(props: Record<string, unknown>): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  mounted.push(mount(App, { target: host, props: props as never }));
  return host;
}

const SRC = path.join(process.cwd(), 'packages', 'u7-presentation', 'src');

describe('boot composition root (W47)', () => {
  it('registers all six sim units and asserts the command catalogue exhaustive', () => {
    const { kernel } = createAppKernel({ seed: 11 });
    const types = kernel.registry.registeredCommandTypes();
    for (const type of [
      'settings.update',
      'clock.setSpeed',
      'clock.setPaused',
      'tank.waterChange',
      'tank.buyEquipment',
      'tank.upgradeTier',
      'feeding.buyFood',
      'feeding.feedFish',
      'feeding.feedFry',
      'feeding.setAutoFeeder',
      'breeding.pair',
      'breeding.unpair',
      'breeding.grade',
      'commerce.buyFish',
      'commerce.sellFish',
      'commerce.sellBulk',
      'orders.fulfil',
      'notifications.dismiss',
    ]) {
      expect(types).toContain(type);
    }
    const systems = kernel.registry.systemsSorted().map((s) => s.id);
    expect(systems).toEqual(
      expect.arrayContaining(['u2.water', 'u3.fish', 'u4.feeding', 'u5.breeding', 'u6.commerce', 'u6.notify']),
    );
  });

  it('mounts the Svelte shell with all 13 screens rendered', async () => {
    const { kernel, store } = createAppKernel({ seed: 11, speciesFiles: [{ file: 'guppy.json', data: testSpecies('guppy') }] });
    const host = mountApp({ store, kernel });
    await new Promise((resolve) => setTimeout(resolve, 30));
    for (const screen of SCREENS) {
      expect(host.querySelector(`[data-testid="${screen}"]`), screen).not.toBeNull();
    }
  });

  it('main.ts boots the kernel and mounts App.svelte to the #app root', () => {
    const mainSrc = fs.readFileSync(path.join(SRC, 'main.ts'), 'utf8');
    expect(mainSrc).toContain("from './App.svelte'");
    expect(mainSrc).toContain('mount(');
    expect(mainSrc).toContain("getElementById('app')");
    expect(mainSrc).toContain('createAppKernel');
    const bootSrc = fs.readFileSync(path.join(SRC, 'shell', 'boot.ts'), 'utf8');
    for (const register of [
      'registerWater',
      'registerFish',
      'registerFeeding',
      'registerBreeding',
      'registerCommerce',
    ]) {
      expect(bootSrc).toContain(register);
    }
    expect(bootSrc).toContain('assertExhaustive');
  });

  it('App.svelte composes every screen, both modals, and the fault boundary', () => {
    const appSrc = fs.readFileSync(path.join(SRC, 'App.svelte'), 'utf8');
    for (const component of [
      'Hud',
      'Toolbar',
      'TankCanvas',
      'FishPanel',
      'RosterPanel',
      'StorePanel',
      'FeedingPanel',
      'BreedingPanel',
      'OrdersPanel',
      'TankPanel',
      'SavePanel',
      'SettingsPanel',
      'BellPanel',
      'AwaySummaryModal',
      'ConfirmDialog',
      'FaultBoundary',
    ]) {
      expect(appSrc, component).toContain(`import ${component}`);
    }
  });

  it('every panel binds store selectors + dispatch; only App owns the subscription', () => {
    const panels = [
      'Hud',
      'Toolbar',
      'TankCanvas',
      'FishPanel',
      'RosterPanel',
      'StorePanel',
      'FeedingPanel',
      'BreedingPanel',
      'OrdersPanel',
      'TankPanel',
      'SavePanel',
      'SettingsPanel',
      'BellPanel',
    ];
    for (const panel of panels) {
      const src = fs.readFileSync(path.join(SRC, 'panels', `${panel}.svelte`), 'utf8');
      // Named module-level selectors — never an inline closure over the store.
      // (Toolbar is pure tab navigation over UI-local state: no sim data, no selector.)
      if (panel !== 'Toolbar') expect(src, panel).toContain('../shell/selectors.js');
      // Panels render from the snap prop and dispatch through actions;
      // the version-keyed subscription lives in App alone.
      expect(src, panel).not.toContain('store.subscribe');
      expect(src, panel).not.toContain('store.snapshot(');
    }
    const appSrc = fs.readFileSync(path.join(SRC, 'App.svelte'), 'utf8');
    expect(appSrc).toContain('store.subscribe');
  });

  it('TankCanvas instantiates Pixi through injected factories and forwards props', async () => {
    const { kernel, store } = createAppKernel({ seed: 11 });
    const seen: { width: number; height: number; background: string }[] = [];
    const pixi = {
      createApplication: (opts: { width: number; height: number; background: string }) => {
        seen.push(opts);
        return {};
      },
    };
    const host = mountApp({ store, kernel, pixi });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(seen.length).toBe(1);
    // The background is derived from the game clock, never hardcoded.
    expect(seen[0]?.background).toBe(tintHex(tintFor(1, 8)));
    // Canvas size is forwarded explicitly (defaults 800x450).
    expect(seen[0]?.width).toBe(800);
    expect(seen[0]?.height).toBe(450);
    expect(host.querySelector('[data-testid="pixi-stage"]')).not.toBeNull();
  });

  it('TankCanvas forwards an explicit canvas size to the Pixi factory', async () => {
    const { mount: mountCanvas } = await import('svelte');
    const TankCanvas = (await import('../src/panels/TankCanvas.svelte')).default;
    const { kernel, store } = createAppKernel({ seed: 11 });
    const seen: { width: number; height: number; background: string }[] = [];
    const pixi = {
      createApplication: (opts: { width: number; height: number; background: string }) => {
        seen.push(opts);
        return {};
      },
    };
    const host = document.createElement('div');
    document.body.appendChild(host);
    hosts.push(host);
    mounted.push(
      mountCanvas(TankCanvas, {
        target: host,
        props: { snap: store.snapshot(), pixi, width: 640, height: 360 } as never,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(seen.length).toBe(1);
    expect(seen[0]?.width).toBe(640);
    expect(seen[0]?.height).toBe(360);
  });

  it('TankCanvas soft-fails without WebGL instead of crashing boot', async () => {
    const { kernel, store } = createAppKernel({ seed: 11 });
    const host = mountApp({ store, kernel });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(host.querySelector('[data-testid="tank-canvas"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="tank-canvas-fallback"]')).not.toBeNull();
  });

  it('boot validates the catalogue per C5: invalid entries excluded, never a crash', () => {
    const warn = vi.fn();
    const { kernel } = createAppKernel({
      seed: 11,
      speciesFiles: [
        { file: 'guppy.json', data: testSpecies('guppy') },
        { file: 'broken.json', data: { id: '', tier: 99 } },
      ],
      speciesMode: 'prod',
      logger: { warn, info: () => undefined },
    });
    expect(warn).toHaveBeenCalled();
    expect(kernel.species.get('guppy')).toBeDefined();
    expect(kernel.species.get('')).toBeUndefined();
  });

  it('Store screen lists all 30 species with locked entries shown, never hidden', async () => {    const archetypes = ['livebearer', 'scatter', 'plant', 'cave', 'bubbleNester', 'annual', 'hardBreed'] as const;
    const species = Array.from({ length: 30 }, (_, i) =>
      testSpecies(`species-${i}`, {
        tier: ((i % 3) + 1) as 1 | 2 | 3,
        archetype: archetypes[i % archetypes.length] as 'livebearer',
        buyPrice: 5 + i,
      }),
    );
    const { kernel, store } = createAppKernel({
      seed: 11,
      speciesFiles: species.map((data) => ({ file: `${data.id}.json`, data })),
    });
    const host = mountApp({ store, kernel });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const rows = host.querySelectorAll('[data-testid^="store-row-"]');
    expect(rows.length).toBe(30);
  });

  it('readSeed defaults deterministically and honours ?seed=', () => {
    vi.stubGlobal('location', { search: '' });
    expect(readSeed()).toBe(20261113);
    vi.stubGlobal('location', { search: '?seed=99' });
    expect(readSeed()).toBe(99);
    vi.stubGlobal('location', { search: '?seed=notanumber' });
    expect(readSeed()).toBe(20261113);
  });

  it('mountTankCanvas appends a provided canvas and reports success', async () => {
    const host = document.createElement('div');
    const canvas = document.createElement('canvas');
    const mounted = await mountTankCanvas(host, {
      background: '#0b1622',
      factories: { createApplication: () => ({ canvas }) },
    });
    expect(mounted.fallback).toBe(false);
    expect(mounted.app).not.toBeNull();
    expect(host.querySelector('canvas')).toBe(canvas);
  });

  it('runAwaySequence returns null when there are no offline hours', () => {
    const { kernel } = createAppKernel({ seed: 11 });
    expect(runAwaySequence(kernel, 0)).toBeNull();
    expect(runAwaySequence(kernel, -5)).toBeNull();
  });

  it('fault hub reports no fault on a healthy kernel; reload names a missing autosave', () => {
    const { kernel } = createAppKernel({ seed: 11 });
    expect(checkFault(kernel)).toBeNull();
    const seen: unknown[] = [];
    const off = watchFaults(kernel, (fault) => {
      seen.push(fault);
    });
    off();
    const reloaded = reloadToAutosave(kernel);
    expect(reloaded.ok).toBe(false);
    expect(reloaded.message).toContain('SLOT_NOT_FOUND');
    expect(seen).toEqual([null]);
  });

  it('the public barrel exposes the shell contract', async () => {
    const index = (await import('../src/index.js')) as Record<string, unknown>;
    for (const name of [
      'createShellStore',
      'createAppKernel',
      'buildSettingsUpdate',
      'selectHud',
      'selectTankScene',
      'errorMessage',
      'outcomeMessage',
      'runAwaySequence',
      'resumeFromAway',
      'checkFault',
      'driveTick',
      'reloadToAutosave',
      'mountTankCanvas',
      'createBoidsWorld',
      'stepBoids',
      'tintFor',
      'snappedTint',
      'spriteFor',
      'toggleInSet',
      'formatMoney',
      'buyFish',
      'saveGame',
    ]) {
      expect(index[name], name).toBeDefined();
    }
  });

  it('main.ts mounts the real shell to the #app root', async () => {
    const root = document.createElement('div');
    root.id = 'app';
    document.body.appendChild(root);
    hosts.push(root);
    await import('../src/main.js');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(root.querySelector('[data-testid="app-shell"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="hud"]')).not.toBeNull();
  });

  it('axe audit of the mounted shell reports no violations (contrast excluded: jsdom has no layout)', async () => {
    const axe = (await import('axe-core')).default;
    const { kernel, store } = createAppKernel({
      seed: 11,
      speciesFiles: [{ file: 'guppy.json', data: testSpecies('guppy') }],
    });
    const host = mountApp({ store, kernel });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const results = await axe.run(host, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it('main.ts fails loudly without the #app root', async () => {
    for (const host of hosts.splice(0)) host.remove();
    for (const app of mounted.splice(0)) {
      try {
        unmount(app as Record<string, unknown>);
      } catch {
        // best-effort teardown
      }
    }
    document.getElementById('app')?.remove();
    vi.resetModules();
    await expect(import('../src/main.js')).rejects.toThrow('#app');
  });
});
