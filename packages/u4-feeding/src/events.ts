// events — U4 SimEvent variants (C4). Each unit owns its variants and
// adds them to the open map by TypeScript module augmentation; handlers
// and the feeding system push into ctx.events and the C4 drain delivers
// them exactly once. moneyChanged reuses U6's canonical shape under the
// C2 purchase-path exception (identical by construction: every unit
// references U1's single MoneyChangedPayload declaration).
import type { MoneyChangedPayload } from '@aquarium/u1-sim-foundation';
declare module '@aquarium/u1-sim-foundation/events' {
  interface SimEventMap {
    /**
     * W17/W18/W19 dispensing; portion is the total eaten. One fed per run
     * with the total: manual commands emit one per call; the scheduled
     * system emits one per tick across every stack drawn (foodId is the
     * first/oldest stack drawn).
     */
    fed: { foodId: string; portion: number };
    /** W17/W18/W19 leftovers; the raw waste add (leftover x WASTE_PER_PORTION). */
    overfed: { wasteDelta: number };
    /** Any stack reaching 0, or the day-after-expiry sweep (BR12.3). */
    foodOut: { foodId: string };
    /**
     * U6-owned shape, reused by U4 under the C2 purchase-path exception
     * (validate-first, deduct-or-reject atomic, one moneyChanged per
     * accepted call). Declared here so U4 handlers emit it type-safely;
     * the payload type is U1's single MoneyChangedPayload shared by
     * U2/U4/U6, so the three declarations cannot drift apart.
     */
    moneyChanged: MoneyChangedPayload;
  }
}

export {};
