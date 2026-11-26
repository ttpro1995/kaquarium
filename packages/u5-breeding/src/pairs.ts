// pairs — U5 BreedingPair data model (BR14.1, BR15.4).
// Player-formed pair bonds: all pregnancy/cooldown state lives here, never
// on Fish. Pure helpers over U1's shared BreedingPair shape; the system and
// the pair/unpair handlers own the writes. No randomness except the seeded
// id draw in createPair (BR3.1/NFR3.1).
import type {
  BreedingPair,
  Fish,
  GameState,
  Species,
} from '@aquarium/u1-sim-foundation/state';
import type { Rng } from '@aquarium/u1-sim-foundation';

/** The three MVP archetypes that breed (BR14.1 eligibility gate). */
export const BREEDABLE_ARCHETYPES = ['livebearer', 'scatter', 'plant'] as const;

export type BreedableArchetype = (typeof BREEDABLE_ARCHETYPES)[number];

export function isBreedableArchetype(value: unknown): value is BreedableArchetype {
  return (
    value === 'livebearer' || value === 'scatter' || value === 'plant'
  );
}

export type PairingErrorCode = 'UNKNOWN_ENTITY' | 'INVALID_SETTING';

export interface PairingError {
  code: PairingErrorCode;
  message: string;
}

export type PairingCheck = { ok: true } | { ok: false; error: PairingError };

/** Catalogue lookup the caller owns (systems pass ctx.species.get). */
export type SpeciesOf = (speciesId: string) => Species | undefined;

/**
 * Eligibility check (BR14.1): both fish alive (UNKNOWN_ENTITY first —
 * precedence over every setting check), then sex slots, same species,
 * breeding archetype, maturity, and the gravid/cooling lock (re-pairing
 * never resets gestation or cooldown).
 */
export function validatePairing(
  state: GameState,
  speciesOf: SpeciesOf,
  femaleId: string,
  maleId: string,
): PairingCheck {
  const female: Fish | undefined = state.fish[femaleId];
  const male: Fish | undefined = state.fish[maleId];
  if (female === undefined || male === undefined) {
    return {
      ok: false,
      error: { code: 'UNKNOWN_ENTITY', message: 'Unknown fish in the pairing.' },
    };
  }
  if (female.sex !== 'female' || male.sex !== 'male') {
    return {
      ok: false,
      error: { code: 'INVALID_SETTING', message: 'Pair slots need a female and a male.' },
    };
  }
  if (female.speciesId !== male.speciesId) {
    return {
      ok: false,
      error: { code: 'INVALID_SETTING', message: 'A pair must share one species.' },
    };
  }
  const species = speciesOf(female.speciesId);
  if (species === undefined || !isBreedableArchetype(species.archetype)) {
    return {
      ok: false,
      error: { code: 'INVALID_SETTING', message: 'That species does not breed.' },
    };
  }
  if (!female.mature || !male.mature) {
    return {
      ok: false,
      error: { code: 'INVALID_SETTING', message: 'Only mature fish can pair.' },
    };
  }
  const live = findPairByFemale(state, femaleId);
  if (live !== undefined && live.state !== 'paired') {
    return {
      ok: false,
      error: {
        code: 'INVALID_SETTING',
        message: 'That female is already gravid or resting; unpair first.',
      },
    };
  }
  return { ok: true };
}

/** The live bond for a female, if any. One live pair per female. */
export function findPairByFemale(state: GameState, femaleId: string): BreedingPair | undefined {
  const pairs = state.pairs;
  for (const id in pairs) {
    const pair = pairs[id];
    if (pair !== undefined && pair.femaleId === femaleId) return pair;
  }
  return undefined;
}

/** Fresh pair id from the seeded stream (same hex pattern as U3/U4 ids). */
export function nextPairId(rng: Rng): string {
  return `pair-${rng.nextInt(0, 0xffffffff).toString(16).padStart(8, '0')}`;
}

/**
 * Create the bond (W21): paired with readyDay = today. Pairing an
 * already-paired female replaces the bond (BR14.1); callers validate first.
 */
export function createPair(
  state: GameState,
  rng: Rng,
  femaleId: string,
  maleId: string,
  today: number,
): BreedingPair {
  const live = findPairByFemale(state, femaleId);
  if (live !== undefined) delete state.pairs[live.id];
  const female = state.fish[femaleId];
  const pair: BreedingPair = {
    id: nextPairId(rng),
    femaleId,
    maleId,
    speciesId: female?.speciesId ?? '',
    state: 'paired',
    readyDay: today,
  };
  state.pairs[pair.id] = pair;
  return pair;
}

/**
 * Silent cleanup (BR15.4): dissolve every pair whose member is gone (sold,
 * died, never existed after load). Emits nothing; returns the removed ids.
 */
export function dissolveDeadPairs(state: GameState): string[] {
  const removed: string[] = [];
  const pairs = state.pairs;
  for (const id in pairs) {
    const pair = pairs[id];
    if (pair === undefined) continue;
    if (state.fish[pair.femaleId] === undefined || state.fish[pair.maleId] === undefined) {
      delete pairs[id];
      removed.push(id);
    }
  }
  return removed;
}

/**
 * Cooldown promotion (BR14.5): cooling pairs with today >= readyDay return
 * to paired. Returns the promoted ids.
 */
export function promoteCoolingPairs(state: GameState, today: number): string[] {
  const promoted: string[] = [];
  const pairs = state.pairs;
  for (const id in pairs) {
    const pair = pairs[id];
    if (pair !== undefined && pair.state === 'cooling' && today >= pair.readyDay) {
      pair.state = 'paired';
      promoted.push(id);
    }
  }
  return promoted;
}
