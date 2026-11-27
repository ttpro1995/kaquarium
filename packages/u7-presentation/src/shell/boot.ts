// boot — composition root (W47; C2, C5, C6).
// Builds the store from the U1 factory, registers each sim unit (call order
// imposes no sim order — U1 sorts by phase), asserts the command catalogue
// is exhaustive, and hands the shell store to the Svelte shell. Species
// load in prod mode: invalid entries are excluded + logged, never a crash.
import {
  createKernel,
  type CatalogMode,
  type Kernel,
  type SaveSystemLogger,
} from '@aquarium/u1-sim-foundation';
import { register as registerWater } from '@aquarium/u2-tank-water';
import { register as registerFish } from '@aquarium/u3-fish';
import { register as registerFeeding } from '@aquarium/u4-feeding';
import { register as registerBreeding } from '@aquarium/u5-breeding';
import { register as registerCommerce } from '@aquarium/u6-commerce';
import { createShellStore, type ShellStore } from './store.js';

export interface SpeciesFile {
  file: string;
  data: unknown;
}

export interface BootOptions {
  seed?: number;
  now?: () => string;
  speciesFiles?: SpeciesFile[];
  speciesMode?: CatalogMode;
  logger?: SaveSystemLogger;
}

export interface AppKernel {
  kernel: Kernel;
  store: ShellStore;
}

const FALLBACK_SEED = 20261113;

/** Deterministic default seed with a `?seed=` override. No wall-clock
 *  entropy in the shell: the seeded stream takes over after boot. */
export function readSeed(): number {
  try {
    const location = (globalThis as { location?: { search?: string } }).location;
    const search = typeof location?.search === 'string' ? location.search : '';
    const match = /(?:^|[?&])seed=(\d{1,10})/.exec(search);
    if (match?.[1] !== undefined) return Number(match[1]) >>> 0 || FALLBACK_SEED;
  } catch {
    // Non-browser host: fall through to the fixed seed.
  }
  return FALLBACK_SEED;
}

export function createAppKernel(opts: BootOptions = {}): AppKernel {
  const kernel = createKernel(opts.seed ?? readSeed(), {
    ...(opts.now !== undefined ? { now: opts.now } : {}),
    speciesFiles: opts.speciesFiles ?? [],
    speciesMode: opts.speciesMode ?? 'prod',
    logger: opts.logger ?? console,
  });
  registerWater(kernel.registry);
  registerFish(kernel.registry);
  registerFeeding(kernel.registry);
  registerBreeding(kernel.registry);
  registerCommerce(kernel.registry);
  kernel.registry.assertExhaustive();
  const store = createShellStore(kernel);
  return { kernel, store };
}
