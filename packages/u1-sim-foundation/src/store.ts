// store — the single shared container (C1). Exactly three writers touch
// GameState: command handlers, registered systems, and U1 kernel ops.
// U7 reads. Version bumps once per completed tick and per accepted
// command; a rejected command never bumps it.
import type { GameState } from './types.js';
import type { SimEvent, SimEventSubscriber } from './events.js';

export interface FaultDescriptor {
  tick: number;
  systemId: string;
  message: string;
}

export interface Store {
  state: GameState;
  version: number;
  dirty: boolean;
  tickCount: number;
  halted: boolean;
  subscribe(listener: SimEventSubscriber): () => void;
  /** Memory-only fault record (NFR4.2); null until a system throws. Never serialized. */
  getFault(): FaultDescriptor | null;
}

/** Kernel-internal view: the shared buffer and listener list tick/drain share. */
export interface MutableStore extends Store {
  events: SimEvent[];
  listeners: SimEventSubscriber[];
  fault: FaultDescriptor | null;
}

export function createStore(initial: GameState): MutableStore {
  const store: MutableStore = {
    state: initial,
    version: 0,
    dirty: false,
    tickCount: 0,
    halted: false,
    events: [],
    listeners: [],
    fault: null,
    subscribe(listener: SimEventSubscriber): () => void {
      store.listeners.push(listener);
      return () => {
        const index = store.listeners.indexOf(listener);
        if (index >= 0) store.listeners.splice(index, 1);
      };
    },
    getFault(): FaultDescriptor | null {
      return store.fault;
    },
  };
  return store;
}

/** U7's recovery path: swap in the last good save and clear the fault. */
export function replaceStoreState(store: MutableStore, state: GameState): void {
  store.state = state;
  store.events.length = 0;
  store.fault = null;
  store.halted = false;
  store.dirty = false;
}
