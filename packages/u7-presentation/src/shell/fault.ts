// fault — tick-abort fault surfacing and reload-to-autosave (W46; C2).
// A throwing system halts the loop and records a memory-only fault; the
// drain never runs, so subscribers learn nothing — App polls through this
// hub after every driven frame. Recovery is load-the-last-autosave only:
// U7 never attempts store rollback (C2: the last successful autosave is
// the recovery point; replaceStoreState clears the fault and the halt).
import type { Kernel } from '@aquarium/u1-sim-foundation';

export interface FaultInfo {
  tick: number;
  systemId: string;
  message: string;
}

export type FaultListener = (fault: FaultInfo | null) => void;

const listenersByKernel = new WeakMap<Kernel, Set<FaultListener>>();
const lastByKernel = new WeakMap<Kernel, FaultInfo | null>();

function sameFault(a: FaultInfo | null, b: FaultInfo | null): boolean {
  if (a === null || b === null) return a === b;
  return a.tick === b.tick && a.systemId === b.systemId && a.message === b.message;
}

/** Read-only poll of the memory-only fault record. */
export function checkFault(kernel: Kernel): FaultInfo | null {
  const fault = kernel.store.getFault();
  if (fault === null) return null;
  return { tick: fault.tick, systemId: fault.systemId, message: fault.message };
}

function listenersFor(kernel: Kernel): Set<FaultListener> {
  let set = listenersByKernel.get(kernel);
  if (set === undefined) {
    set = new Set();
    listenersByKernel.set(kernel, set);
  }
  return set;
}

/** Subscribe to fault transitions for one kernel. Immediately sends current. */
export function watchFaults(kernel: Kernel, listener: FaultListener): () => void {
  const set = listenersFor(kernel);
  set.add(listener);
  listener(checkFault(kernel));
  return () => {
    set.delete(listener);
  };
}

/** Poll and emit only on change (fault raised or fault cleared). */
export function notifyFault(kernel: Kernel): void {
  const current = checkFault(kernel);
  const last = lastByKernel.has(kernel) ? (lastByKernel.get(kernel) as FaultInfo | null) : undefined;
  if (last !== undefined && sameFault(last, current)) return;
  lastByKernel.set(kernel, current);
  for (const listener of [...(listenersByKernel.get(kernel) ?? [])]) listener(current);
}

/**
 * Drive one tick the way the App frame loop does: a throwing system is
 * caught here (its record lives on the store) and surfaced through the
 * hub — the fault panel CAN trigger because every frame ends in a poll.
 */
export function driveTick(kernel: Kernel): void {
  try {
    kernel.tick();
  } catch {
    // Recorded on the store by the tick; surfaced below. Never rethrown
    // into the render loop.
  }
  notifyFault(kernel);
}

export interface ReloadResult {
  ok: boolean;
  message: string | null;
}

/** Reload the newest autosave slot. Never a rollback: the state comes
 *  from storage through the SaveLoadApi, which clears the fault + halt. */
export function reloadToAutosave(kernel: Kernel): ReloadResult {
  const autos = kernel.saves
    .listSlots()
    .filter((slot) => slot.ref.kind === 'auto')
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
  const latest = autos[0];
  if (latest === undefined) {
    return { ok: false, message: '[SLOT_NOT_FOUND] No autosave exists yet.' };
  }
  const outcome = kernel.saves.load(latest.ref);
  if (!outcome.ok) {
    const { code, message } = outcome.error;
    return { ok: false, message: message.includes(code) ? message : `[${code}] ${message}` };
  }
  notifyFault(kernel);
  return { ok: true, message: null };
}
