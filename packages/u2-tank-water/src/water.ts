// water — U2 water-cycle system + selectors (W7, BR8.1–BR8.3, BR8.5–BR8.6).
// One system (`u2.water`, water phase) plus pure U2-owned selectors read by
// U3/U6/U7. No per-tick sorts: store insertion order is the iteration order.
// No allocation in the bioload loop (for-in over the live records).
// All randomness flows through ctx.rng; W7 itself draws none.
import type {
  Fish,
  GameState,
  Species,
  Tank,
  WaterQualityBand,
} from '@aquarium/u1-sim-foundation/state';
import type {
  Registry,
  System,
  TickContext,
} from '@aquarium/u1-sim-foundation';
import './events.js';

/** Waste units added per bioload-unit per tick (W7). */
export const WASTE_RATE = 0.02;
/** Nitrate gained per converted waste unit (W7). */
export const NITRATE_RATIO = 0.5;
/** Biofilter maturity gained per tick; 240 ticks ~= 10 game-days (W7). */
export const MATURITY_PER_TICK = 1 / 240;
/** Temperature lerp factor toward the target each tick (W7). */
export const TEMP_DRIFT = 0.2;
/** Heater-held target (W7, BR8.5). */
export const HEATER_TARGET_C = 26;
/** Ambient drift target without a heater (W7, BR8.5). */
export const AMBIENT_TARGET_C = 22;
/** Hard clamp on tempC (BR8.5). */
export const TEMP_MIN_C = 10;
export const TEMP_MAX_C = 35;
/** Filter conversion capacity by level (W7). */
export const FILTER_CONVERSION: Record<1 | 2 | 3, number> = { 1: 2, 2: 5, 3: 9 };
/** Nursery load per ungraded fry (W7, BR8.6). */
export const COHORT_LOAD_PER_FRY = 0.05;
/** Tolerant range when a species carries no tempRangeC (W7). */
export const TOLERANT_RANGE_C: readonly [number, number] = [20, 28];
/** tempFit below which a temperature episode opens (BR8.5). */
export const TEMP_POOR_FIT = 0.5;

/** Band on max(waste, nitrate): good <40, fair 40-69, poor >=70 (W7). */
export function qualityBandOf(waste: number, nitrate: number): WaterQualityBand {
  const peak = Math.max(waste, nitrate);
  if (peak < 40) return 'good';
  if (peak < 70) return 'fair';
  return 'poor';
}

/**
 * Feeding-activity multiplier from satiety (W7).
 * U2-local default until U3 defines its activity scale — owner: U3
 * (satiety handling in u3-fish/src/fish.ts: HUNGER_BELOW bands, SPAWN_SATIETY;
 * healthOf in u3-fish/src/selectors.ts). Reconcile these bands with U3's
 * satiety thresholds before changing them; do not drift the two scales apart.
 */
export function activityOf(satiety: number): number {
  if (satiety >= 70) return 1.2;
  if (satiety >= 30) return 1.0;
  return 0.8;
}

/** Fit of tempC against a catalogue range (or the tolerant default): 1 inside, 0.1 off per degree outside, floored at 0 (W7). */
export function tempFit(tempC: number, range: readonly [number, number] | undefined): number {
  const [lo, hi] = range ?? TOLERANT_RANGE_C;
  if (tempC >= lo && tempC <= hi) return 1;
  const outside = tempC < lo ? lo - tempC : tempC - hi;
  return Math.max(0, 1 - 0.1 * outside);
}

/** Heater target selection (W7, BR8.5). */
export function tempTargetC(heaterInstalled: boolean): number {
  return heaterInstalled ? HEATER_TARGET_C : AMBIENT_TARGET_C;
}

