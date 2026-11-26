// market — BR16.4 demand recovery and trend cycle (W29).
// Demand saw-tooths around sales (x0.97 each) and recovers 8% of the gap
// to 1 every day; trend re-rolls every 3 days weighted to 0. Pure helpers
// plus the two tick-called steps; entries are lazily seeded at demand 1.
import type { GameState, MarketState } from '@aquarium/u1-sim-foundation/state';
import type { Rng } from '@aquarium/u1-sim-foundation';

/** Per-sale saturation multiplier (BR16.3). */
export const SATURATION_PER_SALE = 0.97;

/** Daily recovery share of the gap to 1 (BR16.4). */
export const DEMAND_RECOVERY = 0.08;

/** Days between trend re-rolls (BR16.4). */
export const TREND_CYCLE_DAYS = 3;

export function demandFor(state: GameState, speciesId: string): number {
  return state.market[speciesId]?.demand ?? 1;
}

export function trendFor(state: GameState, speciesId: string): number {
  return state.market[speciesId]?.trend ?? 0;
}

/** Lazy seed: demand 1, trend 0, cycle anchored at today. */
export function ensureMarketEntry(state: GameState, speciesId: string, today: number): MarketState {
  let entry = state.market[speciesId];
  if (entry === undefined) {
    entry = { speciesId, demand: 1, trend: 0, lastTrendDay: today };
    state.market[speciesId] = entry;
  }
  return entry;
}

/** Seed entries for every catalogue species the tick can see. */
export function ensureMarketEntries(
  state: GameState,
  catalog: readonly { id: string }[],
  today: number,
): void {
  for (const species of catalog) ensureMarketEntry(state, species.id, today);
}

/** One sale saturates that species (bulk applies sequentially, BR16.3). */
export function applySaleSaturation(state: GameState, speciesId: string): void {
  const entry = state.market[speciesId];
  if (entry === undefined) return;
  entry.demand *= SATURATION_PER_SALE;
}

/** Day-boundary recovery for every tracked species (W29). */
export function recoverDemand(state: GameState): void {
  const market = state.market;
  for (const id in market) {
    const entry = market[id];
    if (entry === undefined) continue;
    entry.demand += (1 - entry.demand) * DEMAND_RECOVERY;
  }
}

/** Weighted re-roll: P(-1) = 0.25, P(0) = 0.5, P(1) = 0.25. */
export function rollTrend(rng: Rng): -1 | 0 | 1 {
  const draw = rng.next();
  if (draw < 0.25) return -1;
  if (draw < 0.75) return 0;
  return 1;
}

/** Day-boundary trend step: re-roll only when the 3-day cycle elapsed. */
export function maybeRollTrends(state: GameState, rng: Rng, today: number): void {
  const market = state.market;
  for (const id in market) {
    const entry = market[id];
    if (entry === undefined) continue;
    if (today - entry.lastTrendDay >= TREND_CYCLE_DAYS) {
      entry.trend = rollTrend(rng);
      entry.lastTrendDay = today;
    }
  }
}
