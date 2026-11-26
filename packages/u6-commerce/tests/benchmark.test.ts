// benchmark.test.ts — NFR1.1 commerce+notify probe (Step 12).
// Protocol: full board + 100-notification queue fixture, 50 warmup ticks,
// p95 of 300 timed commerce+notify ticks <= 0.125 ms; heap growth < 64 KB
// over 100 ticks. Any exceedance opens a tracked perf-regression
// follow-up (never blocks).
import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  createRng,
  MemoryCatalog,
  type Species,
  type TickContext,
} from '@aquarium/u1-sim-foundation';
import { runCommerceTick, runNotifyTick } from '../src/commerce.js';

function benchSpecies(id: string, tier: 1 | 2 | 3): Species {
  return {
    id,
    name: { en: id },
    archetype: 'livebearer',
    tier,
    care: 1,
    buyPrice: 10,
    sellBase: 8,
    adultSizeCm: 5,
    lifespanDays: 365,
    maturityDays: 90,
    juvenileDays: 30,
    diet: { type: 'flake', firstFoodRequired: false },
    genes: {},
    palette: {},
    pattern: 's',
    fin: 'f',
    schooling: 0.5,
    territorial: 0.2,
    layer: 'middle',
    tempRangeC: [24, 28],
  };
}

const GENOME = {
  hue: [1, 0],
  pattern: [0, 1],
  tail: [1, 1],
  size: [0, 0],
  vigor: [1, 0],
};

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] as number;
}

function seedFixture() {
  const speciesList = [benchSpecies('guppy', 1), benchSpecies('molly', 1), benchSpecies('oscar', 2)];
  const state = createInitialState(42);
  for (let i = 0; i < 40; i++) {
    const id = `f${i}`;
    state.fish[id] = {
      id,
      speciesId: i % 2 === 0 ? 'guppy' : 'molly',
      tankId: 'tank-1',
      sex: i % 2 === 0 ? 'female' : 'male',
      stage: 'adult',
      ageDays: 100,
      sizeCm: 5,
      health: 90,
      satiety: 80,
      stress: 0,
      genome: { ...GENOME },
      stunted: false,
      value: 10,
      mature: true,
    };
  }
  for (const [i, s] of speciesList.entries()) {
    state.market[s.id] = { speciesId: s.id, demand: 0.8, trend: (i % 3) - 1, lastTrendDay: 1 };
  }
  for (let i = 0; i < 6; i++) {
    state.orders.push({
      id: `o${i}`,
      speciesId: 'guppy',
      customer: 'hobbyist',
      quantity: 1,
      minHealth: 40,
      minSizeCm: 5,
      multiplier: 1.2,
      reward: 9,
      deadlineDay: 9,
      status: 'open',
    });
  }
  for (let i = 0; i < 100; i++) {
    state.notifications.push({ id: `n${i}`, priority: 'info', kind: 'k', message: `${i}` });
  }
  return { state, catalog: new MemoryCatalog(speciesList) };
}

describe('commerce+notify benchmark probe (NFR1.1)', () => {
  it('p95 of 300 commerce+notify ticks <= 0.125 ms at full board / 100-notification queue', () => {
    const { state, catalog } = seedFixture();
    const ctx: TickContext = {
      state,
      tick: 0,
      now: { day: 1, hour: 0 },
      rng: createRng(state.rngState),
      species: catalog,
      events: [],
      catchUp: false,
    };
    const run = () => {
      ctx.tick += 1;
      ctx.now.day = 1 + Math.floor(ctx.tick / 24);
      ctx.now.hour = ctx.tick % 24;
      ctx.events.length = 0;
      runCommerceTick(ctx);
      runNotifyTick(ctx);
      ctx.events.length = 0;
    };
    for (let tick = 0; tick < 50; tick++) run();
    const samples: number[] = [];
    for (let tick = 0; tick < 300; tick++) {
      const start = performance.now();
      run();
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const p95 = percentile(samples, 95);
    console.log(`[bench] commerce+notify full-board p95: ${p95.toFixed(4)} ms`);
    expect(p95).toBeLessThanOrEqual(0.125);
  });

  it('heap growth < 64 KB over 100 consecutive commerce+notify ticks', () => {
    const { state, catalog } = seedFixture();
    const ctx: TickContext = {
      state,
      tick: 0,
      now: { day: 1, hour: 0 },
      rng: createRng(state.rngState),
      species: catalog,
      events: [],
      catchUp: false,
    };
    const run = () => {
      ctx.tick += 1;
      ctx.events.length = 0;
      runCommerceTick(ctx);
      runNotifyTick(ctx);
    };
    for (let tick = 0; tick < 200; tick++) run();
    const collect = (globalThis as { gc?: () => void }).gc;
    const windows: number[] = [];
    for (let w = 0; w < 3; w++) {
      collect?.();
      const before = process.memoryUsage().heapUsed;
      for (let tick = 0; tick < 100; tick++) run();
      collect?.();
      windows.push(process.memoryUsage().heapUsed - before);
    }
    windows.sort((a, b) => a - b);
    const median = windows[1] as number;
    console.log(`[bench] commerce+notify heap growth/100 ticks (median of 3): ${(median / 1024).toFixed(2)} KB`);
    expect(median).toBeLessThan(64 * 1024);
  });
});
