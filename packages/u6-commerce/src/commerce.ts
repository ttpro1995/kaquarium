// commerce — U6 commerce-phase + notify-phase systems (W29–W35).
// Commerce runs recovery -> costs -> expiry -> hatch-XP + level checks ->
// upkeep -> Fish.value cache refresh at day boundaries (hour 0); every
// tick it sights hatch events for XP and refreshes the value cache (the
// ratified C2 cross-entity write; display-only, never a price input).
// Notify aggregates the tick's fishSick burst into exactly one warn and
// enforces the BR19.3 queue cap.
import type {
  Fish,
  GameState,
  Species,
} from '@aquarium/u1-sim-foundation/state';
import type {
  Registry,
  Rng,
  System,
  TickContext,
} from '@aquarium/u1-sim-foundation';
import { ensureMarketEntries, maybeRollTrends, recoverDemand } from './market.js';
import { expireOrders, openOrders, pruneBoard, upkeepBoard } from './orders.js';
import { HATCH_XP, addXp } from './progression.js';
import { MARKET_FACTOR_MAX, MARKET_FACTOR_MIN, SIZE_FACTOR_MAX, SIZE_FACTOR_MIN } from './pricing.js';
import { demandFor, trendFor } from './market.js';
import { enforceQueueCap, syncNotificationSeq } from './notifications.js';
import './events.js';

/** Midnight tier electricity in $FISH (BR19.1): no debt, no shutoff. */
export const ELECTRICITY_COST: Record<1 | 2 | 3, number> = { 1: 5, 2: 12, 3: 25 };

/**
 * Midnight costs: money = max(0, money - cost). Returns the deducted amount.
 * Emits moneyChanged into the tick buffer when a caller passes events, so
 * the C4 money trail covers the nightly deduction (the mapper maps it to
 * null, so the queue stays quiet); U7 reads the balance from state.money.
 */
export function applyMidnightCosts(
  state: GameState,
  events?: { kind: string; [k: string]: unknown }[],
): number {
  const tier = state.tank.tier;
  const cost = tier === 2 ? ELECTRICITY_COST[2] : tier === 3 ? ELECTRICITY_COST[3] : ELECTRICITY_COST[1];
  const deducted = Math.min(state.money, cost);
  state.money -= deducted;
  if (events !== undefined && deducted > 0) {
    events.push({ kind: 'moneyChanged', delta: -deducted, balance: state.money });
  }
  return deducted;
}

/** Refresh the display-only Fish.value cache from the live formula. */
export function refreshFishValues(
  state: GameState,
  speciesOf: (id: string) => Species | undefined,
  inputs?: Map<string, { demand: number; trend: number }>,
): void {
  const fish = state.fish;
  for (const id in fish) {
    const entry = fish[id];
    if (entry === undefined) continue;
    const species = speciesOf(entry.speciesId);
    if (species === undefined) {
      // Explicit fallback (review): a catalogue-missing species is not
      // priceable, so the cache shows 0 rather than a stale value from
      // before the catalogue entry vanished. Display-only: sell/fulfil
      // never read this cache (the live formula rejects UNKNOWN_ENTITY),
      // so 0 can never become a price input.
      entry.value = 0;
      continue;
    }
    const cached = inputs?.get(entry.speciesId);
    entry.value = fastPriceForFish(
      entry,
      species,
      cached?.demand ?? demandFor(state, entry.speciesId),
      cached?.trend ?? trendFor(state, entry.speciesId),
    );
  }
}

/**
 * Zero-call fast path of priceForFish for the tick refresh (NFR1.1):
 * identical arithmetic to the factor helpers, inlined so v8 coverage
 * and the interpreter stay within budget at 40 fish. priceForFish
 * remains the canonical readable implementation; the suite asserts
 * both agree across a genome sweep.
 *
 * Deliberate triplication (review R-02): this function and the inline loop in
 * runCommerceTick repeat the priceForFish arithmetic instead of calling
 * it, trading one canonical call path for the NFR1.1 hot-loop budget.
 * All three copies must agree factor-for-factor — enforced by
 * tests/pricing.test.ts 'canonical priceForFish, fastPriceForFish, and
 * the tick inline loop agree across a genome sweep', which asserts both
 * fast paths equal the canonical formula across a genome sweep. Change
 * one, change all three, then run the sweep.
 */
