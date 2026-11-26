// bus — command dispatch over mutable state (C3, BR3.1). A handler
// validates, then mutates, then returns: every mutation path returns
// before it writes, so a rejection leaves the store untouched by
// construction. A signal is a returned outcome union, never an exception.
// Accepted commands run the C4 drain, bump version once, mark dirty.
import type { GameState } from './types.js';
import type { MutableStore } from './store.js';
import type { Registry } from './registry.js';
import type { SpeciesCatalog } from './species.js';
import { drainEventBuffer } from './events.js';
import { createRng } from './rng.js';
import {
  type CommandContext,
  type CommandHandler,
  type CommandMap,
  type CommandOutcome,
} from './commands.js';

export { declareCommandType, declaredCommandTypes } from './commands.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function settingsUpdate(
  state: GameState,
  payload: CommandMap['settings.update']['payload'],
  _ctx: CommandContext,
): CommandOutcome<CommandMap['settings.update']['result']> {
  if (!isRecord(payload)) {
    return { ok: false, error: { code: 'INVALID_SETTING', message: 'Settings payload must be an object.' } };
  }
  const { reducedMotion, autoPauseCritical, volume } = payload as Record<string, unknown>;
  if (reducedMotion !== undefined && typeof reducedMotion !== 'boolean') {
    return { ok: false, error: { code: 'INVALID_SETTING', message: 'reducedMotion must be a boolean.' } };
  }
  if (autoPauseCritical !== undefined && typeof autoPauseCritical !== 'boolean') {
    return { ok: false, error: { code: 'INVALID_SETTING', message: 'autoPauseCritical must be a boolean.' } };
  }
  if (volume !== undefined) {
    if (!isRecord(volume)) {
      return { ok: false, error: { code: 'INVALID_SETTING', message: 'volume must be an object.' } };
    }
    for (const key of ['master', 'sfx'] as const) {
      const v = (volume as Record<string, unknown>)[key];
      if (v !== undefined && (typeof v !== 'number' || Number.isNaN(v) || v < 0 || v > 1)) {
        return { ok: false, error: { code: 'INVALID_SETTING', message: `volume.${key} must be a number 0..1.` } };
      }
    }
  }
  if (typeof reducedMotion === 'boolean') state.settings.reducedMotion = reducedMotion;
  if (typeof autoPauseCritical === 'boolean') state.settings.autoPauseCritical = autoPauseCritical;
  if (isRecord(volume)) {
    const v = volume as { master?: unknown; sfx?: unknown };
    if (typeof v.master === 'number') state.settings.volume.master = v.master;
    if (typeof v.sfx === 'number') state.settings.volume.sfx = v.sfx;
  }
  return { ok: true, value: { settings: state.settings } };
}

function clockSetSpeed(
  state: GameState,
  payload: CommandMap['clock.setSpeed']['payload'],
  _ctx: CommandContext,
): CommandOutcome<CommandMap['clock.setSpeed']['result']> {
  const speed = (payload as { speed?: unknown } | null)?.speed;
  if (speed !== 0 && speed !== 1 && speed !== 2 && speed !== 4) {
    return { ok: false, error: { code: 'NOT_AVAILABLE', message: 'Speed must be one of 0, 1, 2 or 4.' } };
  }
  state.clock.speed = speed;
  state.clock.paused = speed === 0;
  return { ok: true, value: { clock: state.clock } };
}

function clockSetPaused(
  state: GameState,
  payload: CommandMap['clock.setPaused']['payload'],
  _ctx: CommandContext,
): CommandOutcome<CommandMap['clock.setPaused']['result']> {
  const paused = (payload as { paused?: unknown } | null)?.paused;
  if (typeof paused !== 'boolean') {
    return { ok: false, error: { code: 'INVALID_SETTING', message: 'paused must be a boolean.' } };
  }
  if (paused) {
    state.clock.speed = 0;
    state.clock.paused = true;
  } else {
    // Deterministic: unpause always restores speed 1, never a prior speed.
    state.clock.speed = 1;
    state.clock.paused = false;
  }
  return { ok: true, value: { clock: state.clock } };
}

/** Registers U1's own catalogue: settings plus clock (Q1-A). */
export function registerKernelCommands(registry: Registry): void {
  registry.registerCommand('settings.update', settingsUpdate);
  registry.registerCommand('clock.setSpeed', clockSetSpeed);
  registry.registerCommand('clock.setPaused', clockSetPaused);
}

export function dispatchCommand<K extends keyof CommandMap>(
  store: MutableStore,
  registry: Registry,
  species: SpeciesCatalog,
  type: K,
  payload: CommandMap[K]['payload'],
): CommandOutcome<CommandMap[K]['result']> {
  const handler = registry.getHandler(type as string) as
    | CommandHandler<CommandMap[K]['payload'], CommandMap[K]['result']>
    | undefined;
  if (!handler) {
    return { ok: false, error: { code: 'UNKNOWN_COMMAND', message: `Unknown command '${type as string}'.` } };
  }
  const ctx: CommandContext = {
    now: { day: store.state.clock.gameDay, hour: store.state.clock.gameHour },
    rng: createRng(store.state.rngState),
    species,
    events: store.events,
  };
  const outcome = handler(store.state, payload, ctx);
  if (!outcome.ok) return outcome;
  drainEventBuffer({
    state: store.state,
    buffer: store.events,
    subscribers: store.listeners,
    mapper: registry.getMapper(),
    species,
  });
  store.version += 1;
  store.dirty = true;
  return outcome;
}
