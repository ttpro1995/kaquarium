// fish — U3 fish-phase system (W12, BR10.1–BR10.7).
// Runs after water (U2) and before breeding (U5) in the same tick:
// age → growth → satiety → health → stage → death. Reads water via
// the U2 selectors; never writes the Tank (BR11.3) — only Fish
// records under the single MVP tank, plus C4 events. All randomness
// flows through ctx.rng; this system draws none.
import type { GameState, Species } from '@aquarium/u1-sim-foundation/state';
import type { Registry, System, TickContext } from '@aquarium/u1-sim-foundation';
import { tempFitFor, waterQuality } from '@aquarium/u2-tank-water';
import { growthCondition, overcrowded, vigorBonus, sizeMultiplier } from './selectors.js';
import type { Genome } from './factories.js';
import './events.js';

/** Satiety lost per tick: empty in ~2 days unfed (BR10.2). */
export const SATIETY_DECAY = 100 / 48;

/** Health regained per tick when fed-and-clean, before vigor (BR10.3). */
export const REGEN_BASE = 2;

/** Stressor weights (BR10.3): hunger / poor water / temperature / crowding. */
export const HUNGER_WEIGHT = 2;

export const POOR_WATER_WEIGHT = 3;

export const TEMP_WEIGHT = 2;

export const CROWD_WEIGHT = 1;

/** Satiety below this line is hunger: no regen, growth stalls at 0. */
export const HUNGER_BELOW = 30;

/** Water quality below this line stresses; regen needs >= 60. */
export const POOR_WATER_BELOW = 40;

export const CLEAN_WATER_AT_LEAST = 60;

/** tempFit below this line stresses (U2 episodes open lower, at 0.5). */
export const TEMP_STRESS_BELOW = 0.7;

/** Adult→senior at this fraction of lifespanDays (BR10.5). */
export const SENIOR_FRACTION = 0.7;

/** Catch-up health floor: neglect never kills while catching up (BR10.7). */
export const CATCH_UP_HEALTH_FLOOR = 10;

/** Fallbacks when the catalogue lacks the species (mirrors U2's tolerant reads). */
export const FALLBACK_MATURITY_DAYS = 90;

export const FALLBACK_LIFESPAN_DAYS = 365;

function asGenome(fish: { genome: Record<string, unknown> }): Genome {
  return fish.genome as unknown as Genome;
}

/** A stage step the tick should apply: the new stage plus its event. */
export interface StageTransition {
  stage: 'adult' | 'senior';
}

/**
 * Pure stage rule (BR10.5): juvenile→adult at maturityDays, adult→senior
 * at SENIOR_FRACTION of lifespanDays. Returns the transition to apply,
 * or null when the stage holds. Never mutates; the tick applies and emits.
 *
 * Intentional: at most one transition per tick. A pre-aged juvenile whose
 * ageDays already clears the senior line — reachable only via a hand-built
 * or migrated save (spawn sets ageDays to 0 and live ticks accrue 1/24) —
 * converges over two ticks (adult, then senior) with one fishMatured event
 * each. Safe and needs no special-case jump; live play can never produce it.
 */
export function nextStage(
  stage: 'juvenile' | 'adult' | 'senior',
  ageDays: number,
  maturityDays: number,
  lifespanDays: number,
): StageTransition | null {
  if (stage === 'juvenile' && ageDays >= maturityDays) return { stage: 'adult' };
  if (stage === 'adult' && ageDays >= SENIOR_FRACTION * lifespanDays) return { stage: 'senior' };
  return null;
}

export type DeathCause = 'oldAge' | 'starvation' | 'waterQuality';

/**
 * Dominant-stressor cause for a neglect death (BR10.4): starvation
 * when hunger is active, otherwise the environmental bucket — poor
 * water, temperature, and crowding all read as waterQuality because
 * the U2 episodes already named the specific story.
 */
export function neglectCause(hunger: boolean): 'starvation' | 'waterQuality' {
  return hunger ? 'starvation' : 'waterQuality';
}

/**
 * Pure death rule (BR10.4, BR10.6, BR10.7): exact old age always wins;
 * neglect death is suppressed while catching up. Returns the cause to
 * record, or null when the fish lives.
 */
