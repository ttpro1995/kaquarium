// events — typed sim-event union + the single shared buffer (C4).
// Systems append to ctx.events; command handlers append to ctx.events.
// One buffer serves both paths; one drain empties it after every tick
// and every command. Subscribers are read-only and isolated.
import type { GameState, Notification } from './types.js';
import type { SpeciesCatalog } from './species.js';

/** Open map: each producing unit augments its own variants (Q5-B). */
export interface SimEventMap {}

export type KnownSimEvent = {
  [K in keyof SimEventMap]: { kind: K } & SimEventMap[K];
}[keyof SimEventMap];

/** Generic carrier while no unit has augmented the map; the derived union once they have. */
export interface BaseSimEvent {
  kind: string;
  [key: string]: unknown;
}

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
