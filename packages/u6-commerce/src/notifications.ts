// notifications — BR19.2 mapper table + BR19.3 bounded queue (W35).
// U6 registers the single notification mapper. fishSick always maps to
// null: the notify-phase system owns every fishSick notification by
// construction (one warn per tick, singleton or batch). whileYouWereAway
// maps to its single info summary here because U1's catch-up pushes that
// event after the last system run — the drain is the only delivery path,
// so exactly-once still holds by C4.
import type {
  GameState,
  Notification,
  NotificationPriority,
} from '@aquarium/u1-sim-foundation/state';
import type { NotificationMapper, SimEvent } from '@aquarium/u1-sim-foundation';
import './events.js';

/** Queue cap: drop info first, then warn, never critical (BR19.3). */
export const MAX_NOTIFICATIONS = 100;

let notificationSeq = 0;
let lastSyncedQueue: Notification[] | null = null;
let lastSyncedLength = 0;

/**
 * Reload-safe sequence (review): the U1 NotificationMapper contract hands
 * the mapper only (event, species) — no ctx/state/rng — so ids cannot
 * consume sim rng here (and Math.random is banned in sim code by NFR3.2).
 * A bare module counter would reset on reload and collide with the
 * persisted queue, so every U6 entry point (both systems, all five
 * commands — and U7's save-load path) calls this before it can produce a
 * drain, lifting the counter above every persisted `notif-` id.
 *
 * NFR1.1: steady-state ticks skip the scan. New above-counter ids can
 * only arrive via load (fresh queue array) or queue growth (only the tail
 * is new — removals never introduce ids), so a known array at an equal or
 * smaller length needs no work and a grown array scans only its tail.
 */
export function syncNotificationSeq(state: GameState): void {
  const queue = state.notifications;
  if (queue === lastSyncedQueue && queue.length <= lastSyncedLength) return;
  const start = queue === lastSyncedQueue ? lastSyncedLength : 0;
  let max = notificationSeq;
  for (let index = start; index < queue.length; index++) {
    const notification = queue[index];
    if (notification === undefined) continue;
    const match = /^notif-([0-9a-f]+)$/.exec(notification.id);
    if (match === null) continue;
    const value = parseInt(match[1] as string, 16);
    if (Number.isFinite(value) && value > max) max = value;
  }
  notificationSeq = max;
  lastSyncedQueue = queue;
  lastSyncedLength = queue.length;
}

function makeNotification(
  priority: NotificationPriority,
  kind: string,
  message: string,
  subjectId?: string,
): Notification {
  notificationSeq += 1;
  const notification: Notification = {
    id: `notif-${notificationSeq.toString(16).padStart(8, '0')}`,
    priority,
    kind,
    message,
  };
  if (subjectId !== undefined) notification.subjectId = subjectId;
  return notification;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '?';
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * BR19.2 mapper table. fishDied -> critical; tankOvercrowded /
 * orderExpired / foodOut -> warn; the economy/progress events -> info;
 * fishSpawned / fishSick / moneyChanged -> null (fishSpawned collapses
 * into the buy trio's fishBought info; U5 births ride cohortGraded).
 * Unknown kinds map to null so foreign events never spam the queue.
 */
export const commerceNotificationMapper: NotificationMapper = (
  event: SimEvent,
  _species,
): Notification | null => {
  const record = event as { kind: string; [k: string]: unknown };
  switch (record.kind) {
    case 'fishDied':
      return makeNotification('critical', 'fishDied', `A fish died (${text(record.cause)}).`, text(record.fishId));
    case 'tankOvercrowded':
      return makeNotification(
        'warn',
        'tankOvercrowded',
        `Tank overcrowded: bioload ${num(record.bioload)} over capacity ${num(record.capacity)}.`,
      );
    case 'orderExpired':
      return makeNotification('warn', 'orderExpired', `Order ${text(record.orderId)} expired.`);
    case 'foodOut':
      return makeNotification('warn', 'foodOut', `Food ${text(record.foodId)} ran out.`);
    case 'waterChanged':
      return makeNotification('info', 'waterChanged', 'Water changed.');
    case 'equipmentUpgraded':
      return makeNotification('info', 'equipmentUpgraded', `Equipment upgraded: ${text(record.equipment)}.`);
    case 'tierUpgraded':
      return makeNotification('info', 'tierUpgraded', `Tank upgraded to tier ${num(record.tier)}.`);
    case 'fishMatured':
      return makeNotification('info', 'fishMatured', 'A fish matured.');
    case 'breedingStarted':
      return makeNotification('info', 'breedingStarted', 'Breeding started.');
    case 'fryHatched':
      return makeNotification('info', 'fryHatched', `${num(record.count)} fry hatched.`);
    case 'cohortGraded':
      return makeNotification('info', 'cohortGraded', `${num(record.count)} fry graded.`);
    case 'fishBought':
      return makeNotification('info', 'fishBought', `Bought a fish for $${num(record.price)}.`, text(record.fishId));
    case 'fishSold':
      return makeNotification('info', 'fishSold', `Sold a fish for $${num(record.price)}.`, text(record.fishId));
    case 'orderFulfilled':
      return makeNotification(
        'info',
        'orderFulfilled',
        `Order ${text(record.orderId)} fulfilled for $${num(record.reward)}.`,
      );
    case 'levelUp':
      return makeNotification('info', 'levelUp', `Reached level ${num(record.level)}.`);
    case 'whileYouWereAway':
      return makeNotification(
        'info',
        'whileAway',
        `While you were away: ${num(record.elapsedDays)} days, ${num(record.hatched)} hatched, ` +
          `${num(record.matured)} matured, ${num(record.diedOfOldAge)} died, ${num(record.ordersExpired)} orders expired.`,
      );
    case 'fishSpawned':
    case 'fishSick':
    case 'moneyChanged':
      return null;
    default:
      return null;
  }
};

/**
 * BR19.3 cap: while over 100, drop the oldest info, else the oldest warn.
 * Criticals are never auto-dropped, so an all-critical queue may
 * transiently exceed 100 — overflow holds criticals only.
 */
export function enforceQueueCap(state: GameState): void {
  while (state.notifications.length > MAX_NOTIFICATIONS) {
    const infoIndex = state.notifications.findIndex((n) => n.priority === 'info');
    if (infoIndex >= 0) {
      state.notifications.splice(infoIndex, 1);
      continue;
    }
    const warnIndex = state.notifications.findIndex((n) => n.priority === 'warn');
    if (warnIndex >= 0) {
      state.notifications.splice(warnIndex, 1);
      continue;
    }
    return;
  }
}
