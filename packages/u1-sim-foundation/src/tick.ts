// tick — the fixed 1-game-hour pipeline (BR1.1, BR4.1). One tick runs
// every phase in order, then the C4 drain, then bumps version once and
// marks dirty. Ticks are discrete and never partial. A throwing system
// halts the loop and records a memory-only fault (NFR4.2); the store is
// not rolled back — the last autosave is the recovery point.
import type { SpeciesCatalog } from './species.js';
import type { Registry, TickContext } from './registry.js';
import type { MutableStore } from './store.js';
import { drainEventBuffer } from './events.js';
import { createRng } from './rng.js';

export interface TickResult {
  tick: number;
}

export function runTick(
  store: MutableStore,
  registry: Registry,
  species: SpeciesCatalog,
  opts?: { catchUp?: boolean },
): TickResult {
  if (store.halted) {
    const fault = store.getFault();
    throw new Error(
      `tick loop halted${fault ? ` at tick ${fault.tick} (${fault.systemId})` : ''}: reload the last autosave`,
    );
  }
  const tick = store.tickCount + 1;

  // Advance the clock first: one game hour, rolling into the next day.
  const clock = store.state.clock;
  const nextHour = clock.gameHour + 1;
  if (nextHour >= 24) {
    clock.gameHour = 0;
    clock.gameDay += 1;
  } else {
    clock.gameHour = nextHour;
  }

  const ctx: TickContext = {
    state: store.state,
    tick,
    now: { day: clock.gameDay, hour: clock.gameHour },
    rng: createRng(store.state.rngState),
    species,
    events: store.events,
    catchUp: opts?.catchUp ?? false,
  };

  for (const system of registry.systemsSorted()) {
    try {
      system.run(ctx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.halted = true;
      store.fault = { tick, systemId: system.id, message };
      throw error;
    }
  }

  drainEventBuffer({
    state: store.state,
    buffer: store.events,
    subscribers: store.listeners,
    mapper: registry.getMapper(),
    species,
  });

  store.tickCount = tick;
  store.version += 1;
  store.dirty = true;
  return { tick };
}
