// commands — U5 command handlers (W21, W25; BR14.1, BR15.3).
// Each unit declares its command payloads/results by augmenting U1's
// CommandMap (type side) and registering the handler (runtime side).
// Handlers validate first, then mutate, then emit: a rejection leaves the
// store untouched by construction, never by rollback. A signal is a
// returned outcome union, never an exception.
import type { GameState } from '@aquarium/u1-sim-foundation/state';
import { validateSpeciesEntry } from '@aquarium/u1-sim-foundation';
import {
  declareCommandType,
  type CommandHandler,
} from '@aquarium/u1-sim-foundation/commands';
import type { Registry } from '@aquarium/u1-sim-foundation';
import { activityOf, COHORT_LOAD_PER_FRY } from '@aquarium/u2-tank-water';
import { inheritGenome, spawnFish, SPAWN_SATIETY, type Genome, type SpawnedFish } from '@aquarium/u3-fish';
import { createPair, validatePairing } from './pairs.js';
import { stuntedAtGrading } from './cohorts.js';
import './events.js';

export interface PairPayload {
  femaleId: string;
  maleId: string;
}

export interface PairResult {
  pairId: string;
}

export interface UnpairPayload {
  pairId: string;
}

export interface UnpairResult {
  removed: true;
}

export interface GradePayload {
  cohortId: string;
  count: number;
}

export interface GradeResult {
  graded: number;
  stunted: number;
}

declare module '@aquarium/u1-sim-foundation/commands' {
  interface CommandMap {
    'breeding.pair': { payload: PairPayload; result: PairResult };
    'breeding.unpair': { payload: UnpairPayload; result: UnpairResult };
    'breeding.grade': { payload: GradePayload; result: GradeResult };
  }
}

declareCommandType('breeding.pair');
declareCommandType('breeding.unpair');
declareCommandType('breeding.grade');

/** Nursery load each ungraded fry already carries (U2 W7, BR8.6). Single source: U2's constant. */
export const NURSERY_LOAD_PER_FRY = COHORT_LOAD_PER_FRY;

/**
 * W21 pair (BR14.1): UNKNOWN_ENTITY for a missing fish (precedence over
 * every setting check), INVALID_SETTING for slots/species/archetype/
 * immaturity and the gravid/cooling lock. No event on pairing.
 */
export const pair: CommandHandler<PairPayload, PairResult> = (
  state,
  payload,
  ctx,
) => {
  const body = (payload as Partial<PairPayload> | null) ?? {};
  if (typeof body.femaleId !== 'string' || typeof body.maleId !== 'string') {
    return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: 'Unknown fish in the pairing.' } };
  }
  const checked = validatePairing(state, (id) => ctx.species.get(id), body.femaleId, body.maleId);
  if (!checked.ok) return { ok: false, error: checked.error };
  const bond = createPair(state, ctx.rng, body.femaleId, body.maleId, state.clock.gameDay);
  return { ok: true, value: { pairId: bond.id } };
};

/** W21 unpair (BR14.1): unknown bonds reject; gravid progress is lost. */
export const unpair: CommandHandler<UnpairPayload, UnpairResult> = (
  state,
  payload,
  _ctx,
) => {
  const body = (payload as Partial<UnpairPayload> | null) ?? {};
  if (typeof body.pairId !== 'string' || state.pairs[body.pairId] === undefined) {
    return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: 'Unknown pair.' } };
  }
  delete state.pairs[body.pairId];
  return { ok: true, value: { removed: true } };
};

/** A genome-shaped value U3's inheritGenome can mix (tolerant read). */
function isGenomeLike(value: unknown): value is Genome {
  if (typeof value !== 'object' || value === null) return false;
  const loci = ['hue', 'pattern', 'tail', 'size', 'vigor'] as const;
  const record = value as Record<string, unknown>;
  return loci.every((locus) => {
    const pair = record[locus];
    return (
      Array.isArray(pair) &&
      pair.length === 2 &&
      (pair[0] === 0 || pair[0] === 1) &&
      (pair[1] === 0 || pair[1] === 1)
    );
  });
}

