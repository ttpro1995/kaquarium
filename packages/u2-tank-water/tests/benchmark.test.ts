// benchmark.test.ts — NFR1.1 water-phase probe (informational in CI).
// Protocol: 100-fish save + active cohorts, 50 warmup ticks, p95 of 300
// timed water-phase ticks <= 1.0 ms; heap growth < 64 KB over 100 ticks.
// Any exceedance opens a tracked perf-regression follow-up (never blocks).
import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  createRng,
  MemoryCatalog,
  type Species,
} from '@aquarium/u1-sim-foundation';
import { runWaterTick } from '../src/water.js';

function benchSpecies(): Species {
  return {
    id: 'trop', name: { en: 'T' }, archetype: 'livebearer', tier: 1, care: 1,
    buyPrice: 10, sellBase: 8, adultSizeCm: 5, lifespanDays: 365, maturityDays: 90,
    juvenileDays: 30, diet: { type: 'flake', firstFoodRequired: false }, genes: {},
    palette: {}, pattern: 's', fin: 'f', schooling: 0.5, territorial: 0.2,
    layer: 'middle', tempRangeC: [24, 28],
  };
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] as number;
}

describe('water-phase benchmark probe (NFR1.1)', () => {
  it('p95 of 300 water ticks <= 1.0 ms at 100 fish + active cohorts', () => {
    const state = createInitialState(42);
    state.tank.equipment.heater.installed = true;
    state.tank.biofilterMaturity = 0.7;
    for (let i = 0; i < 100; i++) {
      state.fish[`f${i}`] = {
        id: `f${i}`, speciesId: 'trop', tankId: 'tank-1',
        sex: i % 2 === 0 ? 'male' : 'female', stage: 'adult',
        ageDays: 100 + i, sizeCm: 4 + (i % 3), health: 80, satiety: 20 + (i % 80),
        stress: 0, genome: {}, stunted: false, value: 10, mature: true,
      };
    }
    state.cohorts.c1 = {
      id: 'c1', speciesId: 'trop', tankId: 'tank-1', bornDay: 1, count: 60,
      ageDays: 2, genomePool: {}, survivalFactor: 1, stage: 'fry',
      firstFoodDays: 1, lastFryFedDay: 3,
    };
    const species = new MemoryCatalog([benchSpecies()]);
    const ctxOf = (tick: number) => ({
      state,
      tick,
      now: { day: 1, hour: 0 },
      rng: createRng(state.rngState),
      species,
      events: [] as never[],
      catchUp: false,
    });
    for (let tick = 0; tick < 50; tick++) runWaterTick(ctxOf(tick));
    const samples: number[] = [];
    for (let tick = 0; tick < 300; tick++) {
      const start = performance.now();
      runWaterTick(ctxOf(50 + tick));
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const p95 = percentile(samples, 95);
    console.log(`[bench] water-phase 100-fish p95: ${p95.toFixed(4)} ms`);
    expect(p95).toBeLessThanOrEqual(1.0);
  });

  it('heap growth < 64 KB over 100 consecutive water ticks', () => {
    const state = createInitialState(42);
    for (let i = 0; i < 100; i++) {
      state.fish[`f${i}`] = {
        id: `f${i}`, speciesId: 'trop', tankId: 'tank-1', sex: 'male', stage: 'adult',
        ageDays: 100, sizeCm: 5, health: 80, satiety: 80, stress: 0, genome: {},
        stunted: false, value: 10, mature: true,
      };
    }
    const species = new MemoryCatalog([benchSpecies()]);
    // One reused context mirrors the kernel's per-tick buffer discipline:
    // the drain clears the buffer, so the probe clears it each tick too.
    const ctx = {
      state,
      tick: 0,
      now: { day: 1, hour: 0 },
      rng: createRng(state.rngState),
      species,
      events: [] as never[],
      catchUp: false,
    };
    const run = () => {
      ctx.tick += 1;
      ctx.events.length = 0;
      runWaterTick(ctx);
    };
    for (let tick = 0; tick < 200; tick++) run();
    // Forced scavenges make this a retained-growth check: transient float
    // garbage is collected before each reading, so only true per-tick
    // retention (leaked events, growing queues) can fail the bound.
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
    console.log(
      `[bench] water-phase heap growth/100 ticks (median of 3): ${(median / 1024).toFixed(2)} KB`,
    );
    expect(median).toBeLessThan(64 * 1024);
  });
});
