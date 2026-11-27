// menu — save/load panel model over the SaveLoadApi directly (W44; C6).
// Persistence is deliberately NOT a command: the save must work while the
// clock is paused and is not a simulation action, so the menu calls the
// SaveLoadApi and never touches the command bus. Every outcome is mapped:
// STALE_SAVE returns needsConfirm (the App opens the confirm dialog, never
// a silent overwrite); corrupt/invalid imports name the code with the
// current save untouched.
import type { SaveLoadApi, SlotInfo, SlotRef } from '@aquarium/u1-sim-foundation';

export interface MenuOk<V> {
  ok: true;
  message: null;
  value: V;
  needsConfirm?: undefined;
}

export interface MenuErr {
  ok: false;
  message: string;
  needsConfirm?: boolean;
  value?: undefined;
}

export type MenuResult<V> = MenuOk<V> | MenuErr;

function saveMessage(code: string, message: string): string {
  if (typeof message === 'string' && message.length > 0) {
    return message.includes(code) ? message : `[${code}] ${message}`;
  }
  return `[${code}]`;
}

export function listSlots(saves: SaveLoadApi): SlotInfo[] {
  return saves.listSlots();
}

export function saveGame(saves: SaveLoadApi, name: string): MenuResult<{ ref: SlotRef }> {
  const outcome = saves.saveToSlot(name);
  if (outcome.ok) return { ok: true, message: null, value: { ref: outcome.ref } };
  return { ok: false, message: saveMessage(outcome.error.code, outcome.error.message) };
}

export function loadGame(saves: SaveLoadApi, ref: SlotRef): MenuResult<{ ref: SlotRef }> {
  const outcome = saves.load(ref);
  if (outcome.ok) return { ok: true, message: null, value: { ref: outcome.ref } };
  const stale = outcome.error.code === 'STALE_SAVE';
  return {
    ok: false,
    message: saveMessage(outcome.error.code, outcome.error.message),
    ...(stale ? { needsConfirm: true as const } : {}),
  };
}

/** Retry after the player confirms the STALE_SAVE dialog. */
export function confirmLoadGame(saves: SaveLoadApi, ref: SlotRef): MenuResult<{ ref: SlotRef }> {
  const outcome = saves.load(ref, { confirmStale: true });
  if (outcome.ok) return { ok: true, message: null, value: { ref: outcome.ref } };
  return { ok: false, message: saveMessage(outcome.error.code, outcome.error.message) };
}

export function deleteGame(saves: SaveLoadApi, ref: SlotRef): MenuResult<{ ref: SlotRef }> {
  const outcome = saves.deleteSlot(ref);
  if (outcome.ok) return { ok: true, message: null, value: { ref: outcome.ref } };
  return { ok: false, message: saveMessage(outcome.error.code, outcome.error.message) };
}

export function exportGame(saves: SaveLoadApi): MenuResult<{ text: string }> {
  try {
    return { ok: true, message: null, value: { text: saves.exportFile() } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: saveMessage('STORAGE_UNAVAILABLE', message) };
  }
}

export function importGame(saves: SaveLoadApi, text: string): MenuResult<{ ref: SlotRef }> {
  const outcome = saves.importFile(text);
  if (outcome.ok) return { ok: true, message: null, value: { ref: outcome.ref } };
  const stale = outcome.error.code === 'STALE_SAVE';
  return {
    ok: false,
    message: saveMessage(outcome.error.code, outcome.error.message),
    ...(stale ? { needsConfirm: true as const } : {}),
  };
}

/** Retry after the player confirms the STALE_SAVE import dialog. */
export function confirmImportGame(saves: SaveLoadApi, text: string): MenuResult<{ ref: SlotRef }> {
  const outcome = saves.importFile(text, { confirmStale: true });
  if (outcome.ok) return { ok: true, message: null, value: { ref: outcome.ref } };
  return { ok: false, message: saveMessage(outcome.error.code, outcome.error.message) };
}
