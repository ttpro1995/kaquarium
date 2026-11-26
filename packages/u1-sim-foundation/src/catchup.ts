// catchup — offline advance (BR7.1, FR11.1). On return, advances up to
// 8 game-days (192 ticks) through the same pipeline with catchUp=true,
// no rendering, one aggregated whileYouWereAway summary. After the cap
// the clock stops (speed 0 + paused) and remaining time is discarded.
// U3 suppresses lethal transitions under catchUp; the kernel threads
// the flag and aggregates the summary.
import type { SpeciesCatalog } from './species.js';
import type { Registry } from './registry.js';
import type { MutableStore } from './store.js';
import { drainEventBuffer, type BaseSimEvent, type SimEvent } from './events.js';
import { runTick } from './tick.js';

/** 8 game-days at the hourly simulation step. */
export const MAX_CATCH_UP_TICKS = 192;

export interface CatchUpSummary {
  elapsedDays: number;
  hatched: number;
  matured: number;
  diedOfOldAge: number;
  ordersExpired: number;
  ticksRun: number;
  capped: boolean;
}

export function runCatchUp(
  store: MutableStore,
  registry: Registry,
  species: SpeciesCatalog,
  elapsedGameHours: number,
): CatchUpSummary {
  const total = Math.max(0, Math.floor(elapsedGameHours));
  const ticks = Math.min(total, MAX_CATCH_UP_TICKS);
  const capped = total > MAX_CATCH_UP_TICKS;

  const counts = { hatched: 0, matured: 0, diedOfOldAge: 0, ordersExpired: 0 };
  // Reads through the permissive base on purpose: the catch-up summary
  // aggregates kinds owned by units that may not be in the program yet
  // (U3/U5/U6). Field access stays guarded by typeof checks below.
  const collector = (events: BaseSimEvent[]): void => {
    for (const event of events) {
      if (event.kind === 'fryHatched') {
        counts.hatched += typeof event.count === 'number' ? event.count : 1;
      } else if (event.kind === 'fishMatured') {
        counts.matured += 1;
      } else if (event.kind === 'fishDied' && event.cause === 'oldAge') {
        counts.diedOfOldAge += 1;
      } else if (event.kind === 'orderExpired') {
        counts.ordersExpired += 1;
      }
    }
  };
  const unsubscribe = store.subscribe(collector);
  try {
    for (let i = 0; i < ticks; i++) {
      runTick(store, registry, species, { catchUp: true });
    }
  } finally {
    unsubscribe();
  }

  // Stop the clock and discard remaining time.
  store.state.clock.speed = 0;
  store.state.clock.paused = true;

  const summary: CatchUpSummary = {
    elapsedDays: ticks / 24,
    ticksRun: ticks,
    capped,
    ...counts,
  };
  store.events.push({
    kind: 'whileYouWereAway',
    elapsedDays: summary.elapsedDays,
    hatched: summary.hatched,
    matured: summary.matured,
    diedOfOldAge: summary.diedOfOldAge,
    ordersExpired: summary.ordersExpired,
  });
  drainEventBuffer({
    state: store.state,
    buffer: store.events,
    subscribers: store.listeners,
    mapper: registry.getMapper(),
    species,
  });
  return summary;
}
