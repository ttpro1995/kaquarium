// benchmark.test.ts — NFR1.1 feeding-phase probe (informational in CI).
// Protocol: 50 warmup ticks, p95 of 300 timed feeding-phase ticks <=
// 0.25 ms on both a 4-stack and a 24-stack (MAX_FOOD_STACKS) fixture;
// heap growth < 64 KB over 100 ticks (informational). Any exceedance
// opens a tracked perf-regression follow-up (never blocks).
import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  createRng,
  MemoryCatalog,
  type Fish,
  type GameState,
  type SimEvent,
  type Species,
} from '@aquarium/u1-sim-foundation';
import { runFeedingTick } from '../src/feeding.js';

function benchSpecies(): Species {
  return {
    id: 'guppy', name: { en: 'G' }, archetype: 'livebearer', tier: 1, care: 1,
    buyPrice: 10, sellBase: 8, adultSizeCm: 5, lifespanDays: 365, maturityDays: 90,
    juvenileDays: 30, diet: { type: 'flake', firstFoodRequired: false }, genes: {},
    palette: {}, pattern: 's', fin: 'f', schooling: 0.5, territorial: 0.2,
    layer: 'middle', tempRangeC: [24, 28],
  };
}

function fixture(stackCount: number, fishCount: number): GameState {
  const state = createInitialState(42);
  for (let i = 0; i < stackCount; i++) {
    const kind = i % 3 === 2 ? 'liveFirst' : 'flakes';
    state.food[`food-${i}`] = {
      id: `food-${i}`,
      kind,
      qty: 10,
      quality: kind === 'liveFirst' ? 1.0 : 0.7,
      shelfLifeDays: kind === 'liveFirst' ? 7 : 0,
      acquiredDay: 1 + (i % 3),
      target: kind === 'liveFirst' ? 'fry' : 'fish',
    };
  }
  for (let i = 0; i < fishCount; i++) {
    state.fish[`f${i}`] = {
      id: `f${i}`, speciesId: 'guppy', tankId: 'tank-1',
      sex: i % 2 === 0 ? 'male' : 'female', stage: 'adult',
      ageDays: 100 + i, sizeCm: 4 + (i % 3), health: 90,
      satiety: 20 + (i % 80), stress: 0, genome: {},
      stunted: false, value: 10, mature: true,
    } satisfies Fish;
  }
  state.tank.equipment.autoFeeder.installed = true;
  state.feeding.schedule = { foodKind: 'flakes', portions: 2, intervalHours: 6, lastRunHour: 0 };
  return state;
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] as number;
}

function probe(label: string, stackCount: number, fishCount: number): void {
  const state = fixture(stackCount, fishCount);
  const species = new MemoryCatalog([benchSpecies()]);
  let hour = 8;
  const ctxOf = (tick: number) => ({
    state,
    tick,
    now: { day: state.clock.gameDay, hour },
    rng: createRng(state.rngState),
    species,
    events: [] as SimEvent[],
    catchUp: false,
  });
  for (let tick = 0; tick < 50; tick++) {
    hour = (hour + 1) % 24;
    runFeedingTick(ctxOf(tick));
  }
  const samples: number[] = [];
  for (let tick = 0; tick < 300; tick++) {
    hour = (hour + 1) % 24;
    const start = performance.now();
    runFeedingTick(ctxOf(50 + tick));
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const p95 = percentile(samples, 95);
  console.log(`[bench] feeding-phase ${label} p95: ${p95.toFixed(4)} ms`);
  expect(p95).toBeLessThanOrEqual(0.25);
}

describe('feeding-phase benchmark probe (NFR1.1)', () => {
  it('p95 of 300 feeding ticks <= 0.25 ms at 4 stacks + 20 fish', () => {
    probe('4-stack', 4, 20);
  });

  it('p95 of 300 feeding ticks <= 0.25 ms at 24 stacks + 100 fish', () => {
    probe('24-stack', 24, 100);
  });

  it('heap growth < 64 KB over 100 consecutive feeding ticks', () => {
    const state = fixture(24, 100);
    const species = new MemoryCatalog([benchSpecies()]);
    let hour = 8;
    // One reused context mirrors the kernel's per-tick buffer discipline:
    // the drain clears the buffer, so the probe clears it each tick too.
    const ctx = {
      state,
      tick: 0,
      now: { day: 1, hour },
      rng: createRng(state.rngState),
      species,
      events: [] as SimEvent[],
      catchUp: false,
    };
    const run = () => {
      ctx.tick += 1;
      hour = (hour + 1) % 24;
      ctx.now = { day: 1, hour };
      ctx.events.length = 0;
      runFeedingTick(ctx);
    };
    for (let tick = 0; tick < 200; tick++) run();
    // Forced scavenges make this a retained-growth check: transient
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
      `[bench] feeding-phase heap growth/100 ticks (median of 3): ${(median / 1024).toFixed(2)} KB`,
    );
    expect(median).toBeLessThan(64 * 1024);
  });
});
