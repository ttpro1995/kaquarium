// @vitest-environment jsdom
// integration.test.ts — Layer D Red: the away and fault flows run end to
// end through the mounted App (modal state IN App, Resume dispatches
// setPaused false with speed back at 1; fault panel CAN trigger and
// reload-to-autosave recovers with no rollback), the bell focuses fish,
// and orderRewardPreview mirrors fulfil eligibility. Written first.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import App from '../src/App.svelte';
import { createAppKernel } from '../src/shell/boot.js';
import { driveTick } from '../src/shell/fault.js';
import { previewOrderReward } from '../src/panels/helpers.js';
import { buyFish, fulfilOrder } from '../src/panels/actions.js';
import { createShellStore } from '../src/shell/store.js';
import { addFish, bootTestKernel, testSpecies } from './fixtures.js';

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

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function click(host: HTMLElement, testid: string): void {
  const el = host.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
  if (el === null) throw new Error(`missing [data-testid="${testid}"]`);
  el.click();
}

describe('away flow end to end (W45)', () => {
  it('catch-up sets modal state in App; Resume dispatches setPaused false and restarts speed at 1', async () => {
    const { kernel, store } = createAppKernel({
      seed: 11,
      speciesFiles: [{ file: 'guppy.json', data: testSpecies('guppy') }],
    });
    const host = mountApp({ store, kernel, catchUpHours: 48 });
    await flush();
    const modal = host.querySelector('[data-testid="away-summary-modal"]');
    expect(modal).not.toBeNull();
    expect(modal?.textContent).toContain('2');
    // The clock stopped behind the modal (speed 0 + paused).
    expect(store.snapshot().paused).toBe(true);
    expect(store.snapshot().speed).toBe(0);

    click(host, 'away-resume');
    await flush();
    expect(host.querySelector('[data-testid="away-summary-modal"]')).toBeNull();
    expect(store.snapshot().paused).toBe(false);
    expect(store.snapshot().speed).toBe(1);
  });
});

describe('fault flow end to end (W46)', () => {
  it('tick-abort surfaces the fault panel; reload-to-autosave recovers with no rollback', async () => {
    const { kernel, store } = createAppKernel({
      seed: 11,
      speciesFiles: [{ file: 'guppy.json', data: testSpecies('guppy') }],
    });
    kernel.saves.autosave();
    const savedMoney = kernel.store.state.money;
    kernel.registry.registerSystem({
      id: 'u9.boom',
      phase: 'fish',
      run() {
        throw new Error('boom');
      },
    });
    const host = mountApp({ store, kernel });
    await flush();
    expect(host.querySelector('[data-testid="fault-boundary"]')).toBeNull();

    const loadSpy = vi.spyOn(kernel.saves, 'load');
    driveTick(kernel);
    await flush();
    const panel = host.querySelector('[data-testid="fault-boundary"]');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('u9.boom');

    click(host, 'fault-reload');
    await flush();
    expect(loadSpy).toHaveBeenCalled();
    expect(host.querySelector('[data-testid="fault-boundary"]')).toBeNull();
    expect(kernel.store.getFault()).toBeNull();
    // Recovered to the autosaved state — same money, halt cleared, no
    // in-memory reconstruction.
    expect(kernel.store.state.money).toBe(savedMoney);
    expect(kernel.store.halted).toBe(false);
  });
});

describe('bell focus flow (W43)', () => {
  it('toolbar exposes the bell tab so notifications stay reachable', async () => {
    const { kernel, store } = createAppKernel({
      seed: 11,
      speciesFiles: [{ file: 'guppy.json', data: testSpecies('guppy') }],
    });
    const host = mountApp({ store, kernel });
    await flush();
    const bellTab = host.querySelector('[data-testid="toolbar-tab-bell"]') as HTMLElement | null;
    expect(bellTab).not.toBeNull();
    bellTab?.click();
    await flush();
    const bellScreen = host.querySelector('[data-testid="screen-bell"]') as HTMLElement | null;
    expect(bellScreen?.hidden).toBe(false);
    expect(host.querySelector('[data-testid="bell-panel"]')).not.toBeNull();
  });

  it('notification click opens the Tank tab and focuses the subject fish', async () => {
    const { kernel, store } = createAppKernel({
      seed: 11,
      speciesFiles: [{ file: 'guppy.json', data: testSpecies('guppy') }],
    });
    const bought = buyFish(store, 'guppy');
    expect(bought.ok).toBe(true);
    const fishId = bought.value?.fishId as string;
    const host = mountApp({ store, kernel });
    await flush();

    click(host, 'hud-bell');
    await flush();
    const items = host.querySelectorAll('[data-testid^="bell-item-"]');
    expect(items.length).toBeGreaterThan(0);
    const focusButton = host.querySelector('[data-testid^="bell-focus-"]') as HTMLElement | null;
    expect(focusButton).not.toBeNull();
    focusButton?.click();
    await flush();
    const tankScreen = host.querySelector('[data-testid="screen-tank"]') as HTMLElement | null;
    expect(tankScreen?.hidden).toBe(false);
    expect(host.querySelector('[data-testid="tank-canvas"]')?.getAttribute('data-focus-fish')).toBe(fishId);
    expect(host.querySelector('[data-testid="fish-panel"]')?.textContent).toContain(fishId);
  });
});

describe('preview/eligibility mirror (retry pin)', () => {
  it('orderRewardPreview mirrors fulfil: eligible pays the preview, sick rejects both', () => {
    const kernel = bootTestKernel(9);
    kernel.store.state.money = 10_000;
    addFish(kernel, 'o1', 'guppy', 'female', { sizeCm: 3, health: 90 });
    kernel.store.state.orders.push({
      id: 'ord-9',
      speciesId: 'guppy',
      customer: 'hobbyist',
      quantity: 1,
      minHealth: 40,
      minSizeCm: 1,
      multiplier: 1.2,
      reward: 0,
      deadlineDay: kernel.store.state.clock.gameDay + 3,
      status: 'open',
    });
    const store = createShellStore(kernel);
    const speciesOf = (id: string) => kernel.species.get(id);
    const preview = previewOrderReward(kernel.store.state, 'ord-9', ['o1'], speciesOf);
    expect(preview).toBeDefined();
    const done = fulfilOrder(store, 'ord-9', ['o1']);
    expect(done.ok).toBe(true);
    expect(done.value?.reward).toBe(preview);

    addFish(kernel, 'o2', 'guppy', 'female', { sizeCm: 3, health: 10 });
    kernel.store.state.orders.push({
      id: 'ord-10',
      speciesId: 'guppy',
      customer: 'hobbyist',
      quantity: 1,
      minHealth: 40,
      minSizeCm: 1,
      multiplier: 1.2,
      reward: 0,
      deadlineDay: kernel.store.state.clock.gameDay + 3,
      status: 'open',
    });
    expect(previewOrderReward(kernel.store.state, 'ord-10', ['o2'], speciesOf)).toBeUndefined();
    const sick = fulfilOrder(store, 'ord-10', ['o2']);
    expect(sick.ok).toBe(false);
    expect(sick.message).toContain('FISH_UNSELLABLE');
  });
});
