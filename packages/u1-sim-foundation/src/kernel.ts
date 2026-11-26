// kernel — composition helper for U7's construction root (W1). U7 builds
// the store from this factory with a fixed seed (new game), registers
// each sim unit, and mounts the app. U1 never imports U2–U6; units
// register themselves against the registry returned here.
import type { CommandMap, CommandOutcome } from './commands.js';
import type { MutableStore } from './store.js';
import type { Registry } from './registry.js';
import type { SpeciesCatalog } from './species.js';
import type { SaveLoadApi, SaveSystemLogger, StoragePort } from './persistence/persistence.js';
import { createInitialState } from './types.js';
import { createStore } from './store.js';
import { createRegistry } from './registry.js';
import { emptyCatalog, loadSpeciesCatalog, type CatalogMode } from './species.js';
import { registerKernelCommands, dispatchCommand } from './bus.js';
import { runTick, type TickResult } from './tick.js';
import { runCatchUp, type CatchUpSummary } from './catchup.js';
import { createSaveSystem, MemoryStorage } from './persistence/persistence.js';

export interface KernelOptions {
  now?: () => string;
  logger?: SaveSystemLogger;
  migrations?: Record<number, (state: unknown) => unknown>;
  speciesFiles?: ReadonlyArray<{ file: string; data: unknown }>;
  speciesMode?: CatalogMode;
  primary?: StoragePort;
  fallback?: StoragePort;
}

export interface Kernel {
  store: MutableStore;
  registry: Registry;
  species: SpeciesCatalog;
  saves: SaveLoadApi;
  dispatch<K extends keyof CommandMap>(
    type: K,
    payload: CommandMap[K]['payload'],
  ): CommandOutcome<CommandMap[K]['result']>;
  tick(opts?: { catchUp?: boolean }): TickResult;
  catchUp(elapsedGameHours: number): CatchUpSummary;
}

export function createKernel(seed: number, opts: KernelOptions = {}): Kernel {
  const store = createStore(createInitialState(seed));
  const registry = createRegistry();
  registerKernelCommands(registry);
  const species = opts.speciesFiles
    ? loadSpeciesCatalog(opts.speciesFiles, {
        mode: opts.speciesMode ?? 'dev',
        ...(opts.logger !== undefined ? { logger: opts.logger } : {}),
      })
    : emptyCatalog();
  const saves = createSaveSystem({
    store,
    primary: opts.primary ?? new MemoryStorage(),
    ...(opts.fallback !== undefined ? { fallback: opts.fallback } : {}),
    ...(opts.now !== undefined ? { now: opts.now } : {}),
    ...(opts.logger !== undefined ? { logger: opts.logger } : {}),
    ...(opts.migrations !== undefined ? { migrations: opts.migrations } : {}),
  });
  return {
    store,
    registry,
    species,
    saves,
    dispatch: <K extends keyof CommandMap>(type: K, payload: CommandMap[K]['payload']) =>
      dispatchCommand(store, registry, species, type, payload),
    tick: (tickOpts) => runTick(store, registry, species, tickOpts),
    catchUp: (elapsedGameHours) => runCatchUp(store, registry, species, elapsedGameHours),
  };
}
