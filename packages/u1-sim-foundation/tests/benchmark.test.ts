import { describe, expect, it } from 'vitest';
import { createKernel, type Kernel } from '../src/kernel.js';
import { fishInTank } from '../src/selectors.js';
import type { System } from '../src/registry.js';
import type { TickContext } from '../src/registry.js';
import type { Fish } from '../src/types.js';

function makeFish(id: string, i: number): Fish {
  return {
    id,
    speciesId: 'guppy',
    tankId: 'tank-1',
    sex: i % 2 === 0 ? 'male' : 'female',
    stage: 'adult',
    ageDays: 100 + i,
    sizeCm: 4,
    health: 80,
    satiety: 70,
    stress: 10,
    genome: {},
    value: 12,
    mature: true,
  };
}

/** Representative per-fish work: membership scan + seeded draws, like U2–U6 systems. */
function loadSystem(id: string): System {
  return {
    id,
    phase: 'fish',
    run: (ctx: TickContext) => {
      const residents = fishInTank(ctx.state, ctx.state.tank.id);
      for (const fish of residents) {
        fish.health = Math.min(100, fish.health + (ctx.rng.next() > 0.5 ? 1 : -1));
      }
    },
  } as unknown as System;
}

function kernelWithFish(n: number): Kernel {
  const kernel = createKernel(99);
  for (let i = 0; i < n; i++) {
    kernel.store.state.fish[`f${i}`] = makeFish(`f${i}`, i);
  }
  kernel.registry.registerSystem(loadSystem('u.bench.fish'));
  return kernel;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] as number;
}

/** NFR1.1 protocol: 50 warmup ticks, then 300 timed headless ticks. */
function timeTicks(kernel: Kernel, timed: number, warmup: number): number[] {
  for (let i = 0; i < warmup; i++) kernel.tick();
  const samples: number[] = [];
  for (let i = 0; i < timed; i++) {
    const start = performance.now();
    kernel.tick();
    samples.push(performance.now() - start);
  }
  return samples.sort((a, b) => a - b);
}

describe('benchmark harness (test-only, informational in CI)', () => {
  it('100-fish tick probe reports p95 (NFR1.1 protocol)', () => {
    const kernel = kernelWithFish(100);
    const samples = timeTicks(kernel, 300, 50);
    const p50 = percentile(samples, 50);
    const p95 = percentile(samples, 95);
    console.info(`[bench] 100-fish tick: p50=${p50.toFixed(3)}ms p95=${p95.toFixed(3)}ms (device gate: p95 <= 8ms)`);
    expect(samples.length).toBe(300);
  });

  it('scaling curve 1/10/50/100 stays near-linear (NFR1.3 protocol)', () => {
    const sizes = [1, 10, 50, 100];
    const means = sizes.map((n) => {
      const samples = timeTicks(kernelWithFish(n), 100, 20);
      return samples.reduce((a, b) => a + b, 0) / samples.length;
    });
    const n = sizes.length;
    const meanX = sizes.reduce((a, b) => a + b, 0) / n;
    const meanY = means.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (let i = 0; i < n; i++) {
      num += ((sizes[i] as number) - meanX) * ((means[i] as number) - meanY);
      denX += ((sizes[i] as number) - meanX) ** 2;
      denY += ((means[i] as number) - meanY) ** 2;
    }
    const rSquared = denX > 0 && denY > 0 ? (num * num) / (denX * denY) : 1;
    console.info(
      `[bench] scaling curve: ${sizes.map((s, i) => `${s}=${(means[i] as number).toFixed(3)}ms`).join(' ')} R²=${rSquared.toFixed(3)} (device gate: R² >= 0.90, 100-fish <= 8ms)`,
    );
    expect(means.length).toBe(4);
  });

  it('autosave latency probe for a 100-fish save (NFR1.4 protocol)', () => {
    const kernel = kernelWithFish(100);
    kernel.tick();
    const start = performance.now();
    const outcome = kernel.saves.autosave();
    const elapsed = performance.now() - start;
    console.info(`[bench] autosave 100-fish: ${elapsed.toFixed(3)}ms (device gate: <= 50ms)`);
    expect(outcome.ok).toBe(true);
    expect(elapsed).toBeLessThan(5000);
  });
});