export function fastPriceForFish(
  fish: { sizeCm: number; stage: Fish['stage']; health: number; genome: Record<string, unknown> },
  species: Species,
  demand: number,
  trend: number,
): number {
  let sizeF = species.adultSizeCm > 0 ? fish.sizeCm / species.adultSizeCm : SIZE_FACTOR_MIN;
  if (sizeF < SIZE_FACTOR_MIN) sizeF = SIZE_FACTOR_MIN;
  else if (sizeF > SIZE_FACTOR_MAX) sizeF = SIZE_FACTOR_MAX;
  const ageF = fish.stage === 'juvenile' ? 0.6 : fish.stage === 'senior' ? 0.7 : 1.0;
  const genome = fish.genome as Record<string, readonly unknown[]>;
  const huePair = genome.hue;
  const patternPair = genome.pattern;
  const tailPair = genome.tail;
  const sizePair = genome.size;
  const vigorPair = genome.vigor;
  const hue =
    (Array.isArray(huePair) && huePair[0] === 1 ? 1 : 0) + (Array.isArray(huePair) && huePair[1] === 1 ? 1 : 0);
  const premium =
    hue +
    ((Array.isArray(patternPair) && patternPair[0] === 1 ? 1 : 0) +
      (Array.isArray(patternPair) && patternPair[1] === 1 ? 1 : 0)) +
    ((Array.isArray(tailPair) && tailPair[0] === 1 ? 1 : 0) +
      (Array.isArray(tailPair) && tailPair[1] === 1 ? 1 : 0)) +
    ((Array.isArray(sizePair) && sizePair[0] === 1 ? 1 : 0) +
      (Array.isArray(sizePair) && sizePair[1] === 1 ? 1 : 0)) +
    ((Array.isArray(vigorPair) && vigorPair[0] === 1 ? 1 : 0) +
      (Array.isArray(vigorPair) && vigorPair[1] === 1 ? 1 : 0));
  const healthF = fish.health >= 70 ? 1.0 : 0.7;
  let marketF = 0.4 + 1.1 * demand + 0.1 * trend;
  if (marketF < MARKET_FACTOR_MIN) marketF = MARKET_FACTOR_MIN;
  else if (marketF > MARKET_FACTOR_MAX) marketF = MARKET_FACTOR_MAX;
  const product =
    species.sellBase * sizeF * ageF * (0.8 + 0.2 * hue) * (1 + 0.1 * premium) * healthF * (0.8 + 0.2 * (premium / 10)) * marketF;
  return Math.max(1, Math.floor(product));
}

/** Count fryHatched events in the tick buffer (C4 hatch-XP exception). */
export function hatchEventsSeen(events: readonly { kind: string }[]): number {
  let count = 0;
  for (const event of events) {
    if (event.kind === 'fryHatched') count++;
  }
  return count;
}

/** One commerce phase (W29–W34 minus notify-owned work). */
export function runCommerceTick(ctx: TickContext): void {
  const { state, now, rng, species } = ctx;
  syncNotificationSeq(state);
  const all = species.all();
  ensureMarketEntries(state, all, now.day);
  const dayBoundary = now.hour === 0;
  if (dayBoundary) {
    recoverDemand(state);
    maybeRollTrends(state, rng, now.day);
    applyMidnightCosts(state, ctx.events);
    expireOrders(state, now.day, ctx.events);
    pruneBoard(state);
  }
  // Hatch sightings inline: the buffer holds only this tick's events
  // (the drain clears it after every tick and command).
  for (const event of ctx.events) {
    if ((event as { kind: string }).kind === 'fryHatched') addXp(state, ctx.events, HATCH_XP);
  }
  if (dayBoundary) {
    upkeepBoard(
      state,
      rng,
      now.day,
      all.filter((s) => isBuyableLevel(state, s)),
    );
  }
  // Per-tick value refresh inline: property reads and arithmetic only, no
  // per-fish calls (NFR1.1). Deliberate triplication (review R-02): this loop is
  // the third copy of the priceForFish arithmetic (canonical form in
  // pricing.ts, fastPriceForFish above); the pricing suite asserts all
  // three agree across a genome sweep (see the triplication note on
  // fastPriceForFish and tests/pricing.test.ts 'canonical priceForFish,
  // fastPriceForFish, and the tick inline loop agree across a genome
  // sweep'). Per-species market terms hoist out of
  // the loop; immutable genome terms memoize per Fish object.
  const cache: Record<string, { entry: Species | undefined; base: number }> = {};
  const market = state.market;
  const fish = state.fish;
  for (const id in fish) {
    const entry = fish[id];
    if (entry === undefined) continue;
    let cached = cache[entry.speciesId];
    if (cached === undefined) {
      const speciesEntry = species.get(entry.speciesId);
      const marketEntry = market[entry.speciesId];
      const demand = marketEntry?.demand ?? 1;
      const trend = marketEntry?.trend ?? 0;
      let marketF = 0.4 + 1.1 * demand + 0.1 * trend;
      if (marketF < MARKET_FACTOR_MIN) marketF = MARKET_FACTOR_MIN;
      else if (marketF > MARKET_FACTOR_MAX) marketF = MARKET_FACTOR_MAX;
      cached = {
        entry: speciesEntry,
        base: speciesEntry === undefined ? 0 : speciesEntry.sellBase * marketF,
      };
      cache[entry.speciesId] = cached;
    }
    if (cached.entry === undefined) {
      // Explicit fallback, mirroring refreshFishValues: catalogue-missing
      // species is not priceable, so the cache shows 0, never stale.
      entry.value = 0;
      continue;
    }
    let sizeF =
      cached.entry.adultSizeCm > 0 ? entry.sizeCm / cached.entry.adultSizeCm : SIZE_FACTOR_MIN;
    if (sizeF < SIZE_FACTOR_MIN) sizeF = SIZE_FACTOR_MIN;
    else if (sizeF > SIZE_FACTOR_MAX) sizeF = SIZE_FACTOR_MAX;
    const ageF = entry.stage === 'juvenile' ? 0.6 : entry.stage === 'senior' ? 0.7 : 1.0;
    let combined = genomeFactorCache.get(entry.genome);
    if (combined === undefined) {
      combined = genomeFactor(entry.genome as Record<string, readonly unknown[]>);
      genomeFactorCache.set(entry.genome, combined);
    }
    const healthF = entry.health >= 70 ? 1.0 : 0.7;
    entry.value = Math.max(1, Math.floor(cached.base * sizeF * ageF * combined * healthF));
  }
}

