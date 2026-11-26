// migration — v1 -> v2 forward migration (U2 breaking-change register).
// Pure function: v1 state in, v2 state out. One owner for all absent-field
// filling (Tank shape, Fish.stunted, feeding section, pairs, commerce
// fields). Refusals throw; the C6 pipeline maps them to MIGRATION_FAILED.
import { tierVolumeL, type WaterQualityBand } from '../types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** Band from max(waste, nitrate): good <40, fair 40-69, poor >=70. */
export function deriveQualityBand(waste: number, nitrate: number): WaterQualityBand {
  const peak = Math.max(waste, nitrate);
  if (peak < 40) return 'good';
  if (peak < 70) return 'fair';
  return 'poor';
}

/** Overcrowd latch derivation: bioload exceeds the (new) volume. */
export function deriveOvercrowdLatch(bioload: number, volumeL: number): boolean {
  return bioload > volumeL;
}

/**
 * Temp-poor latch derivation. The register pins tempFit < 0.5 for any fish
 * against the boot catalogue; the pure migration cannot read the catalogue,
 * so this is the catalogue-absent equivalent: with the tolerant default
 * range 20-28, fit < 0.5 exactly when tempC is more than 5 degrees outside,
 * i.e. below 15 or above 33. A fish list is accepted for signature symmetry
 * with the system path; the tolerant default applies to every fish equally.
 */
export function deriveTempPoorLatch(tempC: number, fishCount: number): boolean {
  if (fishCount === 0) return false;
  return tempC < 15 || tempC > 33;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Fish target default per kind: liveFirst is fry-flagged, the rest is fish food. */
export function defaultFoodTarget(kind: unknown): 'fish' | 'fry' {
  return kind === 'liveFirst' ? 'fry' : 'fish';
}

export function migrateV1ToV2(input: unknown): unknown {
  if (!isRecord(input)) throw new Error('migrateV1ToV2: state must be an object');
  const state = input as Record<string, unknown>;
  if (!isRecord(state.tank)) throw new Error('migrateV1ToV2: state.tank must be an object');
  const tank = state.tank as Record<string, unknown>;
  if (!isInt(tank.tier)) throw new Error('migrateV1ToV2: tank.tier must be an integer');
  const tier = tank.tier as number;
  // Throws on unknown tiers: a pre-tier save that is not tier 1-3 is refused, not guessed.
  const volumeL = tierVolumeL(tier);

  const oldWater = isRecord(tank.water) ? (tank.water as Record<string, unknown>) : {};
  const waste = num(oldWater.waste, 0);
  const tempC = num(
    oldWater.tempC ?? (oldWater as Record<string, unknown>).temperature,
    24,
  );
  const nitrate = 0; // a new cycle starts unconverted; ph is dropped (deferred post-MVP)

  const fish = isRecord(state.fish) ? (state.fish as Record<string, unknown>) : {};
  const fishIds = Object.keys(fish);
  for (const id of fishIds) {
    const entry = fish[id];
    if (!isRecord(entry)) continue;
    if (typeof entry.stunted !== 'boolean') entry.stunted = false;
  }

  const gameDay =
    isRecord(state.clock) && isInt((state.clock as Record<string, unknown>).gameDay)
      ? ((state.clock as Record<string, unknown>).gameDay as number)
      : 1;

  const food = isRecord(state.food) ? (state.food as Record<string, unknown>) : {};
  for (const id of Object.keys(food)) {
    const entry = food[id];
    if (!isRecord(entry)) continue;
    if (!isInt(entry.acquiredDay)) entry.acquiredDay = gameDay;
    if (entry.target !== 'fish' && entry.target !== 'fry') entry.target = defaultFoodTarget(entry.kind);
  }

  const cohorts = isRecord(state.cohorts) ? (state.cohorts as Record<string, unknown>) : {};
  for (const id of Object.keys(cohorts)) {
    const entry = cohorts[id];
    if (!isRecord(entry)) continue;
    if (!isInt(entry.firstFoodDays)) entry.firstFoodDays = 0;
    if (!isInt(entry.lastFryFedDay)) entry.lastFryFedDay = 0;
    if (entry.stage !== 'eggs' && entry.stage !== 'fry') entry.stage = 'fry';
  }

  const market = isRecord(state.market) ? (state.market as Record<string, unknown>) : {};
  for (const id of Object.keys(market)) {
    const entry = market[id];
    if (!isRecord(entry)) continue;
    if (!isInt(entry.lastTrendDay)) entry.lastTrendDay = Math.max(1, gameDay);
  }

  const orders = Array.isArray(state.orders) ? (state.orders as unknown[]) : [];
  for (const order of orders) {
    if (!isRecord(order)) continue;
    const deadline = (order as Record<string, unknown>).deadline;
    const deadlineDay =
      isInt(deadline) && (deadline as number) >= gameDay ? (deadline as number) : gameDay + 3;
    (order as Record<string, unknown>).deadlineDay = deadlineDay;
    delete (order as Record<string, unknown>).deadline;
    if (!isInt((order as Record<string, unknown>).minHealth)) {
      (order as Record<string, unknown>).minHealth = (order as Record<string, unknown>).minQuality;
    }
    delete (order as Record<string, unknown>).minQuality;
    if (typeof (order as Record<string, unknown>).customer !== 'string') {
      (order as Record<string, unknown>).customer = 'hobbyist';
    }
    if (typeof (order as Record<string, unknown>).multiplier !== 'number') {
      (order as Record<string, unknown>).multiplier = 1.2;
    }
    // No catalogue access in the pure migration: 0 = no size gate, so no
    // existing order is newly blocked. U6 fills real sizes for new orders.
    if (typeof (order as Record<string, unknown>).minSizeCm !== 'number') {
      (order as Record<string, unknown>).minSizeCm = 0;
    }
  }

  const notifications = Array.isArray(state.notifications) ? (state.notifications as unknown[]) : [];
  for (const note of notifications) {
    if (!isRecord(note)) continue;
    if (typeof (note as Record<string, unknown>).subjectId !== 'string') {
      (note as Record<string, unknown>).subjectId = '';
    }
  }

  const bioload = num(tank.bioload, 0);
  return {
    ...state,
    tank: {
      ...tank,
      volumeL,
      water: { waste, nitrate, tempC },
      equipment: {
        filter: { level: 1, conversionRate: 2 },
        heater: { installed: false },
        autoFeeder: { installed: false },
        light: { level: 1 },
      },
      bioload,
      biofilterMaturity: num(tank.biofilterMaturity, 0),
      prevQualityBand: deriveQualityBand(waste, nitrate),
      overcrowdLatch: deriveOvercrowdLatch(bioload, volumeL),
      tempPoorLatch: deriveTempPoorLatch(tempC, fishIds.length),
    },
    fish,
    food,
    cohorts,
    market,
    orders,
    notifications,
    pairs: {},
    feeding: { schedule: null },
  };
}
