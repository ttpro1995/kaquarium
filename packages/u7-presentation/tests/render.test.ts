// render.test.ts — Layer B Red: render-side math + panel helpers (W36/W37; BR20).
// Boids steering is render-side only (never touches GameState), allocation
// discipline is pinned by a constructor-count probe, and lighting/sprites/
// helpers are pure. Written before the src/tank/* and helpers modules.
import { describe, expect, it } from 'vitest';
import {
  createBoidsWorld,
  stepBoids,
  type BoidsWorld,
} from '../src/tank/steering.js';
import { snappedTint, tintFor } from '../src/tank/lighting.js';
import { spriteFor } from '../src/tank/sprites.js';
import {
  clearSelection,
  formatCountdown,
  formatGameTime,
  formatMoney,
  previewBulkSale,
  previewGrade,
  previewOrderReward,
  selectAll,
  toggleInSet,
} from '../src/panels/helpers.js';
import { createKernel } from '@aquarium/u1-sim-foundation';
import { register as registerWater } from '@aquarium/u2-tank-water';
import { register as registerFish } from '@aquarium/u3-fish';
import { register as registerFeeding } from '@aquarium/u4-feeding';
import { register as registerBreeding } from '@aquarium/u5-breeding';
import { register as registerCommerce } from '@aquarium/u6-commerce';
import { bulkPreview, orderRewardPreview } from '@aquarium/u6-commerce';
import { gradePreview } from '@aquarium/u5-breeding';
import type { Species } from '@aquarium/u1-sim-foundation/state';

function baseParams(world: BoidsWorld, over: Partial<Parameters<typeof stepBoids>[1]> = {}) {
  return {
    separation: 1,
    alignment: 0,
    cohesion: 0,
    maxSpeed: 2,
    radius: 10,
    bounds: { w: 100, h: 60 },
    reducedMotion: false,
    time: 0,
    ...over,
  };
}

function twoFish(): BoidsWorld {
  const world = createBoidsWorld(8);
  world.count = 2;
  world.pos[0] = 10;
  world.pos[1] = 10;
  world.pos[2] = 11;
  world.pos[3] = 10;
  world.vel[0] = 0;
  world.vel[1] = 0;
  world.vel[2] = 0;
  world.vel[3] = 0;
  return world;
}

describe('boids steering (render-side only)', () => {
  it('separation pushes close fish apart along the displacement axis', () => {
    const world = twoFish();
    stepBoids(world, baseParams(world, { separation: 2, reducedMotion: true }));
    expect(world.vel[0]).toBeLessThan(0);
    expect(world.vel[2]).toBeGreaterThan(0);
  });

  it('alignment converges differing velocities without moving positions apart', () => {
    const world = twoFish();
    world.vel[0] = 2;
    world.vel[2] = -2;
    const before = Math.abs(world.vel[0] - world.vel[2]);
    stepBoids(world, baseParams(world, { separation: 0, alignment: 1, reducedMotion: true }));
    const after = Math.abs(world.vel[0] - world.vel[2]);
    expect(after).toBeLessThan(before);
  });

  it('cohesion moves distant fish closer together', () => {
    const world = twoFish();
    world.pos[2] = 18; // distant, but inside the perception radius
    const before = Math.abs(world.pos[2]! - world.pos[0]!);
    for (let i = 0; i < 20; i++) {
      stepBoids(
        world,
        baseParams(world, { separation: 0, alignment: 0, cohesion: 0.5, reducedMotion: true, time: i }),
      );
    }
    const after = Math.abs(world.pos[2]! - world.pos[0]!);
    expect(after).toBeLessThan(before);
  });

  it('allocates zero arrays per frame: no Array/Float32Array construction in the hot loop', () => {
    const world = createBoidsWorld(128);
    world.count = 100;
    for (let i = 0; i < 100; i++) {
      world.pos[i * 2] = (i * 7) % 100;
      world.pos[i * 2 + 1] = (i * 13) % 60;
      world.vel[i * 2] = 1;
      world.vel[i * 2 + 1] = 0.5;
    }
    const params = baseParams(world, { separation: 1, alignment: 0.5, cohesion: 0.3 });
    stepBoids(world, params); // warm-up: one-time scratch sizing lives here, never per frame
    let arrayNews = 0;
    let f32News = 0;
    const RealArray = globalThis.Array;
    const RealF32 = globalThis.Float32Array;
    const CountingArray = function (this: unknown, ...args: unknown[]) {
      arrayNews += 1;
      return Reflect.construct(RealArray, args);
    } as unknown as ArrayConstructor;
    const CountingF32 = function (this: unknown, ...args: unknown[]) {
      f32News += 1;
      return Reflect.construct(RealF32, args as []);
    } as unknown as Float32ArrayConstructor;
    globalThis.Array = CountingArray;
    globalThis.Float32Array = CountingF32;
    try {
      for (let i = 0; i < 50; i++) stepBoids(world, { ...params, time: i });
    } finally {
      globalThis.Array = RealArray;
      globalThis.Float32Array = RealF32;
    }
    expect(arrayNews).toBe(0);
    expect(f32News).toBe(0);
  });

  it('reduced motion damps darting: speeds stay capped, full motion can burst', () => {
    const calm = twoFish();
    calm.count = 1;
    calm.vel[0] = 1.9;
    let calmMax = 0;
    for (let t = 0; t < 40; t++) {
      stepBoids(calm, baseParams(calm, { reducedMotion: true, separation: 0, time: t }));
      calmMax = Math.max(calmMax, Math.hypot(calm.vel[0]!, calm.vel[1]!));
    }
    const wild = twoFish();
    wild.count = 1;
    wild.vel[0] = 1.9;
    let wildMax = 0;
    for (let t = 0; t < 40; t++) {
      stepBoids(wild, baseParams(wild, { reducedMotion: false, separation: 0, time: t }));
      wildMax = Math.max(wildMax, Math.hypot(wild.vel[0]!, wild.vel[1]!));
    }
    expect(calmMax).toBeLessThanOrEqual(2);
    expect(wildMax).toBeGreaterThan(calmMax);
  });
});

