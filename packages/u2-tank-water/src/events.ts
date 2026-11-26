// events — U2 SimEvent variants (C4). Each unit owns its variants and adds
// them to the open map by TypeScript module augmentation; handlers push
// into ctx.events and the C4 drain delivers them exactly once.
import type { FishId } from '@aquarium/u1-sim-foundation/state';

declare module '@aquarium/u1-sim-foundation/events' {
  interface SimEventMap {
    /** W9 success; wasteDelta is the waste reduction, positive. */
    waterChanged: { wasteDelta: number };
    /** W10 equipment success, e.g. "filter:2", "heater:1". */
    equipmentUpgraded: { equipment: string };
    /** W10 tier success (new additive variant). */
    tierUpgraded: { tier: number };
    /** W7 newly over capacity (new additive variant). */
    tankOvercrowded: { bioload: number; capacity: number };
    /** W7 band newly poor (per fish) or temperature episode opening. */
    fishSick: { fishId: FishId; cause: 'waterQuality' | 'temperature' };
    /**
     * U6-owned shape, reused by U2 under the C2 purchase-path exception
     * (validate-first, deduct-or-reject atomic, one moneyChanged per
     * accepted call). Declared here so U2 handlers emit it type-safely;
     * U6's canonical declaration must use this identical shape.
     */
    moneyChanged: { delta: number; balance: number };
  }
}
