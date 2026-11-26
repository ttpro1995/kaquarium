import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../src/canonicalJson.js';
import { createInitialState, validateClock, validateGameState } from '../src/types.js';
import { money, level, sellableFish, fishById, fishInTank, notificationQueue, tankWater } from '../src/selectors.js';

describe('types + store (BR1.3, US9.3, US11.1)', () => {
  it('boots a new game at day 1 hour 8 with empty collections', () => {
    const s = createInitialState(42);
    expect(s.seed).toBe(42);
    expect(s.clock.gameDay).toBe(1);
    expect(s.clock.gameHour).toBe(8);
    expect(s.fish).toEqual({});
    expect(s.cohorts).toEqual({});
    expect(s.food).toEqual({});
    expect(s.orders).toEqual([]);
    expect(s.notifications).toEqual([]);
    expect(s.money).toBeGreaterThanOrEqual(0);
  });

  it('mirrors RngState.seed from GameState.seed at boot (Q3-A)', () => {
    const s = createInitialState(7);
    expect(s.rngState.seed).toBe(s.seed);
  });

  it('keeps the BR1.3 invariant paused == (speed == 0) on boot', () => {
    const running = createInitialState(1, { speed: 1 });
    expect(running.clock.paused).toBe(false);
    const paused = createInitialState(1, { speed: 0 });
    expect(paused.clock.paused).toBe(true);
    expect(validateClock(paused.clock)).toEqual([]);
  });

  it('rejects a clock that breaks the mirror invariant', () => {
    const s = createInitialState(1);
    const broken = { ...s.clock, speed: 0 as const, paused: false };
    expect(validateClock(broken).length).toBeGreaterThan(0);
    expect(validateGameState({ ...s, clock: broken }).length).toBeGreaterThan(0);
  });

  it('rejects out-of-range hours and unknown speeds', () => {
    const s = createInitialState(1);
    expect(validateClock({ ...s.clock, gameHour: 24 }).length).toBeGreaterThan(0);
    expect(
      validateClock({ ...s.clock, speed: 3 as unknown as 0 | 1 | 2 | 4 }).length,
    ).toBeGreaterThan(0);
  });

  it('pins canonicalJson: sorted keys at every depth, no whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":1}');
    expect(canonicalJson({ z: [3, 2], a: 1 })).toBe('{"a":1,"z":[3,2]}');
    expect(canonicalJson(null)).toBe('null');
  });

  it('keeps selectors pure and read-only', () => {
    const s = createInitialState(9);
    const before = canonicalJson(s);
    expect(money(s)).toBe(s.money);
    expect(fishById(s, 'missing')).toBeUndefined();
    expect(fishInTank(s, 'tank-1')).toEqual([]);
    expect(notificationQueue(s)).toEqual([]);
    expect(tankWater(s)).toBe(s.tank.water);
    expect(canonicalJson(s)).toBe(before);
  });

  it('reads level and sellable fish without mutating', () => {
    const s = createInitialState(9);
    expect(level(s)).toBe(1);
    expect(sellableFish(s)).toEqual([]);
    s.fish.f1 = {
      id: 'f1',
      speciesId: 'guppy',
      tankId: s.tank.id,
      sex: 'female',
      stage: 'adult',
      ageDays: 120,
      sizeCm: 4,
      health: 90,
      satiety: 80,
      stress: 5,
      genome: {},
      value: 15,
      mature: true,
    };
    expect(sellableFish(s).map((f) => f.id)).toEqual(['f1']);
  });

  it('derives tank capacity by scanning Fish.tankId (Q2-B, no fishIds list)', () => {
    const s = createInitialState(9);
    expect('fishIds' in (s.tank as unknown as Record<string, unknown>)).toBe(false);
    expect(fishInTank(s, s.tank.id)).toEqual([]);
  });
});
