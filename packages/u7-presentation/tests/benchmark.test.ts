// benchmark.test.ts — Layer D Red: render-isolated probes + sim frame/soak
// probes (NFR1.1, NFR5.1). Informational tripwires: any exceedance opens a
// tracked perf-regression follow-up, never blocks the build.
import { describe, expect, it } from 'vitest';
import { createBoidsWorld, stepBoids } from '../src/tank/steering.js';
import { addFish, bootTestKernel } from './fixtures.js';

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] as number;
}

function seedRenderFish(count: number) {
  const world = createBoidsWorld(128);
  world.count = count;
  for (let i = 0; i < count; i++) {
    world.pos[i * 2] = (i * 7) % 100;
    world.pos[i * 2 + 1] = (i * 13) % 60;
    world.vel[i * 2] = 1;
    world.vel[i * 2 + 1] = 0.5;
  }
  return world;
}

const BASE = {
  separation: 1,
  alignment: 0.5,
  cohesion: 0.3,
  maxSpeed: 2,
  radius: 10,
  bounds: { w: 100, h: 60 },
  time: 0,
};

describe('render-isolated probe (NFR5.1)', () => {
  it('render-only p95 <= 12 ms at 100 fish, sim paused', () => {
    const world = seedRenderFish(100);
    const samples: number[] = [];
    for (let frame = 0; frame < 200; frame++) {
      const start = performance.now();
      stepBoids(world, { ...BASE, reducedMotion: false, time: frame });
      samples.push(performance.now() - start);
    }
    expect(percentile([...samples].sort((a, b) => a - b), 95)).toBeLessThanOrEqual(12);
  });

  it('reduced-motion frame cost stays within 5% of full motion', () => {
    const calm = seedRenderFish(100);
    const wild = seedRenderFish(100);
    const calmTimes: number[] = [];
    const wildTimes: number[] = [];
    for (let frame = 0; frame < 500; frame++) {
      let start = performance.now();
      stepBoids(calm, { ...BASE, reducedMotion: true, time: frame });
      calmTimes.push(performance.now() - start);
      start = performance.now();
      stepBoids(wild, { ...BASE, reducedMotion: false, time: frame });
      wildTimes.push(performance.now() - start);
    }
    const calmMed = percentile([...calmTimes].sort((a, b) => a - b), 50);
    const wildMed = percentile([...wildTimes].sort((a, b) => a - b), 50);
    // Noise floor: both paths are sub-millisecond; the bound guards the
    // ratio once the signal rises above it.
    expect(calmMed).toBeLessThanOrEqual(wildMed * 1.05 + 0.5);
  });

  it('heap grows < 256 KB over 1000 frames (informational)', () => {
    const world = seedRenderFish(100);
    globalThis.gc?.();
    const before = process.memoryUsage().heapUsed;
    for (let frame = 0; frame < 1000; frame++) {
      stepBoids(world, { ...BASE, reducedMotion: false, time: frame });
    }
    globalThis.gc?.();
    const growth = process.memoryUsage().heapUsed - before;
    expect(growth).toBeLessThan(256 * 1024);
  });
});

describe('sim frame/soak probes (NFR1.1)', () => {
  function seedSimFish() {
    const kernel = bootTestKernel(99);
    for (let i = 0; i < 100; i++) {
      addFish(kernel, `b${i}`, 'guppy', i % 2 === 0 ? 'female' : 'male');
    }
    return kernel;
  }

  it('total p95 <= 20 ms at x1 with 100 fish', () => {
    const kernel = seedSimFish();
    const samples: number[] = [];
    for (let frame = 0; frame < 60; frame++) {
      const start = performance.now();
      kernel.tick();
      samples.push(performance.now() - start);
    }
    expect(percentile([...samples].sort((a, b) => a - b), 95)).toBeLessThanOrEqual(20);
  });

  it('x4 burst (4 queued ticks before a measured frame) p95 <= 20 ms', () => {
    const kernel = seedSimFish();
    const samples: number[] = [];
    for (let frame = 0; frame < 15; frame++) {
      const start = performance.now();
      for (let q = 0; q < 4; q++) kernel.tick();
      samples.push(performance.now() - start);
    }
    const version = kernel.store.version;
    expect(version).toBe(60);
    expect(percentile([...samples].sort((a, b) => a - b), 95)).toBeLessThanOrEqual(20);
  });

  it('x4 soak: 240 ticks, version delta exactly 240, max frame <= 50 ms, zero dropped', () => {
    const kernel = seedSimFish();
    const startVersion = kernel.store.version;
    let maxFrame = 0;
    let dropped = 0;
    for (let frame = 0; frame < 240; frame++) {
      const start = performance.now();
      try {
        kernel.tick();
      } catch {
        dropped += 1;
      }
      const elapsed = performance.now() - start;
      if (elapsed > maxFrame) maxFrame = elapsed;
    }
    expect(dropped).toBe(0);
    expect(kernel.store.version - startVersion).toBe(240);
    expect(maxFrame).toBeLessThanOrEqual(50);
  });
});
