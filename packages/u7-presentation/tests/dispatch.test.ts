// dispatch.test.ts — Layer C Red: every panel action dispatches through the
// REAL kernel bus; ok → refresh-from-store, err → named message at the
// originating item. Save menu calls the SaveLoadApi directly, never the bus.
// No call site may discard an outcome. Written before outcomes/actions/menu.
import { describe, expect, it } from 'vitest';
import type { SlotRef } from '@aquarium/u1-sim-foundation';
import { previewBulkSale } from '../src/panels/helpers.js';
import { errorMessage, outcomeMessage } from '../src/shell/outcomes.js';
import {
  buyEquipment,
  buyFish,
  buyFood,
  bulkSell,
  dismissNotification,
  feedFish,
  feedFry,
  fulfilOrder,
  gradeCohort,
  pairFish,
  sellFish,
  setAutoFeeder,
  setPaused,
  setSpeed,
  unpairPair,
  updateSettings,
  upgradeTier,
  waterChange,
} from '../src/panels/actions.js';
import {
  confirmImportGame,
  confirmLoadGame,
  deleteGame,
  exportGame,
  importGame,
  listSlots,
  loadGame,
  saveGame,
} from '../src/save/menu.js';
import { createShellStore } from '../src/shell/store.js';
import { addFish, addFryCohort, bootTestKernel, testSpecies } from './fixtures.js';

describe('outcome mapping (no discarded outcomes)', () => {
  it('maps every known error code to a named, player-safe message', () => {
    const codes = [
      'INSUFFICIENT_FUNDS',
      'TANK_FULL',
      'FISH_UNSELLABLE',
      'INVALID_QUANTITY',
      'UNKNOWN_ENTITY',
      'NOT_AVAILABLE',
      'INVALID_SETTING',
      'UNKNOWN_COMMAND',
    ] as const;
    for (const code of codes) {
      const message = errorMessage({ code, message: `${code} happened` });
      expect(message.length).toBeGreaterThan(0);
      expect(message).toContain(code);
    }
  });

  it('falls back to the code name when the handler message is empty', () => {
    expect(errorMessage({ code: 'TANK_FULL', message: '' })).toContain('TANK_FULL');
  });

  it('outcomeMessage is null on ok and the named message on err', () => {
    expect(outcomeMessage({ ok: true, value: { price: 5 } })).toBeNull();
    expect(outcomeMessage({ ok: false, error: { code: 'NOT_AVAILABLE', message: 'locked' } })).toContain(
      'NOT_AVAILABLE',
    );
  });
});

