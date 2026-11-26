// benchmark.test.ts — NFR1.1 breeding-phase probe.
// Protocol: 50-pair/10-cohort fixture, 50 warmup ticks, p95 of 300 timed
// breeding-phase ticks <= 0.125 ms; heap growth < 64 KB over 100 ticks.
// Any exceedance opens a tracked perf-regression follow-up (never blocks).
import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  createRng,
  MemoryCatalog,
  type Species,
  type TickContext,
} from '@aquarium/u1-sim-foundation';
import { runBreedingTick } from '../src/breeding.js';

function benchSpecies(): Species {
  const base: Species = {
    id: 'guppy', name: { en: 'G' }, archetype: 'livebearer', tier: 1, care: 1,
    buyPrice: 10, sellBase: 8, adultSizeCm: 5, lifespanDays: 365, maturityDays: 90,
    juvenileDays: 30, diet: { type: 'flake', firstFoodRequired: false }, genes: {},
    palette: {}, pattern: 's', fin: 'f', schooling: 0.5, territorial: 0.2,
    layer: 'middle', tempRangeC: [24, 28],
  };
  // Small broods melt back fast, so the concurrent-cohort load stays near
  // the seeded 10 while births still exercise the full spawn path.
  return Object.assign(base, { clutch: [4, 6] });
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
  const species = benchSpecies();
  const state = createInitialState(42);
  for (let i = 0; i < 50; i++) {
    const female = `f${i}`;
    const male = `m${i}`;
    state.fish[female] = {
      id: female, speciesId: 'guppy', tankId: 'tank-1', sex: 'female', stage: 'adult',
      ageDays: 100, sizeCm: 5, health: 90, satiety: 80, stress: 0, genome: { ...GENOME },
      stunted: false, value: 10, mature: true,
    };
    state.fish[male] = {
      id: male, speciesId: 'guppy', tankId: 'tank-1', sex: 'male', stage: 'adult',
      ageDays: 100, sizeCm: 5, health: 90, satiety: 80, stress: 0, genome: { ...GENOME },
      stunted: false, value: 10, mature: true,
    };
    state.pairs[`p${i}`] = {
      id: `p${i}`, femaleId: female, maleId: male, speciesId: 'guppy',
      // A working tank's mix: half the bonds attempting, half resting with
      // staggered cooldowns, so promotions fire throughout the probe.
      state: i % 2 === 0 ? 'paired' : 'cooling', readyDay: 1 + (i % 7),
    };
  }
  for (let i = 0; i < 10; i++) {
    state.cohorts[`c${i}`] = {
      id: `c${i}`, speciesId: 'guppy', tankId: 'tank-1', bornDay: 1, count: 20,
      ageDays: i, genomePool: {}, survivalFactor: 1, stage: 'fry',
      firstFoodDays: i, lastFryFedDay: 1,
    };
  }
  return { state, catalog: new MemoryCatalog([species]) };
}

describe('breeding-phase benchmark probe (NFR1.1)', () => {
  it('p95 of 300 breeding ticks <= 0.125 ms at 50 pairs / 10 cohorts', () => {
    const { state, catalog } = seedFixture();
    // An advancing clock exercises every path: attempts, gestation and
    // hatch transitions, and the midnight decay. Steady state stays
    // bounded (broods melt back within a few dozen ticks). One reused
    // context mirrors the kernel's per-tick buffer discipline: the drain
    // clears the buffer, so the probe clears it each tick too.
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
      runBreedingTick(ctx);
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
    console.log(`[bench] breeding-phase 50-pair/10-cohort p95: ${p95.toFixed(4)} ms`);
    expect(p95).toBeLessThanOrEqual(0.125);
  });

  it('heap growth < 64 KB over 100 consecutive breeding ticks', () => {
    const { state, catalog } = seedFixture();
    // One reused context mirrors the kernel's per-tick buffer discipline:
    // the drain clears the buffer, so the probe clears it each tick too.
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
      runBreedingTick(ctx);
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
      `[bench] breeding-phase heap growth/100 ticks (median of 3): ${(median / 1024).toFixed(2)} KB`,
    );
    expect(median).toBeLessThan(64 * 1024);
  });
});
