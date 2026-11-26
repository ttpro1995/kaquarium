// integration.test.ts — U5 key boundaries through the real U1 bus with
// live U2 water, U3 fish, and U4 feeding (never mocked): pair → spawn →
// hatch → feed (U4 feedFry) → grade → stunted adults; the hatch XP
// sighting U6 reads; a fixed-seed golden replay pins the lifecycle.
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  createKernel,
  type Fish,
  type SimEvent,
  type Species,
} from '@aquarium/u1-sim-foundation';
import { register as registerWater } from '@aquarium/u2-tank-water';
import { register as registerFish } from '@aquarium/u3-fish';
import { register as registerFeeding } from '../../u4-feeding/src/index.js';
import { register as registerBreeding } from '../src/index.js';

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

function adultFish(id: string, sex: 'male' | 'female', speciesId = 'guppy'): Fish {
  return {
    id,
    speciesId,
    tankId: 'tank-1',
    sex,
    stage: 'adult',
    ageDays: 100,
    sizeCm: 5,
    health: 100,
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
  };
}

function setup(clutch: readonly [number, number] = [6, 6], cycleDays = 30) {
  const species = guppy({ clutch: [...clutch], gestationDays: 1, cycleDays, speciesBaseRate: 24 });
  const kernel = createKernel(7, { speciesFiles: [{ file: 'guppy.json', data: species }] });
  registerWater(kernel.registry);
  registerFish(kernel.registry);
  registerFeeding(kernel.registry);
  registerBreeding(kernel.registry);
  const seen: SimEvent[][] = [];
  kernel.store.subscribe((events) => {
    seen.push(events);
  });
  kernel.store.state.money = 1000;
  kernel.store.state.fish.f1 = adultFish('f1', 'female');
  kernel.store.state.fish.m1 = adultFish('m1', 'male');
  return { kernel, species, seen };
}

/** One game day of ticks. */
function tickDay(kernel: ReturnType<typeof createKernel>, days = 1) {
  for (let i = 0; i < 24 * days; i++) kernel.tick();
}

