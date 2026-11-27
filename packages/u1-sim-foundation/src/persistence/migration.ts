// migration — v1 -> v2 forward migration (U2 breaking-change register).
// Pure function: v1 state in, v2 state out. One owner for all absent-field
// filling (Tank shape, Fish.stunted, feeding section, pairs, commerce
// fields). Refusals throw; the C6 pipeline maps them to MIGRATION_FAILED.
import { starterFoodStack, tierVolumeL, type WaterQualityBand } from '../types.js';

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
  // Unknown tiers default to 1 with the paired tier-1 volume (never refused:
  // a pre-tier save outside 1-3 still loads as a starter tank).
  const rawTier = tank.tier;
  const tier = rawTier === 1 || rawTier === 2 || rawTier === 3 ? rawTier : 1;
  const volumeL = tierVolumeL(tier);

  const oldWater = isRecord(tank.water) ? (tank.water as Record<string, unknown>) : {};
  const waste = num(oldWater.waste, 0);
  const tempC = num(
    oldWater.tempC ?? (oldWater as Record<string, unknown>).temperature,
    24,
  );
  const nitrate = 0; // a new cycle starts unconverted; ph is dropped (deferred post-MVP)

  // Pure: every container below is rebuilt and every record entry is
  // cloned before defaults are filled, so the input payload is untouched.
  const fishIn = isRecord(state.fish) ? (state.fish as Record<string, unknown>) : {};
  const fish: Record<string, unknown> = {};
  for (const id of Object.keys(fishIn)) {
    const entry = fishIn[id];
    if (!isRecord(entry)) {
      fish[id] = entry;
      continue;
    }
    const next = { ...entry };
    if (typeof next.stunted !== 'boolean') next.stunted = false;
    fish[id] = next;
  }

  const gameDay =
    isRecord(state.clock) && isInt((state.clock as Record<string, unknown>).gameDay)
      ? ((state.clock as Record<string, unknown>).gameDay as number)
      : 1;

  const foodIn = isRecord(state.food) ? (state.food as Record<string, unknown>) : {};
  const food: Record<string, unknown> = {};
  for (const id of Object.keys(foodIn)) {
    const entry = foodIn[id];
    if (!isRecord(entry)) {
      food[id] = entry;
      continue;
    }
    const next = { ...entry };
    if (!isInt(next.acquiredDay)) next.acquiredDay = gameDay;
    if (next.target !== 'fish' && next.target !== 'fry') next.target = defaultFoodTarget(next.kind);
    food[id] = next;
  }
  // BR12.4 backfill: a migrated cupboard that is empty grants the same
  // bootstrap a new save gets, dated to the migrated day. Stocked
  // cupboards keep exactly what the player had (no starter injected).
  if (Object.keys(food).length === 0) {
    const starter = starterFoodStack(gameDay);
    food[starter.id] = starter;
  }

  const cohortsIn = isRecord(state.cohorts) ? (state.cohorts as Record<string, unknown>) : {};
  const cohorts: Record<string, unknown> = {};
  for (const id of Object.keys(cohortsIn)) {
    const entry = cohortsIn[id];
    if (!isRecord(entry)) {
      cohorts[id] = entry;
      continue;
    }
    const next = { ...entry };
    if (!isInt(next.firstFoodDays)) next.firstFoodDays = 0;
    if (!isInt(next.lastFryFedDay)) next.lastFryFedDay = 0;
    if (next.stage !== 'eggs' && next.stage !== 'fry') next.stage = 'fry';
    cohorts[id] = next;
  }

  const marketIn = isRecord(state.market) ? (state.market as Record<string, unknown>) : {};
  const market: Record<string, unknown> = {};
  for (const id of Object.keys(marketIn)) {
    const entry = marketIn[id];
    if (!isRecord(entry)) {
      market[id] = entry;
      continue;
    }
    const next = { ...entry };
    if (!isInt(next.lastTrendDay)) next.lastTrendDay = Math.max(1, gameDay);
    market[id] = next;
  }

  const ordersIn = Array.isArray(state.orders) ? (state.orders as unknown[]) : [];
  const orders: unknown[] = [];
  for (const order of ordersIn) {
    if (!isRecord(order)) {
      orders.push(order);
      continue;
    }
    const next = { ...order };
    // Preserve an existing valid deadlineDay; only derive from the legacy
    // deadline when it is present, else gameDay + 3.
    if (!isInt(next.deadlineDay)) {
      const legacy = next.deadline;
      next.deadlineDay = isInt(legacy) && (legacy as number) >= gameDay ? (legacy as number) : gameDay + 3;
    }
    delete next.deadline;
    if (!isInt(next.minHealth)) {
      // Missing minHealth defaults to 0 (non-blocking: never newly gates an
      // existing order); a legacy minQuality carries over when present.
      next.minHealth = isInt(next.minQuality) ? (next.minQuality as number) : 0;
    }
    delete next.minQuality;
    if (typeof next.customer !== 'string') {
      next.customer = 'hobbyist';
    }
    if (typeof next.multiplier !== 'number') {
      next.multiplier = 1.2;
    }
    // No catalogue access in the pure migration: 0 = no size gate, so no
    // existing order is newly blocked. U6 fills real sizes for new orders.
    if (typeof next.minSizeCm !== 'number') {
      next.minSizeCm = 0;
    }
    orders.push(next);
  }

  // subjectId is optional: an absent one stays absent (never filled with '').
  // No entry is mutated, so a shallow array copy keeps the function pure.
  const notifications = Array.isArray(state.notifications) ? [...(state.notifications as unknown[])] : [];

  const bioload = num(tank.bioload, 0);
  return {
    ...state,
    tank: {
      ...tank,
      tier,
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
      tempPoorLatch: deriveTempPoorLatch(tempC, Object.keys(fish).length),
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
