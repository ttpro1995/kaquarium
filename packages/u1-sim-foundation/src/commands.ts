// commands — bus envelope, outcome union, and U1's own catalogue (C3).
// Each handling unit declares payloads/results by augmenting CommandMap
// (type side) and registering the handler (runtime side); the runtime
// mirror below keeps the halves checkable (BR4.2).
import type { GameClock, GameState, GameTime, Settings } from './types.js';
import type { Rng } from './rng.js';
import type { SpeciesCatalog } from './species.js';
import type { SimEvent } from './events.js';

export interface CommandMap {
  'settings.update': {
    payload: { reducedMotion?: boolean; autoPauseCritical?: boolean; volume?: { master?: number; sfx?: number } };
    result: { settings: Settings };
  };
  'clock.setSpeed': { payload: { speed: 0 | 1 | 2 | 4 }; result: { clock: GameClock } };
  'clock.setPaused': { payload: { paused: boolean }; result: { clock: GameClock } };
}

export interface CommandContext {
  now: GameTime;
  rng: Rng;
  species: SpeciesCatalog;
  events: SimEvent[]; // append-only; the only way a command produces events
}

export type CommandOutcome<V> = { ok: true; value: V } | { ok: false; error: CommandError };

export interface CommandError {
  code: CommandErrorCode;
  message: string; // safe to show the player
}

export type CommandErrorCode =
  | 'INSUFFICIENT_FUNDS'
  | 'TANK_FULL'
  | 'FISH_UNSELLABLE'
  | 'INVALID_QUANTITY'
  | 'UNKNOWN_ENTITY'
  | 'NOT_AVAILABLE'
  | 'INVALID_SETTING'
  | 'UNKNOWN_COMMAND';

export type CommandHandler<P, V> = (
  state: GameState,
  payload: P,
  ctx: CommandContext,
) => CommandOutcome<V>;

/** Runtime mirror of the open CommandMap: each unit declares its types here at import. */
const declaredTypes = new Set<string>(['settings.update', 'clock.setSpeed', 'clock.setPaused']);

export function declareCommandType(type: string): void {
  declaredTypes.add(type);
}

export function declaredCommandTypes(): readonly string[] {
  return [...declaredTypes].sort();
}
