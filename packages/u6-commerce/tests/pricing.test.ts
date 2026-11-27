// pricing.test.ts — U6 data-model Red phase (FR6–FR8; BR16–BR18).
// Eight-factor formula bands, demand/trend dynamics, board generation,
// XP sources/thresholds, midnight electricity clamp. Fails until Green.
import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  createRng,
  MemoryCatalog,
  type Fish,
  type Species,
} from '@aquarium/u1-sim-foundation';
import {
  SELL_HEALTH_GATE,
  ageFactor,
  colourFactor,
  formulaPrice,
  geneticsFactor,
  healthFactor,
  isSellableHealth,
  marketFactor,
  priceForFish,
  rarityFactor,
  sizeFactor,
} from '../src/pricing.js';
import {
  applySaleSaturation,
  demandFor,
  ensureMarketEntry,
  maybeRollTrends,
  recoverDemand,
} from '../src/market.js';
import {
  CUSTOMER_PARAMS,
  estimateReward,
  fulfilReward,
  generateOrder,
} from '../src/orders.js';
import {
  HATCH_XP,
  LEVEL_XP,
  UNLOCKS,
  xpForReward,
  xpForSale,
} from '../src/progression.js';
import { ELECTRICITY_COST, applyMidnightCosts, fastPriceForFish, runCommerceTick } from '../src/commerce.js';