function isBuyableLevel(state: GameState, species: Species): boolean {
  if (species.tier > state.progression.level) return false;
  if ((species.archetype === 'scatter' || species.archetype === 'plant') && state.progression.level < 2) return false;
  return true;
}

/**
 * Memoized genome price factor (colourF x rarityF x geneticsF) per fish.
 * Genomes are immutable after spawn/birth (no unit ever writes a locus in
 * place), so the factor is computed once per Fish object; WeakMap entries
 * collect with dead fish and the cache stays bounded by live fish.
 */
const genomeFactorCache = new WeakMap<object, number>();

function genomeFactor(genome: Record<string, readonly unknown[]>): number {
  const huePair = genome.hue;
  const patternPair = genome.pattern;
  const tailPair = genome.tail;
  const sizePair = genome.size;
  const vigorPair = genome.vigor;
  const hue =
    (Array.isArray(huePair) && huePair[0] === 1 ? 1 : 0) +
    (Array.isArray(huePair) && huePair[1] === 1 ? 1 : 0);
  const premium =
    hue +
    ((Array.isArray(patternPair) && patternPair[0] === 1 ? 1 : 0) +
      (Array.isArray(patternPair) && patternPair[1] === 1 ? 1 : 0)) +
    ((Array.isArray(tailPair) && tailPair[0] === 1 ? 1 : 0) +
      (Array.isArray(tailPair) && tailPair[1] === 1 ? 1 : 0)) +
    ((Array.isArray(sizePair) && sizePair[0] === 1 ? 1 : 0) +
      (Array.isArray(sizePair) && sizePair[1] === 1 ? 1 : 0)) +
    ((Array.isArray(vigorPair) && vigorPair[0] === 1 ? 1 : 0) +
      (Array.isArray(vigorPair) && vigorPair[1] === 1 ? 1 : 0));
  return (0.8 + 0.2 * hue) * (1 + 0.1 * premium) * (0.8 + 0.2 * (premium / 10));
}

/** fishSick cause union the notify system aggregates (U2's additive variants). */
export type FishSickCause = 'waterQuality' | 'temperature';

/**
 * One notify phase (W35): exactly one warn per tick that carried sick
 * events — a singleton naming the fish, or a fishSickBatch summary —
 * then the queue cap. Pre-drain by construction: notify runs last, so the
 * buffer holds the whole tick.
 */
export function runNotifyTick(ctx: TickContext): void {
  syncNotificationSeq(ctx.state);
  const sick: { fishId: string }[] = [];
  for (const event of ctx.events) {
    const record = event as { kind: string; fishId?: unknown };
    if (record.kind === 'fishSick' && typeof record.fishId === 'string') sick.push({ fishId: record.fishId });
  }
  if (sick.length === 1) {
    const only = sick[0] as { fishId: string };
    ctx.state.notifications.push({
      id: nextNotifyId(ctx.rng),
      priority: 'warn',
      kind: 'fishSick',
      subjectId: only.fishId,
      message: `Fish ${only.fishId} is showing signs of sickness.`,
    });
  } else if (sick.length > 1) {
    ctx.state.notifications.push({
      id: nextNotifyId(ctx.rng),
      priority: 'warn',
      kind: 'fishSickBatch',
      message: `${sick.length} fish are showing signs of sickness.`,
    });
  }
  enforceQueueCap(ctx.state);
}

function nextNotifyId(rng: Rng): string {
  return `notif-sys-${rng.nextInt(0, 0xffffffff).toString(16).padStart(8, '0')}`;
}

export const commerceSystem: System = {
  id: 'u6.commerce',
  phase: 'commerce',
  run: runCommerceTick,
};

export const notifySystem: System = {
  id: 'u6.notify',
  phase: 'notify',
  run: runNotifyTick,
};

export function registerCommerce(registry: Registry): void {
  registry.registerSystem(commerceSystem);
  registry.registerSystem(notifySystem);
}

/** Orders currently fillable on the board (U7 board screen helper). */
export function boardOrders(state: GameState): GameState['orders'] {
  return openOrders(state);
}