/**
 * W25 grade (BR15.2, BR15.3): UNKNOWN_ENTITY (cohort, then catalogue —
 * a missing entry or one spawnFish would reject) >
 * INVALID_SETTING (eggs / not ready) > INVALID_QUANTITY > TANK_FULL (batch
 * formula, all-or-nothing). Creates N Fish per U3's field rules with
 * parents set and the first-food stunt flag; the remainder stays.
 * Guard reads the last water-phase cached tank.bioload (recomputed once
 * per tick in the water phase, never mid-command), so back-to-back grades
 * in the same tick share the same cached base — never a live recompute.
 */
export const grade: CommandHandler<GradePayload, GradeResult> = (
  state,
  payload,
  ctx,
) => {
  const body = (payload as Partial<GradePayload> | null) ?? {};
  const cohort = typeof body.cohortId === 'string' ? state.cohorts[body.cohortId] : undefined;
  if (cohort === undefined) {
    return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: 'Unknown cohort.' } };
  }
  const species = ctx.species.get(cohort.speciesId);
  if (species === undefined || validateSpeciesEntry(species).length > 0) {
    return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: 'Unknown species for the cohort.' } };
  }
  if (cohort.stage === 'eggs' || cohort.ageDays < species.juvenileDays) {
    return { ok: false, error: { code: 'INVALID_SETTING', message: 'That cohort is not ready to grade.' } };
  }
  const count = body.count;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > cohort.count) {
    return { ok: false, error: { code: 'INVALID_QUANTITY', message: 'Grade count must be within the cohort.' } };
  }
  // Batch formula (BR15.3): only the leaving share converts to newborn
  // load; the remainder keeps its nursery 0.05 each. All-or-nothing.
  // Newborns arrive at SPAWN_SATIETY (80 → activity 1.2), so each graded
  // fry lands at adultSizeCm × 1.2 — the guard projects that newborn
  // activity, never the 1.0-activity adult size. Never an under-estimate:
  // the true post-grade load (recomputed next water phase) is always ≤
  // this projection while newborn satiety stays in the ≥70 band.
  const projectedLoad =
    state.tank.bioload + count * (species.adultSizeCm * activityOf(SPAWN_SATIETY) - COHORT_LOAD_PER_FRY);
  if (projectedLoad > state.tank.volumeL) {
    return { ok: false, error: { code: 'TANK_FULL', message: 'The tank cannot hold that many adults.' } };
  }
  const pool = cohort.genomePool as Record<string, unknown>;
  const sire = pool.sire;
  const dam = pool.dam;
  const sireId = typeof pool.sireId === 'string' ? pool.sireId : null;
  const damId = typeof pool.damId === 'string' ? pool.damId : null;
  const stunted = stuntedAtGrading(cohort, species.juvenileDays);
  let stuntedCount = 0;
  for (let i = 0; i < count; i++) {
    const base = spawnFish(state, species, ctx.rng);
    const genome = isGenomeLike(sire) && isGenomeLike(dam)
      ? inheritGenome(ctx.rng, sire, dam)
      : base.genome;
    const fish: SpawnedFish = {
      ...base,
      genome,
      stunted,
      parents: sireId !== null && damId !== null ? [damId, sireId] : null,
    };
    if (stunted) stuntedCount++;
    state.fish[fish.id] = fish;
  }
  cohort.count -= count;
  if (cohort.count <= 0) delete state.cohorts[cohort.id];
  ctx.events.push({ kind: 'cohortGraded', cohortId: cohort.id, count });
  return { ok: true, value: { graded: count, stunted: stuntedCount } };
};

export function registerCommands(registry: Registry): void {
  registry.registerCommand('breeding.pair', pair);
  registry.registerCommand('breeding.unpair', unpair);
  registry.registerCommand('breeding.grade', grade);
}