function guppy(extra: Record<string, unknown> = {}): Species {
  const base: Species = {
    id: 'guppy',
    name: { en: 'Guppy' },
    archetype: 'livebearer',
    tier: 1,
    care: 3,
    buyPrice: 10,
    sellBase: 8,
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

function adultFish(id: string, overrides: Partial<Fish> = {}): Fish {
  return {
    id,
    speciesId: 'guppy',
    tankId: 'tank-1',
    sex: 'female',
    stage: 'adult',
    ageDays: 100,
    sizeCm: 5,
    health: 90,
    satiety: 100,
    stress: 0,
    genome: {
      hue: [1, 0],
      pattern: [0, 1],
      tail: [1, 1],
      size: [0, 0],
      vigor: [1, 0],
    },
    stunted: false,
    value: 10,
    mature: true,
    ...overrides,
  };
}

describe('BR16.1 eight-factor price bands', () => {
  it('size factor clamps undersized to 0.3 and oversized to 1.2', () => {
    expect(sizeFactor(0.5, 5)).toBeCloseTo(0.3, 10);
    expect(sizeFactor(5, 5)).toBeCloseTo(1, 10);
    expect(sizeFactor(10, 5)).toBeCloseTo(1.2, 10);
  });

  it('age factor is 0.6 juvenile / 1.0 adult / 0.7 senior', () => {
    expect(ageFactor('juvenile')).toBe(0.6);
    expect(ageFactor('adult')).toBe(1.0);
    expect(ageFactor('senior')).toBe(0.7);
  });

  it('colour factor spans 0.8–1.2 from the hue locus', () => {
    expect(colourFactor(0)).toBeCloseTo(0.8, 10);
    expect(colourFactor(1)).toBeCloseTo(1.0, 10);
    expect(colourFactor(2)).toBeCloseTo(1.2, 10);
  });

  it('rarity factor lifts 0.1 per premium allele; genetics 0.8 + 0.2 quality', () => {
    expect(rarityFactor(0)).toBeCloseTo(1.0, 10);
    expect(rarityFactor(4)).toBeCloseTo(1.4, 10);
    expect(geneticsFactor(0)).toBeCloseTo(0.8, 10);
    expect(geneticsFactor(1)).toBeCloseTo(1.0, 10);
  });

  it('health factor is 1.0 at >= 70 and 0.7 below; gate at 40', () => {
    expect(healthFactor(100)).toBe(1.0);
    expect(healthFactor(70)).toBe(1.0);
    expect(healthFactor(69)).toBe(0.7);
    expect(healthFactor(40)).toBe(0.7);
    expect(SELL_HEALTH_GATE).toBe(40);
    expect(isSellableHealth(40)).toBe(true);
    expect(isSellableHealth(39)).toBe(false);
  });

  it('market factor clamps to 0.4–1.5', () => {
    expect(marketFactor(1, 0)).toBeCloseTo(1.5, 10);
    expect(marketFactor(0, -1)).toBeCloseTo(0.4, 10);
    expect(marketFactor(0.5, 1)).toBeCloseTo(0.4 + 0.55 + 0.1, 10);
  });

  it('formula floors the product and never prices below 1', () => {
    expect(formulaPrice(8, [1, 1, 1, 1, 1, 1, 1, 1])).toBe(8);
    expect(formulaPrice(8, [0.3, 0.6, 0.8, 1, 0.7, 0.8, 0.4, 0.4])).toBe(1);
    expect(formulaPrice(1, [0.3, 0.6, 0.8, 1, 0.7, 0.8, 0.4, 0.4])).toBe(1);
  });

  it('a healthy adult prices above an identical sick juvenile', () => {
    const healthy = formulaPrice(8, [1, 1.0, 1.0, 1.2, 1.0, 0.9, 1.0, 1.0]);
    const sick = formulaPrice(8, [1, 0.6, 1.0, 1.2, 0.7, 0.9, 1.0, 1.0]);
    expect(healthy).toBeGreaterThan(sick);
    expect(adultFish('x').health).toBeGreaterThanOrEqual(SELL_HEALTH_GATE);
  });

  it('tick-refreshed Fish.value equals the canonical formula', () => {
    const species = guppy();
    const catalog = new MemoryCatalog([species]);
    const state = createInitialState(9);
    const bits: [0 | 1, 0 | 1][] = [
      [0, 0],
      [1, 1],
    ];
    let n = 0;
    for (const hue of bits) {
      for (const stage of ['juvenile', 'adult', 'senior'] as const) {
        for (const health of [20, 69, 100]) {
          const id = `tick-${n++}`;
          state.fish[id] = adultFish(id, {
            stage,
            health,
            sizeCm: stage === 'juvenile' ? 2.5 : 5,
            genome: { hue: [...hue], pattern: [1, 0], tail: [1, 1], size: [0, 0], vigor: [1, 0] },
          });
        }
      }
    }
    state.market.guppy = { speciesId: 'guppy', demand: 0.8, trend: 1, lastTrendDay: 1 };
    runCommerceTick({
      state,
      tick: 1,
      now: { day: 1, hour: 5 },
      rng: createRng(state.rngState),
      species: catalog,
      events: [],
      catchUp: false,
    });
    for (const id in state.fish) {
      const fish = state.fish[id] as Fish;
      expect(fish.value).toBe(priceForFish(fish, species, 0.8, 1));
      // The exported fast path agrees with the canonical formula too
      // (deliberate duplication for the NFR1.1 hot loop — see pricing.ts).
      expect(fastPriceForFish(fish, species, 0.8, 1)).toBe(priceForFish(fish, species, 0.8, 1));
    }
    // Unknown catalogue species: the display cache falls back to 0, never stale.
    state.fish.ghost = adultFish('ghost', { speciesId: 'extinct' });
    runCommerceTick({
      state,
      tick: 2,
      now: { day: 1, hour: 6 },
      rng: createRng(state.rngState),
      species: catalog,
      events: [],
      catchUp: false,
    });
    expect((state.fish.ghost as Fish).value).toBe(0);
  });
});

describe('BR16.4 demand and trend dynamics', () => {
  it('each sale saturates demand by x0.97', () => {
    const state = createInitialState(1);
    ensureMarketEntry(state, 'guppy', 1);
    applySaleSaturation(state, 'guppy');
    expect(demandFor(state, 'guppy')).toBeCloseTo(0.97, 10);
    applySaleSaturation(state, 'guppy');
    expect(demandFor(state, 'guppy')).toBeCloseTo(0.97 * 0.97, 10);
  });

  it('demand recovers 8% of the gap to 1 each day', () => {
    const state = createInitialState(1);
    const entry = ensureMarketEntry(state, 'guppy', 1);
    entry.demand = 0.5;
    recoverDemand(state);
    expect(entry.demand).toBeCloseTo(0.5 + 0.5 * 0.08, 10);
  });

  it('trend re-rolls only on the 3-day cycle', () => {
    const state = createInitialState(7);
    const entry = ensureMarketEntry(state, 'guppy', 1);
    entry.trend = 0;
    maybeRollTrends(state, { next: () => 0.99, nextInt: () => 0, pick: <T>(items: readonly T[]): T => items[0] as T }, 2);
    expect(entry.trend).toBe(0);
    expect(entry.lastTrendDay).toBe(1);
    maybeRollTrends(state, { next: () => 0.99, nextInt: () => 0, pick: <T>(items: readonly T[]): T => items[0] as T }, 4);
    expect(entry.trend).toBe(1);
    expect(entry.lastTrendDay).toBe(4);
  });
});

describe('BR17.1 board generation', () => {
  it('generates a parametrised order inside 3–6 with a 3–7 day deadline', () => {
    const state = createInitialState(3);
    const species = guppy();
    const order = generateOrder(
      state,
      {
        next: () => 0.1,
        nextInt: (min: number) => min,
        pick: <T>(items: readonly T[]): T => items[0] as T,
      },
      10,
      [species],
    );
    expect(order).not.toBeNull();
    const params = CUSTOMER_PARAMS[order?.customer ?? 'hobbyist'];
    expect(order?.quantity).toBeGreaterThanOrEqual(params.qty[0]);
    expect(order?.quantity).toBeLessThanOrEqual(params.qty[1]);
    expect(order?.minHealth).toBe(params.minHealth);
    expect(order?.multiplier).toBe(params.multiplier);
    expect(order?.minSizeCm).toBe(species.adultSizeCm);
    expect(order?.deadlineDay).toBeGreaterThanOrEqual(13);
    expect(order?.deadlineDay).toBeLessThanOrEqual(17);
    expect(order?.reward).toBe(estimateReward(species.sellBase, order?.quantity ?? 0, order?.multiplier ?? 1));
    expect(order?.status).toBe('open');
  });
});

describe('BR18.1 XP sources and thresholds', () => {
  it('sale XP is floor(price/5), hatch is +10, fulfil is floor(reward/4)', () => {
    expect(xpForSale(23)).toBe(4);
    expect(HATCH_XP).toBe(10);
    expect(xpForReward(40)).toBe(10);
  });

  it('thresholds are L2 200 and L3 600', () => {
    expect(LEVEL_XP[2]).toBe(200);
    expect(LEVEL_XP[3]).toBe(600);
    expect(UNLOCKS[2]).toContain('tier.2');
    expect(UNLOCKS[3]).toContain('tier.3');
  });
});

describe('BR19.1 midnight electricity', () => {
  it('tier costs are 5/12/25 and clamp at zero', () => {
    expect(ELECTRICITY_COST[1]).toBe(5);
    expect(ELECTRICITY_COST[2]).toBe(12);
    expect(ELECTRICITY_COST[3]).toBe(25);
    const state = createInitialState(1, { money: 3 });
    const deducted = applyMidnightCosts(state);
    expect(deducted).toBe(3);
    expect(state.money).toBe(0);
    // Midnight deductions emit moneyChanged so the C4 money trail stays complete.
    const charged = createInitialState(1, { money: 100 });
    charged.tank.tier = 2;
    const ledger: { kind: string; [k: string]: unknown }[] = [];
    expect(applyMidnightCosts(charged, ledger)).toBe(12);
    expect(charged.money).toBe(88);
    expect(ledger).toEqual([{ kind: 'moneyChanged', delta: -12, balance: 88 }]);
  });

  it('fulfil reward carries the rep bonus and floors', () => {
    expect(fulfilReward(100, 1.2, 0)).toBe(120);
    expect(fulfilReward(100, 1.2, 10)).toBe(144);
    expect(fulfilReward(100, 1.2, 99)).toBe(144);
  });
});
