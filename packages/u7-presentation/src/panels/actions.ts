// actions — one function per panel row (W38–W44, W48–W49).
// Every action dispatches through the REAL kernel bus via the shell store
// and returns its outcome mapped: ok carries the value (the caller
// refreshes from the store snapshot), err carries the named message for
// the originating row. No call site discards an outcome.
import type { CommandMap, CommandOutcome } from '@aquarium/u1-sim-foundation/commands';
import type { EquipmentKind } from '@aquarium/u2-tank-water';
import type { ShellStore } from '../shell/store.js';
import { outcomeMessage } from '../shell/outcomes.js';
import { buildSettingsUpdate, type SettingsPatch } from '../shell/settings.js';

export interface ActionOk<V> {
  ok: true;
  message: string | null;
  value: V;
}

export interface ActionErr {
  ok: false;
  message: string;
  value?: undefined;
}

export type ActionResult<V> = ActionOk<V> | ActionErr;

function wrap<V>(outcome: CommandOutcome<V>): ActionResult<V> {
  if (outcome.ok) return { ok: true, message: null, value: outcome.value };
  return { ok: false, message: outcomeMessage(outcome) ?? '[UNKNOWN] dispatch failed.' };
}

type CM = CommandMap;

export function buyFish(store: ShellStore, speciesId: string): ActionResult<CM['commerce.buyFish']['result']> {
  return wrap(store.dispatch('commerce.buyFish', { speciesId }));
}

export function sellFish(store: ShellStore, fishId: string): ActionResult<CM['commerce.sellFish']['result']> {
  return wrap(store.dispatch('commerce.sellFish', { fishId }));
}

export function bulkSell(
  store: ShellStore,
  fishIds: string[],
): ActionResult<CM['commerce.sellBulk']['result']> {
  const outcome = wrap(store.dispatch('commerce.sellBulk', { fishIds }));
  if (!outcome.ok) return outcome;
  const { sold, skipped, total } = outcome.value;
  if (skipped === 0) return { ok: true, message: null, value: { sold, skipped, total } };
  // Name the skipped fish: the bulk handler skips sick entries, so the rows
  // still present after the sale are exactly the skipped ones.
  const remaining = store
    .snapshot()
    .fish.filter((f) => fishIds.includes(f.id))
    .map((f) => f.id);
  const names = remaining.length > 0 ? remaining.join(', ') : `${String(skipped)} sick`;
  return {
    ok: true,
    message: `Sold ${String(sold)} for $${String(total)} (skipped: ${names}).`,
    value: { sold, skipped, total },
  };
}

export function fulfilOrder(
  store: ShellStore,
  orderId: string,
  fishIds: string[],
): ActionResult<CM['orders.fulfil']['result']> {
  return wrap(store.dispatch('orders.fulfil', { orderId, fishIds }));
}

export function dismissNotification(
  store: ShellStore,
  notificationId: string,
): ActionResult<CM['notifications.dismiss']['result']> {
  return wrap(store.dispatch('notifications.dismiss', { notificationId }));
}

export function pairFish(
  store: ShellStore,
  femaleId: string,
  maleId: string,
): ActionResult<CM['breeding.pair']['result']> {
  return wrap(store.dispatch('breeding.pair', { femaleId, maleId }));
}

export function unpairPair(store: ShellStore, pairId: string): ActionResult<CM['breeding.unpair']['result']> {
  return wrap(store.dispatch('breeding.unpair', { pairId }));
}

export function gradeCohort(
  store: ShellStore,
  cohortId: string,
  count: number,
): ActionResult<CM['breeding.grade']['result']> {
  return wrap(store.dispatch('breeding.grade', { cohortId, count }));
}

export function waterChange(
  store: ShellStore,
  portionPct: number,
): ActionResult<CM['tank.waterChange']['result']> {
  return wrap(store.dispatch('tank.waterChange', { portionPct }));
}

export function buyEquipment(
  store: ShellStore,
  kind: EquipmentKind,
  level: number,
): ActionResult<CM['tank.buyEquipment']['result']> {
  return wrap(store.dispatch('tank.buyEquipment', { kind, level }));
}

export function upgradeTier(store: ShellStore, tier: number): ActionResult<CM['tank.upgradeTier']['result']> {
  return wrap(store.dispatch('tank.upgradeTier', { tier }));
}

export function buyFood(
  store: ShellStore,
  kind: string,
  qty: number,
): ActionResult<CM['feeding.buyFood']['result']> {
  return wrap(store.dispatch('feeding.buyFood', { kind, qty }));
}

export function feedFish(
  store: ShellStore,
  foodId: string,
  portions: number,
): ActionResult<CM['feeding.feedFish']['result']> {
  return wrap(store.dispatch('feeding.feedFish', { foodId, portions }));
}

export function feedFry(
  store: ShellStore,
  foodId: string,
  cohortId: string,
  portions: number,
): ActionResult<CM['feeding.feedFry']['result']> {
  return wrap(store.dispatch('feeding.feedFry', { foodId, cohortId, portions }));
}

export interface AutoFeederProgram {
  foodKind: string;
  portions: number;
  intervalHours: number;
}

export function setAutoFeeder(
  store: ShellStore,
  program: AutoFeederProgram | null,
): ActionResult<CM['feeding.setAutoFeeder']['result']> {
  return wrap(store.dispatch('feeding.setAutoFeeder', program));
}

export function setSpeed(store: ShellStore, speed: 0 | 1 | 2 | 4): ActionResult<CM['clock.setSpeed']['result']> {
  return wrap(store.dispatch('clock.setSpeed', { speed }));
}

export function setPaused(store: ShellStore, paused: boolean): ActionResult<CM['clock.setPaused']['result']> {
  return wrap(store.dispatch('clock.setPaused', { paused }));
}

export interface SettingsActionResult {
  ok: boolean;
  message: string | null;
  skipped: boolean;
}

export function updateSettings(store: ShellStore, patch: SettingsPatch): SettingsActionResult {
  const diff = buildSettingsUpdate(store.snapshot().settings, patch);
  if (diff === null) return { ok: true, message: null, skipped: true };
  const outcome = store.dispatch('settings.update', diff);
  if (outcome.ok) return { ok: true, message: null, skipped: false };
  return { ok: false, message: outcomeMessage(outcome) ?? '[INVALID_SETTING] rejected.', skipped: false };
}
