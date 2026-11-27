// helpers — panel-local pure helpers (W36 selection/formatting; W40–W42 previews).
// Selection ops return new sets (Svelte runes need a new reference to wake
// up); previews delegate to the sim's own selectors so the confirm screens
// can never drift from handler eligibility.
import type { GameState, Species } from '@aquarium/u1-sim-foundation/state';
import { bulkPreview, orderRewardPreview } from '@aquarium/u6-commerce';
import { gradePreview } from '@aquarium/u5-breeding';

export type SpeciesOf = (speciesId: string) => Species | undefined;

/** Toggle membership, returning a new set; the input is never mutated. */
export function toggleInSet(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function selectAll(ids: readonly string[]): Set<string> {
  return new Set(ids);
}

export function clearSelection(): Set<string> {
  return new Set();
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

export function formatCountdown(deadlineDay: number, gameDay: number): string {
  const left = deadlineDay - gameDay;
  if (left > 0) return `${left}d left`;
  if (left === 0) return 'due today';
  return `${-left}d overdue`;
}

export function formatGameTime(gameDay: number, gameHour: number): string {
  return `Day ${gameDay} · ${String(gameHour).padStart(2, '0')}:00`;
}

/** Confirm-screen projections: exact mirrors of the U6/U5 pricing and
 *  eligibility, so the shown total equals the real dispatch result. */
export function previewBulkSale(
  state: GameState,
  fishIds: readonly string[],
  speciesOf: SpeciesOf,
) {
  return bulkPreview(state, fishIds, speciesOf);
}

export function previewOrderReward(
  state: GameState,
  orderId: string,
  fishIds: readonly string[],
  speciesOf: SpeciesOf,
) {
  return orderRewardPreview(state, orderId, fishIds, speciesOf);
}

export function previewGrade(
  state: GameState,
  species: Species | undefined,
  cohortId: string,
  count: number,
) {
  return gradePreview(state, species, cohortId, count);
}
