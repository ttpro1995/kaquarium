// integration.test.ts — U6 key-boundary integration (Step 12).
// buy -> sell -> saturation -> order fulfil -> level-up end-to-end on the
// real kernel, plus catch-up away-summary counts.
import { describe, expect, it } from 'vitest';
import {
  createKernel,
  type Fish,
  type Species,
} from '@aquarium/u1-sim-foundation';
import { register as registerCommerce } from '../src/index.js';
import { demandFor } from '../src/market.js';

function guppy(extra: Record<string, unknown> = {}): Species {
  const base: Species = {
    id: 'guppy',
    name: { en: 'Guppy' },
    archetype: 'livebearer',
    tier: 1,
    care: 3,
    buyPrice: 10,
    sellBase: 40,
    adultSizeCm: 5,
    lifespanDays: 365,
    maturityDays: 90,
    juvenileDays: 30,
    diet: { type: 'flake', firstFoodRequired: false },
    genes: {},
    palette: {},
    pattern: 'solid',
    fin: 'fan',
    schooling: 0.5,
    territorial: 0.2,
    layer: 'middle',
    tempRangeC: [24, 28],
  };
  return Object.assign(base, extra);
}

function setup() {
  const species = guppy();
  const kernel = createKernel(31, {
    speciesFiles: [{ file: 'guppy.json', data: species }],
  });
  registerCommerce(kernel.registry);
  return { kernel, species };
}

describe('buy -> sell -> saturation -> fulfil -> level-up', () => {
  it('walks the full commerce loop on the real kernel', () => {
    const { kernel } = setup();
    const bought: string[] = [];
    for (let i = 0; i < 3; i++) {
      const outcome = kernel.dispatch('commerce.buyFish', { speciesId: 'guppy' });
      expect(outcome.ok).toBe(true);
      if (outcome.ok) bought.push(outcome.value.fishId);
    }
    expect(kernel.store.state.money).toBe(70);
    // Grow the bought juveniles into sellable adults without waiting 90 days.
    for (const id of bought) {
      const fish = kernel.store.state.fish[id] as Fish;
      fish.stage = 'adult';
      fish.mature = true;
      fish.sizeCm = 5;
      fish.ageDays = 100;
    }
    const demandBefore = demandFor(kernel.store.state, 'guppy');
    const sale = kernel.dispatch('commerce.sellFish', { fishId: bought[0] as string });
    expect(sale.ok).toBe(true);
    expect(demandFor(kernel.store.state, 'guppy')).toBeLessThan(demandBefore);
    // A cheaper second sale after saturation still pays at least the floor.
    const second = kernel.dispatch('commerce.sellFish', { fishId: bought[1] as string });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.price).toBeGreaterThanOrEqual(1);
    // The remaining fish fulfils a board order for the premium + XP.
    kernel.store.state.orders.push({
      id: 'board-1',
      speciesId: 'guppy',
      customer: 'hobbyist',
      quantity: 1,
      minHealth: 40,
      minSizeCm: 0.1,
      multiplier: 1.2,
      reward: 1,
      deadlineDay: kernel.store.state.clock.gameDay + 5,
      status: 'open',
    });
    const fulfil = kernel.dispatch('orders.fulfil', { orderId: 'board-1', fishIds: [bought[2] as string] });
    expect(fulfil.ok).toBe(true);
    if (!fulfil.ok) return;
    expect(fulfil.value.reward).toBeGreaterThanOrEqual(second.value.price);
    expect(kernel.store.state.reputation).toBe(1);
    expect(kernel.store.state.progression.xp).toBeGreaterThan(0);
    expect(kernel.store.state.progression.level).toBeGreaterThanOrEqual(1);
  });

  it('catch-up emits one away summary counting the elapsed days', () => {
    const { kernel } = setup();
    const summary = kernel.catchUp(48);
    expect(summary.elapsedDays).toBe(2);
    const away = kernel.store.state.notifications.filter((n) => n.kind === 'whileAway');
    expect(away).toHaveLength(1);
  });
});