/** Clamp helper for chemistry updates. */
export function clampChem(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// --- Selectors (U2-owned, read by U3/U6/U7; pure reads, never mutate) ---

/** The numbers for panels (W7). */
export function tankWater(state: GameState): Tank['water'] {
  return state.tank.water;
}

/** 100 - max(waste, nitrate); U3 health input, U7 green/yellow/red. */
export function waterQuality(state: GameState): number {
  return 100 - Math.max(state.tank.water.waste, state.tank.water.nitrate);
}

/** capacity is volumeL; U6's TANK_FULL check reads this. */
export function capacity(state: GameState): number {
  return state.tank.volumeL;
}

/** Recomputed cache reader; U7 stocking meter. */
export function bioloadOf(state: GameState): number {
  return state.tank.bioload;
}

/**
 * Purchase-time check (BR8.6): an unstocked fish has no satiety, so default
 * activity 1.0. Every stocking path calls this and refuses TANK_FULL on
 * breach — never a head-count comparison.
 */
export function projectedBioload(state: GameState, adultSizeCm: number): number {
  return state.tank.bioload + adultSizeCm * 1.0;
}

/**
 * Species fit for the current tempC. Takes the resolved species entry —
 * a selector cannot reach the catalogue from GameState alone, so the caller
 * (a system or handler with ctx.species) resolves it first.
 */
export function tempFitFor(state: GameState, species: Species | undefined): number {
  return tempFit(state.tank.water.tempC, species?.tempRangeC);
}

/** Per-fish load contribution: catalogue adult size, falling back to body size. */
function fishLoad(fish: Fish, adultSizeCm: number | undefined): number {
  return (adultSizeCm ?? fish.sizeCm) * activityOf(fish.satiety);
}

/** Recompute the cached bioload without allocating (BR8.6, NFR1.1). */
export function recomputeBioload(state: GameState, speciesOf: (speciesId: string) => number | undefined): number {
  const tankId = state.tank.id;
  let load = 0;
  const fish = state.fish;
  for (const id in fish) {
    const entry = fish[id];
    if (entry === undefined || entry.tankId !== tankId) continue;
    load += fishLoad(entry, speciesOf(entry.speciesId));
  }
  const cohorts = state.cohorts;
  for (const id in cohorts) {
    const cohort = cohorts[id];
    if (cohort === undefined || cohort.tankId !== tankId) continue;
    load += cohort.count * COHORT_LOAD_PER_FRY;
  }
  return load;
}

/** Run one water phase over the tank (W7). Mutates only the U2-owned Tank. */
export function runWaterTick(ctx: TickContext): void {
  const tank = ctx.state.tank;
  tank.bioload = recomputeBioload(ctx.state, (speciesId) => ctx.species.get(speciesId)?.adultSizeCm);
  const overcrowded = tank.bioload > tank.volumeL;

  // BR8.1: waste from bioload (+ any U4 feeding deposit already in waste), doubled while overcrowded.
  tank.water.waste = clampChem(
    tank.water.waste + tank.bioload * WASTE_RATE * (overcrowded ? 2 : 1),
    0,
    100,
  );

  // BR8.2: filter converts waste -> nitrate at capacity x maturity.
  const converted = Math.min(tank.water.waste, tank.equipment.filter.conversionRate * tank.biofilterMaturity);
  tank.water.waste -= converted;
  tank.water.nitrate = clampChem(tank.water.nitrate + converted * NITRATE_RATIO, 0, 100);

  // BR8.3: maturity rises only, capped at 1. Resets happen only on filter-level change (commands).
  tank.biofilterMaturity = Math.min(1, tank.biofilterMaturity + MATURITY_PER_TICK);

  // BR8.5: temperature drift toward heater/ambient target, clamped.
  tank.water.tempC = clampChem(
    tank.water.tempC + (tempTargetC(tank.equipment.heater.installed) - tank.water.tempC) * TEMP_DRIFT,
    TEMP_MIN_C,
    TEMP_MAX_C,
  );

  // BR8.6: overcrowd episode opens once, re-arms when back within capacity.
  if (overcrowded) {
    if (!tank.overcrowdLatch) {
      ctx.events.push({ kind: 'tankOvercrowded', bioload: tank.bioload, capacity: tank.volumeL });
      tank.overcrowdLatch = true;
    }
  } else {
    tank.overcrowdLatch = false;
  }

  // BR8.6: band edge newly poor emits fishSick per fish in tank; sustained poor is silent.
  const band = qualityBandOf(tank.water.waste, tank.water.nitrate);
  if (band === 'poor' && tank.prevQualityBand !== 'poor') {
    const fish = ctx.state.fish;
    for (const id in fish) {
      const entry = fish[id];
      if (entry === undefined || entry.tankId !== tank.id) continue;
      ctx.events.push({ kind: 'fishSick', fishId: entry.id, cause: 'waterQuality' });
    }
  }
  tank.prevQualityBand = band;

  // BR8.5: temperature episode opens once per latch; late arrivals and sustained stress are silent.
  // Zero-allocation steady state: count first, collect only on the opening tick (events allocate anyway).
  let stressed = 0;
  {
    const fish = ctx.state.fish;
    for (const id in fish) {
      const entry = fish[id];
      if (entry === undefined || entry.tankId !== tank.id) continue;
      const range = ctx.species.get(entry.speciesId)?.tempRangeC;
      if (tempFit(tank.water.tempC, range) < TEMP_POOR_FIT) stressed++;
    }
  }
  if (stressed > 0) {
    if (!tank.tempPoorLatch) {
      const fish = ctx.state.fish;
      for (const id in fish) {
        const entry = fish[id];
        if (entry === undefined || entry.tankId !== tank.id) continue;
        const range = ctx.species.get(entry.speciesId)?.tempRangeC;
        if (tempFit(tank.water.tempC, range) < TEMP_POOR_FIT) {
          ctx.events.push({ kind: 'fishSick', fishId: entry.id, cause: 'temperature' });
        }
      }
      tank.tempPoorLatch = true;
    }
  } else {
    tank.tempPoorLatch = false;
  }
}

export const waterSystem: System = {
  id: 'u2.water',
  phase: 'water',
  run: runWaterTick,
};

export function registerWater(registry: Registry): void {
  registry.registerSystem(waterSystem);
}