describe('full breeding lifecycle (U2 × U3 × U4 × U5)', () => {
  it('pair → spawn → hatch → feed → grade: fed fry grow true, unfed stunt', () => {
    // A big brood: integer decay melts broods under ~10 before grading age.
    // A short cooldown: the second birth lands before nitrate build-up
    // (no water changes in this script) can close the quality gate.
    const { kernel } = setup([30, 30], 5);
    expect(kernel.dispatch('breeding.pair', { femaleId: 'f1', maleId: 'm1' }).ok).toBe(true);
    // Conception on day 1 (p = 1), birth on day 2.
    for (let i = 0; i < 40 && Object.keys(kernel.store.state.cohorts).length === 0; i++) kernel.tick();
    const firstId = Object.keys(kernel.store.state.cohorts)[0] as string;
    expect(kernel.store.state.cohorts[firstId]?.stage).toBe('fry');

    // Adults eat through the real bus too, or starvation ends the line
    // before the 30-day cooldown lapses. Fry food refreshes past expiry
    // (liveFirst keeps 7 days); the first cohort eats 15 distinct days.
    const flakeBuy = kernel.dispatch('feeding.buyFood', { kind: 'flakes', qty: 250 });
    expect(flakeBuy.ok).toBe(true);
    const flakeId = flakeBuy.ok ? flakeBuy.value.foodId : '';
    let liveId = '';
    let liveBoughtDay = 0;
    const buyLive = () => {
      const bought = kernel.dispatch('feeding.buyFood', { kind: 'liveFirst', qty: 25 });
      expect(bought.ok).toBe(true);
      liveId = bought.ok ? bought.value.foodId : '';
      liveBoughtDay = kernel.store.state.clock.gameDay;
    };
    buyLive();
    const birthDay = kernel.store.state.clock.gameDay;
    // The birth day itself counts: feed before the first overnight tick.
    {
      const need = Math.ceil((kernel.store.state.cohorts[firstId]?.count ?? 1) / 10);
      expect(kernel.dispatch('feeding.feedFry', { foodId: liveId, cohortId: firstId, portions: need }))
        .toEqual({ ok: true, value: { eaten: need, leftover: 0, waste: 0 } });
    }
    let secondId: string | undefined;
    for (let d = 0; d < 70; d++) {
      tickDay(kernel, 1);
      const today = kernel.store.state.clock.gameDay;
      expect(kernel.dispatch('feeding.feedFish', { foodId: flakeId, portions: 6 }).ok).toBe(true);
      if (today >= birthDay && today < birthDay + 15) {
        if (today - liveBoughtDay >= 8) buyLive();
        // The need tracks the live count: midnight decay shrinks it nightly.
        const need = Math.ceil((kernel.store.state.cohorts[firstId]?.count ?? 1) / 10);
        expect(kernel.dispatch('feeding.feedFry', { foodId: liveId, cohortId: firstId, portions: need }))
          .toEqual({ ok: true, value: { eaten: need, leftover: 0, waste: 0 } });
      }
      secondId = Object.keys(kernel.store.state.cohorts).find((id) => id !== firstId);
      // Both: a never-fed second brood exists AND the first ate 15 days.
      if (secondId !== undefined && (kernel.store.state.cohorts[firstId]?.firstFoodDays ?? 0) >= 15) break;
    }
    if (secondId === undefined) throw new Error('test setup: second brood missing');
    expect(kernel.store.state.cohorts[firstId]?.firstFoodDays).toBe(15);

    // Grow both cohorts past juvenileDays, then grade under a big tank.
    kernel.store.state.tank.volumeL = 1000;
    for (const id of [firstId, secondId]) {
      const cohort = kernel.store.state.cohorts[id];
      if (cohort !== undefined) cohort.ageDays = 30;
    }
    const fedCount = kernel.store.state.cohorts[firstId]?.count;
    const unfedCount = kernel.store.state.cohorts[secondId]?.count;
    if (fedCount === undefined || fedCount < 1) throw new Error('test setup: fed brood empty');
    if (unfedCount === undefined || unfedCount < 1) throw new Error('test setup: unfed brood empty');
    const gradedFed = kernel.dispatch('breeding.grade', { cohortId: firstId, count: fedCount });
    // 15 fed days is exactly half the window → not stunted (strict <).
    expect(gradedFed).toEqual({ ok: true, value: { graded: fedCount, stunted: 0 } });
    const gradedUnfed = kernel.dispatch('breeding.grade', { cohortId: secondId, count: unfedCount });
    expect(gradedUnfed).toEqual({ ok: true, value: { graded: unfedCount, stunted: unfedCount } });
  });

  it('hatch events carry the U6 XP sighting shape', () => {
    const { kernel, seen } = setup();
    expect(kernel.dispatch('breeding.pair', { femaleId: 'f1', maleId: 'm1' }).ok).toBe(true);
    for (let i = 0; i < 40 && Object.keys(kernel.store.state.cohorts).length === 0; i++) kernel.tick();
    // A U6-style subscriber maps the hatch into an info notification.
    const sightings = seen
      .flat()
      .filter((e) => e.kind === 'fryHatched')
      .map((e) => {
        const hatched = e as unknown as { kind: 'fryHatched'; cohortId: string; count: number };
        expect(typeof hatched.cohortId).toBe('string');
        expect(typeof hatched.count).toBe('number');
        return { priority: 'info', kind: hatched.kind, subjectId: hatched.cohortId };
      });
    expect(sightings).toHaveLength(1);
    expect(sightings[0]).toEqual({
      priority: 'info',
      kind: 'fryHatched',
      subjectId: sightings[0]?.subjectId,
    });
  });

  it('golden replay: the scripted lifecycle replays exactly on seed 7', () => {
    const replay = () => {
      const { kernel } = setup();
      kernel.dispatch('breeding.pair', { femaleId: 'f1', maleId: 'm1' });
      for (let i = 0; i < 40 && Object.keys(kernel.store.state.cohorts).length === 0; i++) kernel.tick();
      const cohortId = Object.keys(kernel.store.state.cohorts)[0] as string;
      const cohort = kernel.store.state.cohorts[cohortId];
      if (cohort !== undefined) cohort.ageDays = 30;
      kernel.store.state.tank.volumeL = 1000;
      kernel.dispatch('breeding.grade', { cohortId, count: cohort?.count ?? 0 });
      return canonicalJson({
        pairs: kernel.store.state.pairs,
        cohorts: kernel.store.state.cohorts,
        fish: Object.fromEntries(
          Object.entries(kernel.store.state.fish).map(([id, fish]) => [
            id,
            {
              speciesId: fish?.speciesId,
              stunted: fish?.stunted,
              parents: (fish as unknown as { parents?: unknown }).parents ?? null,
            },
          ]),
        ),
      });
    };
    const first = replay();
    // Determinism: the same seed replays tick-for-tick.
    expect(replay()).toBe(first);
    // Stored golden: birth day 2, cooling to day 32, brood of 6, all stunted.
    const golden = JSON.parse(first) as {
      pairs: Record<string, { state: string; readyDay: number }>;
      cohorts: Record<string, unknown>;
      fish: Record<string, { stunted: boolean; parents: unknown }>;
    };
    const pairIds = Object.keys(golden.pairs);
    expect(pairIds).toHaveLength(1);
    expect(golden.pairs[pairIds[0] as string]).toMatchObject({ state: 'cooling', readyDay: 32 });
    expect(Object.keys(golden.cohorts)).toHaveLength(0);
    const graded = Object.entries(golden.fish).filter(([id]) => id !== 'f1' && id !== 'm1');
    expect(graded).toHaveLength(6);
    for (const [, fish] of graded) {
      expect(fish.stunted).toBe(true);
      expect(fish.parents).toEqual(['f1', 'm1']);
    }
  });
});