describe('lighting tint (W37)', () => {
  it('midday is brighter than midnight', () => {
    const noon = tintFor(1, 12);
    const night = tintFor(1, 0);
    const lum = (t: { r: number; g: number; b: number }) => 0.2126 * t.r + 0.7152 * t.g + 0.0722 * t.b;
    expect(lum(noon)).toBeGreaterThan(lum(night) + 40);
  });

  it('transitions smoothly: adjacent hours differ only slightly', () => {
    // The full day→night channel swing is 569 spread over 12 gradient hours
    // (~95/hour total, ~39/hour per channel): gradual, never a visible pop.
    for (const h of [6, 12, 18]) {
      const a = tintFor(1, h);
      const b = tintFor(1, h + 1);
      expect(Math.abs(a.r - b.r)).toBeLessThan(40);
      expect(Math.abs(a.g - b.g)).toBeLessThan(40);
      expect(Math.abs(a.b - b.b)).toBeLessThan(40);
      const d = Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
      expect(d).toBeLessThan(120);
    }
  });

  it('reduced motion snaps to exactly three tints with no gradient', () => {
    const seen = new Set<string>();
    for (let h = 0; h < 24; h++) {
      const t = snappedTint(h);
      seen.add(`${t.r},${t.g},${t.b},${t.overlay}`);
    }
    expect(seen.size).toBe(3);
  });
});

describe('procedural sprite mapping', () => {
  function species(id: string): Species {
    return {
      id,
      name: { en: id },
      archetype: 'livebearer',
      tier: 1,
      care: 1,
      buyPrice: 10,
      sellBase: 8,
      adultSizeCm: 5,
      lifespanDays: 365,
      maturityDays: 90,
      juvenileDays: 30,
      diet: { type: 'flake', firstFoodRequired: false },
      genes: {},
      palette: { body: 'teal', belly: 'silver' },
      pattern: 'stripes',
      fin: 'veil',
      schooling: 0.5,
      territorial: 0.2,
      layer: 'middle',
      tempRangeC: [24, 28],
    };
  }

  it('maps palette/pattern/fin catalogue tokens through verbatim', () => {
    const token = spriteFor(species('guppy'), 'fish-1');
    expect(token.body).toContain('teal');
    expect(token.pattern).toBe('stripes');
    expect(token.fin).toBe('veil');
  });

  it('is deterministic per fish and varies the variant by fish id', () => {
    const a = spriteFor(species('guppy'), 'fish-1');
    const b = spriteFor(species('guppy'), 'fish-1');
    const c = spriteFor(species('guppy'), 'fish-9');
    expect(a).toEqual(b);
    expect(a.variant).not.toBe(c.variant);
  });
});

describe('panel helpers', () => {
  it('toggleInSet adds and removes without mutating the input', () => {
    const start = new Set(['a']);
    const added = toggleInSet(start, 'b');
    expect([...added].sort()).toEqual(['a', 'b']);
    expect(start.has('b')).toBe(false);
    const removed = toggleInSet(added, 'a');
    expect([...removed]).toEqual(['b']);
  });

  it('selectAll and clearSelection build bounds-checked sets', () => {
    expect([...selectAll(['a', 'b', 'b'])].sort()).toEqual(['a', 'b']);
    expect(clearSelection().size).toBe(0);
  });

  it('formats money, countdowns, and game time for the HUD', () => {
    expect(formatMoney(1234567)).toBe('$1,234,567');
    expect(formatCountdown(10, 7)).toBe('3d left');
    expect(formatCountdown(7, 7)).toBe('due today');
    expect(formatCountdown(5, 7)).toBe('2d overdue');
    expect(formatGameTime(4, 9)).toBe('Day 4 · 09:00');
  });

  it('bulk preview passes the U6 selector through unchanged', () => {
    const kernel = createKernel(7);
    registerWater(kernel.registry);
    registerFish(kernel.registry);
    registerFeeding(kernel.registry);
    registerBreeding(kernel.registry);
    registerCommerce(kernel.registry);
    const state = kernel.store.state;
    const ids = Object.keys(state.fish);
    const speciesOf = (id: string) => undefined;
    expect(previewBulkSale(state, ids, speciesOf)).toEqual(bulkPreview(state, ids, speciesOf));
  });

  it('order-reward and grade previews mirror their selectors exactly', () => {
    const kernel = createKernel(7);
    registerWater(kernel.registry);
    registerFish(kernel.registry);
    registerFeeding(kernel.registry);
    registerBreeding(kernel.registry);
    registerCommerce(kernel.registry);
    const state = kernel.store.state;
    const speciesOf = (id: string) => undefined;
    expect(previewOrderReward(state, 'no-such-order', [], speciesOf)).toBe(
      orderRewardPreview(state, 'no-such-order', [], speciesOf),
    );
    expect(previewGrade(state, undefined, 'no-such-cohort', 1)).toBe(
      gradePreview(state, undefined, 'no-such-cohort', 1),
    );
  });
});
