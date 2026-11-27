// events — typed sim-event union + the single shared buffer (C4).
// Systems append to ctx.events; command handlers append to ctx.events.
// One buffer serves both paths; one drain empties it after every tick
// and every command. Subscribers are read-only and isolated.
import type { GameState, Notification } from './types.js';
import type { SpeciesCatalog } from './species.js';

/** Open map: each producing unit augments its own variants (Q5-B). U1 owns whileYouWereAway (catch-up summary). */
export interface SimEventMap {
  whileYouWereAway: {
    elapsedDays: number;
    hatched: number;
    matured: number;
    diedOfOldAge: number;
    ordersExpired: number;
  };
}

/**
 * Canonical C2 purchase-path money shape (U6-owned): validate-first,
 * deduct-or-reject atomic, one moneyChanged per accepted call.
 * Declared once here so U2, U4, and U6 reuse it identically by
 * construction; the runtime key-set pin lives in the U4 suite.
 */
export type MoneyChangedPayload = {
  delta: number;
  balance: number;
};

export type KnownSimEvent = {
  [K in keyof SimEventMap]: { kind: K } & SimEventMap[K];
}[keyof SimEventMap];

/** Generic carrier while no unit has augmented the map; the derived union once they have. */
export interface BaseSimEvent {
  kind: string;
  [key: string]: unknown;
}

// Long-term shape (review note): keep this conditional guard. It lets U1's
// own suites (catch-up collector, drain tests) read through BaseSimEvent for
// foreign kinds owned by units not yet in the program, while the full program
// regains the exact KnownSimEvent union. If the guard is ever removed, every
// foreign-kind read must go through one standardised helper (the `foreign()`
// test double pattern used in U1 src/tests) rather than ad-hoc casts.
export type SimEvent = keyof SimEventMap extends never ? BaseSimEvent : KnownSimEvent;

export type NotificationMapper = (event: SimEvent, species: SpeciesCatalog) => Notification | null;

export type SimEventSubscriber = (events: SimEvent[]) => void;

/**
 * Drain sequence (C4): mapper → deliver → clear.
 * Pure reads of the buffer; appends Notifications to state; a throwing
 * subscriber never stops delivery to the others (NFR4.6).
 */
export function drainEventBuffer(args: {
  state: GameState;
  buffer: SimEvent[];
  subscribers: readonly SimEventSubscriber[];
  mapper: NotificationMapper | null;
  species: SpeciesCatalog;
}): void {
  if (args.mapper) {
    for (const event of args.buffer) {
      const notification = args.mapper(event, args.species);
      if (notification) args.state.notifications.push(notification);
    }
  }
  const batch = [...args.buffer];
  args.buffer.length = 0;
  for (const subscriber of args.subscribers) {
    try {
      subscriber(batch);
    } catch {
      // isolated by contract: one bad subscriber never stops the rest
    }
  }
}