export function deathCause(args: {
  health: number;
  ageDays: number;
  lifespanDays: number;
  hunger: boolean;
  catchUp: boolean;
}): DeathCause | null {
  if (args.ageDays >= args.lifespanDays) return 'oldAge';
  if (!args.catchUp && args.health <= 0) return neglectCause(args.hunger);
  return null;
}

/** One fish-phase pass over every fish in the MVP tank (W12 steps 2–7). */
export function runFishTick(ctx: TickContext): void {
  const state: GameState = ctx.state;
  const tankId = state.tank.id;
  const quality = waterQuality(state);
  const crowded = overcrowded(state);
  const fish = state.fish;
  for (const id in fish) {
    const entry = fish[id];
    if (entry === undefined || entry.tankId !== tankId) continue;
    const species: Species | undefined = ctx.species.get(entry.speciesId);
    const genome = asGenome(entry);
    const maturityDays = species?.maturityDays ?? FALLBACK_MATURITY_DAYS;
    const lifespanDays = species?.lifespanDays ?? FALLBACK_LIFESPAN_DAYS;
    const adultSizeCm = species?.adultSizeCm ?? entry.sizeCm;

    // Step 2: age accrual, one game-hour.
    entry.ageDays += 1 / 24;

    // Step 3: saturating growth toward the genome-scaled adult size (BR10.1).
    // rate is calibrated so ideal care (condition 1) lands at 95% by maturityDays.
    const target = adultSizeCm * sizeMultiplier(genome) * (entry.stunted ? 0.8 : 1);
    const rate = maturityDays > 0 ? 1 - 0.05 ** (1 / (maturityDays * 24)) : 0;
    const condition = growthCondition(state, entry, species);
    entry.sizeCm = Math.max(0, entry.sizeCm + (target - entry.sizeCm) * rate * condition);

    // Step 4: satiety decay; only U4 feeding restores (BR10.2, BR11.3).
    entry.satiety = Math.max(0, entry.satiety - SATIETY_DECAY);

    // Step 5: regen-minus-stressors health plus the stress display (BR10.3).
    const hunger = entry.satiety < HUNGER_BELOW;
    const poorWater = quality < POOR_WATER_BELOW;
    const cold = tempFitFor(state, species) < TEMP_STRESS_BELOW;
    let loss = 0;
    let worst = 0;
    if (hunger) {
      loss += HUNGER_WEIGHT;
      worst = Math.max(worst, HUNGER_WEIGHT);
    }
    if (poorWater) {
      loss += POOR_WATER_WEIGHT;
      worst = Math.max(worst, POOR_WATER_WEIGHT);
    }
    if (cold) {
      loss += TEMP_WEIGHT;
      worst = Math.max(worst, TEMP_WEIGHT);
    }
    if (crowded) {
      loss += CROWD_WEIGHT;
      worst = Math.max(worst, CROWD_WEIGHT);
    }
    const regen = entry.satiety >= HUNGER_BELOW && quality >= CLEAN_WATER_AT_LEAST
      ? REGEN_BASE + vigorBonus(genome)
      : 0;
    entry.health = Math.min(100, Math.max(0, entry.health + regen - loss));
    entry.stress = worst === 0 ? 0 : 25 * worst;
    if (ctx.catchUp && entry.health < CATCH_UP_HEALTH_FLOOR) {
      entry.health = CATCH_UP_HEALTH_FLOOR;
    }

    // Step 6: age-driven stage transitions with events (BR10.5).
    const transition = nextStage(entry.stage, entry.ageDays, maturityDays, lifespanDays);
    if (transition !== null) {
      entry.stage = transition.stage;
      entry.mature = true;
      ctx.events.push({ kind: 'fishMatured', fishId: entry.id, stage: transition.stage });
    }

    // Step 7: death. Old age is exact and proceeds under catch-up;
    // neglect death is skipped entirely while catching up (BR10.4, BR10.6, BR10.7).
    const cause = deathCause({
      health: entry.health,
      ageDays: entry.ageDays,
      lifespanDays,
      hunger,
      catchUp: ctx.catchUp,
    });
    if (cause !== null) {
      delete fish[id];
      ctx.events.push({ kind: 'fishDied', fishId: entry.id, cause });
    }
  }
}

export const fishSystem: System = {
  id: 'u3.fish',
  phase: 'fish',
  run: runFishTick,
};

export function registerFish(registry: Registry): void {
  registry.registerSystem(fishSystem);
}
