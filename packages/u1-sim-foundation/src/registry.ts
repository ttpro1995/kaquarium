// registry — system/command/mapper registration (C2). U1 sorts systems
// by declared phase, never by registration sequence, so live play,
// reload, and catch-up run identically. Duplicates are dev-time errors.
import type { GameState, GameTime } from './types.js';
import type { Rng } from './rng.js';
import type { SpeciesCatalog } from './species.js';
import type { NotificationMapper, SimEvent } from './events.js';
import { declaredCommandTypes, type CommandHandler, type CommandMap } from './commands.js';

export type Phase = 'feeding' | 'water' | 'fish' | 'breeding' | 'commerce' | 'notify';

export const PHASE_ORDER: readonly Phase[] = [
  'feeding',
  'water',
  'fish',
  'breeding',
  'commerce',
  'notify',
];

export interface TickContext {
  state: GameState; // mutable contents; a system mutates only entities its unit owns
  tick: number; // monotonic tick counter
  now: GameTime; // { day, hour }
  rng: Rng; // the single seeded stream
  species: SpeciesCatalog; // read-only content
  events: SimEvent[]; // append-only during the tick; never read back to drive state
  catchUp: boolean; // true only for the offline advance
}

export interface System {
  id: string; // '<unit>.<name>', unique across the app
  phase: Phase;
  run(ctx: TickContext): void;
}

export interface Registry {
  registerSystem(system: System): void;
  registerCommand<K extends keyof CommandMap>(
    type: K,
    handler: CommandHandler<CommandMap[K]['payload'], CommandMap[K]['result']>,
  ): void;
  registerNotificationMapper(map: NotificationMapper): void;
  /** Build/dev-boot gate (BR4.2): every declared command has a handler. */
  assertExhaustive(): void;
  systemsSorted(): System[];
  getHandler(type: string): CommandHandler<never, unknown> | undefined;
  getMapper(): NotificationMapper | null;
  registeredCommandTypes(): string[];
}

export function createRegistry(): Registry {
  const systems: Array<{ system: System; index: number }> = [];
  const handlers = new Map<string, CommandHandler<never, unknown>>();
  let mapper: NotificationMapper | null = null;

  return {
    registerSystem(system: System): void {
      if (systems.some((s) => s.system.id === system.id)) {
        throw new Error(`registerSystem: duplicate system id '${system.id}'`);
      }
      if (!PHASE_ORDER.includes(system.phase)) {
        throw new Error(`registerSystem: unknown phase '${system.phase}'`);
      }
      systems.push({ system, index: systems.length });
    },
    registerCommand(type, handler): void {
      if (handlers.has(type as string)) {
        throw new Error(`registerCommand: duplicate command type '${type as string}'`);
      }
      handlers.set(type as string, handler as CommandHandler<never, unknown>);
    },
    registerNotificationMapper(map: NotificationMapper): void {
      if (mapper) throw new Error('registerNotificationMapper: a mapper is already registered');
      mapper = map;
    },
    assertExhaustive(): void {
      const missing = declaredCommandTypes().filter((t) => !handlers.has(t));
      if (missing.length > 0) {
        throw new Error(`assertExhaustive: missing handlers for ${missing.join(', ')}`);
      }
    },
    systemsSorted(): System[] {
      return [...systems]
        .sort(
          (a, b) =>
            PHASE_ORDER.indexOf(a.system.phase) - PHASE_ORDER.indexOf(b.system.phase) ||
            a.index - b.index,
        )
        .map((entry) => entry.system);
    },
    getHandler(type: string): CommandHandler<never, unknown> | undefined {
      return handlers.get(type);
    },
    getMapper(): NotificationMapper | null {
      return mapper;
    },
    registeredCommandTypes(): string[] {
      return [...handlers.keys()].sort();
    },
  };
}
