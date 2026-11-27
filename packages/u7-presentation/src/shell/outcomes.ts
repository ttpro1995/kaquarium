// outcomes — every dispatch call site maps its outcome through here (W38).
// ok → null (the caller refreshes from the store); err → a named message
// the panel renders at the originating row. Nothing is discarded: the
// helpers force the caller to handle both arms.
import type { CommandError, CommandOutcome } from '@aquarium/u1-sim-foundation/commands';

const FALLBACKS: Record<CommandError['code'], string> = {
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS: not enough $FISH.',
  TANK_FULL: 'TANK_FULL: the tank is at capacity.',
  FISH_UNSELLABLE: 'FISH_UNSELLABLE: that fish cannot be sold right now.',
  INVALID_QUANTITY: 'INVALID_QUANTITY: that quantity is not valid.',
  UNKNOWN_ENTITY: 'UNKNOWN_ENTITY: that item is no longer available.',
  NOT_AVAILABLE: 'NOT_AVAILABLE: that is not available yet.',
  INVALID_SETTING: 'INVALID_SETTING: those settings do not apply.',
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND: unknown command.',
};

/** Named message: the handler's player-safe text, always tagged with its code. */
export function errorMessage(error: CommandError): string {
  if (typeof error.message === 'string' && error.message.length > 0) {
    return error.message.includes(error.code) ? error.message : `[${error.code}] ${error.message}`;
  }
  return FALLBACKS[error.code] ?? `[${error.code}]`;
}

/** ok → null (refresh from store); err → named message (render at the row). */
export function outcomeMessage(outcome: CommandOutcome<unknown>): string | null {
  if (outcome.ok) return null;
  return errorMessage(outcome.error);
}