describe('commerce panel actions (W39–W40, W42)', () => {
  it('buyFish ok refreshes from the store; insufficient funds names $FISH at the item', () => {
    const kernel = bootTestKernel();
    const store = createShellStore(kernel);
    const bought = buyFish(store, 'guppy');
    expect(bought.ok).toBe(true);
    expect(bought.message).toBeNull();
    expect(bought.value?.fishId).toBeDefined();
    expect(store.snapshot().money).toBe(90);

    kernel.store.state.money = 1;
    // Direct writes bypass versioning, so refresh through a real command
    // before asserting what the store sees.
    store.dispatch('clock.setSpeed', { speed: 1 });
    expect(store.snapshot().money).toBe(1);
    const broke = buyFish(store, 'guppy');
    expect(broke.ok).toBe(false);
    expect(broke.message).toContain('$FISH');
    expect(store.snapshot().money).toBe(1);
  });

  it('unknown species surfaces UNKNOWN_ENTITY, locked tier NOT_AVAILABLE', () => {
    const kernel = bootTestKernel(7, [testSpecies('guppy'), testSpecies('oscar', { tier: 3, buyPrice: 50 })]);
    const store = createShellStore(kernel);
    expect(buyFish(store, 'nope').message).toContain('UNKNOWN_ENTITY');
    const locked = buyFish(store, 'oscar');
    expect(locked.ok).toBe(false);
    expect(locked.message).toContain('NOT_AVAILABLE');
  });

  it('sellFish rejects unknown fish and sick fish by name', () => {
    const kernel = bootTestKernel();
    const store = createShellStore(kernel);
    expect(sellFish(store, 'ghost').message).toContain('UNKNOWN_ENTITY');
    addFish(kernel, 'sick-1', 'guppy', 'male', { health: 10 });
    const sick = sellFish(store, 'sick-1');
    expect(sick.ok).toBe(false);
    expect(sick.message).toMatch(/sick|FISH_UNSELLABLE/);
    expect(kernel.store.state.fish['sick-1']).toBeDefined();
  });

  it('bulkSell preview total equals the real sale total; sick fish skip by name', () => {
    const kernel = bootTestKernel();
    addFish(kernel, 'a', 'guppy', 'female');
    addFish(kernel, 'b', 'guppy', 'male');
    addFish(kernel, 'c', 'guppy', 'male', { health: 5 });
    const store = createShellStore(kernel);
    const speciesOf = (id: string) => kernel.species.get(id);
    const preview = previewBulkSale(kernel.store.state, ['a', 'b', 'c'], speciesOf);
    const result = bulkSell(store, ['a', 'b', 'c']);
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({ sold: 2, skipped: 1 });
    expect(result.value?.total).toBe(preview.total);
    expect(result.message).toContain('c');
  });

  it('fulfil ok pays the previewed reward; unknown order names UNKNOWN_ENTITY', () => {
    const kernel = bootTestKernel();
    addFish(kernel, 'o1', 'guppy', 'female', { sizeCm: 3, health: 90 });
    kernel.store.state.orders.push({
      id: 'ord-1',
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
    expect(fulfilOrder(store, 'ghost', ['o1']).message).toContain('UNKNOWN_ENTITY');
    const done = fulfilOrder(store, 'ord-1', ['o1']);
    expect(done.ok).toBe(true);
    expect(done.message).toBeNull();
    expect(done.value?.reward).toBeGreaterThan(0);
  });

  it('dismiss removes the notification; unknown id names UNKNOWN_ENTITY', () => {
    const kernel = bootTestKernel();
    kernel.store.state.notifications.push({
      id: 'n1',
      priority: 'info',
      kind: 'test',
      message: 'hello',
    });
    const store = createShellStore(kernel);
    expect(dismissNotification(store, 'ghost').message).toContain('UNKNOWN_ENTITY');
    const done = dismissNotification(store, 'n1');
    expect(done.ok).toBe(true);
    expect(store.snapshot().notifications).toHaveLength(0);
  });
});

describe('breeding panel actions (W41)', () => {
  it('pairFish ok returns the bond; unknown fish names UNKNOWN_ENTITY', () => {
    const kernel = bootTestKernel();
    addFish(kernel, 'f1', 'guppy', 'female');
    addFish(kernel, 'm1', 'guppy', 'male');
    const store = createShellStore(kernel);
    expect(pairFish(store, 'ghost', 'm1').message).toContain('UNKNOWN_ENTITY');
    const done = pairFish(store, 'f1', 'm1');
    expect(done.ok).toBe(true);
    expect(done.message).toBeNull();
    expect(done.value?.pairId).toBeDefined();
  });

  it('unpairPair removes the bond; gradeCohort names eggs/not-ready and grades fry', () => {
    const kernel = bootTestKernel();
    addFish(kernel, 'f1', 'guppy', 'female');
    addFish(kernel, 'm1', 'guppy', 'male');
    const store = createShellStore(kernel);
    expect(unpairPair(store, 'ghost').message).toContain('UNKNOWN_ENTITY');
    const paired = pairFish(store, 'f1', 'm1');
    expect(paired.ok).toBe(true);
    const pairId = paired.value?.pairId as string;
    expect(unpairPair(store, pairId).ok).toBe(true);

    kernel.store.state.cohorts['eggs-1'] = {
      id: 'eggs-1',
      speciesId: 'guppy',
      tankId: kernel.store.state.tank.id,
      bornDay: 1,
      count: 6,
      ageDays: 2,
      genomePool: {},
      survivalFactor: 1,
      stage: 'eggs',
      firstFoodDays: 0,
      lastFryFedDay: 0,
    };
    const eggs = gradeCohort(store, 'eggs-1', 2);
    expect(eggs.ok).toBe(false);
    expect(eggs.message).toMatch(/egg|ready|INVALID_SETTING/);

    addFryCohort(kernel, 'fry-1', 'guppy', 4);
    const graded = gradeCohort(store, 'fry-1', 2);
    expect(graded.ok).toBe(true);
    expect(graded.value?.graded).toBe(2);
    expect(graded.message).toBeNull();
  });
});

describe('tank + feeding panel actions (W48–W49)', () => {
  it('waterChange ok charges the fee; out-of-range names INVALID_QUANTITY', () => {
    const kernel = bootTestKernel();
    const store = createShellStore(kernel);
    const bad = waterChange(store, 5);
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain('INVALID_QUANTITY');
    const done = waterChange(store, 20);
    expect(done.ok).toBe(true);
    expect(done.value?.fee).toBeGreaterThan(0);
  });

  it('buyEquipment and upgradeTier surface unlock and funds names', () => {
    const kernel = bootTestKernel();
    const store = createShellStore(kernel);
    const locked = buyEquipment(store, 'heater', 1);
    expect(locked.ok).toBe(false);
    expect(locked.message).toContain('NOT_AVAILABLE');
    kernel.store.state.progression.unlocks.push('equipment.heater', 'equipment.filter2', 'tier.2');
    kernel.store.state.money = 10_000;
    expect(buyEquipment(store, 'heater', 1).ok).toBe(true);
    expect(upgradeTier(store, 2).ok).toBe(true);
    expect(store.snapshot().water.capacity).toBe(60);
    kernel.store.state.money = 0;
    expect(buyEquipment(store, 'filter', 2).message).toMatch(/\$FISH|FUNDS/);
  });

  it('feeding rows wire buy/feed/schedule with row-level messages', () => {
    const kernel = bootTestKernel();
    kernel.store.state.money = 10_000;
    const store = createShellStore(kernel);
    expect(buyFood(store, 'sludge', 1).message).toContain('UNKNOWN_ENTITY');
    const bought = buyFood(store, 'flakes', 2);
    expect(bought.ok).toBe(true);
    const foodId = bought.value?.foodId as string;
    expect(feedFish(store, foodId, 1).ok).toBe(true);
    expect(feedFish(store, foodId, 0).message).toContain('INVALID_QUANTITY');

    const fryFood = buyFood(store, 'liveFirst', 2);
    expect(fryFood.ok).toBe(true);
    addFryCohort(kernel, 'fry-9', 'guppy', 3);
    expect(feedFry(store, fryFood.value?.foodId as string, 'fry-9', 1).ok).toBe(true);
    expect(feedFry(store, foodId, 'fry-9', 1).message).toMatch(/Fry food|INVALID_SETTING/);

    expect(setAutoFeeder(store, { foodKind: 'flakes', portions: 1, intervalHours: 6 }).message).toContain(
      'NOT_AVAILABLE',
    );
    kernel.store.state.tank.equipment.autoFeeder.installed = true;
    expect(setAutoFeeder(store, { foodKind: 'flakes', portions: 1, intervalHours: 6 }).ok).toBe(true);
    expect(setAutoFeeder(store, null).ok).toBe(true);
  });
});

describe('clock + settings actions (W38, W49)', () => {
  it('setSpeed/setPaused drive the exact clock commands', () => {
    const kernel = bootTestKernel();
    const store = createShellStore(kernel);
    expect(setSpeed(store, 4).ok).toBe(true);
    expect(store.snapshot().speed).toBe(4);
    expect(setPaused(store, true).ok).toBe(true);
    expect(store.snapshot().paused).toBe(true);
    expect(setPaused(store, false).ok).toBe(true);
    expect(store.snapshot().speed).toBe(1);
  });

  it('updateSettings sends changed fields only and skips no-op edits', () => {
    const kernel = bootTestKernel();
    const store = createShellStore(kernel);
    const version = store.getVersion();
    const skipped = updateSettings(store, { reducedMotion: false });
    expect(skipped.ok).toBe(true);
    expect(skipped.message).toBeNull();
    expect(store.getVersion()).toBe(version);
    const changed = updateSettings(store, { reducedMotion: true, volume: { master: 0.3 } });
    expect(changed.ok).toBe(true);
    expect(store.snapshot().settings.reducedMotion).toBe(true);
    expect(store.snapshot().settings.volume.master).toBe(0.3);
    expect(store.snapshot().settings.volume.sfx).toBe(0.8);
  });
});

describe('save menu (W44 - direct SaveLoadApi, never the bus)', () => {
  // A kernel whose save-clock we control, so savedAt ordering is deterministic.
  function bootStaleKernel() {
    let current = '2026-01-01T00:00:00.000Z';
    const kernel = bootTestKernel(7, [testSpecies('guppy')], { now: () => current });
    return {
      kernel,
      saves: kernel.saves,
      advance: (next: string) => {
        current = next;
      },
    };
  }

  it('save/list/load round-trips; STALE_SAVE opens confirm-never-silent-overwrite', () => {
    const k2 = bootStaleKernel();
    const { saves, advance } = k2;
    const first = saveGame(saves, 'slot-a');
    expect(first.ok).toBe(true);
    advance('2026-01-02T00:00:00.000Z');
    const second = saveGame(saves, 'slot-b');
    expect(second.ok).toBe(true);
    expect(listSlots(saves)).toHaveLength(2);

    const staleRef: SlotRef = { kind: 'manual', name: 'slot-a' };
    const stale = loadGame(saves, staleRef);
    expect(stale.ok).toBe(false);
    expect(stale.needsConfirm).toBe(true);
    expect(stale.message).toContain('STALE_SAVE');
    const confirmed = confirmLoadGame(saves, staleRef);
    expect(confirmed.ok).toBe(true);
  });

  it('export/import round-trips; corrupt text names CORRUPT_JSON with the save untouched', () => {
    const k2 = bootStaleKernel();
    const { saves, kernel } = k2;
    const exported = exportGame(saves);
    expect(exported.ok).toBe(true);
    const before = JSON.stringify(kernel.store.state);
    const bad = importGame(saves, 'this is not json{{{');
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain('CORRUPT_JSON');
    expect(JSON.stringify(kernel.store.state)).toBe(before);
    const again = importGame(saves, exported.value?.text as string);
    expect(again.ok).toBe(true);
  });

  it('delete removes the slot and names unknown slots', () => {
    const k2 = bootStaleKernel();
    const { saves } = k2;
    saveGame(saves, 'temp');
    const ref: SlotRef = { kind: 'manual', name: 'temp' };
    expect(deleteGame(saves, ref).ok).toBe(true);
    expect(deleteGame(saves, ref).message).toContain('SLOT_NOT_FOUND');
  });

  it('stale import opens confirm; confirming loads with the save intact otherwise', () => {
    const k2 = bootStaleKernel();
    const { saves, advance } = k2;
    saveGame(saves, 'first');
    const exported = exportGame(saves);
    expect(exported.ok).toBe(true);
    advance('2026-02-01T00:00:00.000Z');
    saveGame(saves, 'second');
    const stale = importGame(saves, exported.value?.text as string);
    expect(stale.ok).toBe(false);
    expect(stale.needsConfirm).toBe(true);
    const confirmed = confirmImportGame(saves, exported.value?.text as string);
    expect(confirmed.ok).toBe(true);
  });
});
