// events — U4 SimEvent variants (C4). Each unit owns its variants and
// adds them to the open map by TypeScript module augmentation; handlers
// and the feeding system push into ctx.events and the C4 drain delivers
// them exactly once. moneyChanged reuses U6's canonical shape under the
// C2 purchase-path exception (identical shape to U2's declaration).
declare module '@aquarium/u1-sim-foundation/events' {
  interface SimEventMap {
    /** W17/W18/W19 dispensing; portion is the eaten count. */
    fed: { foodId: string; portion: number };
    /** W17/W18/W19 leftovers; the raw waste add (leftover x 2.0). */
    overfed: { wasteDelta: number };
    /** Any stack reaching 0, or the day-after-expiry sweep (BR12.3). */
    foodOut: { foodId: string };
    /**
     * U6-owned shape, reused by U4 under the C2 purchase-path exception
     * (validate-first, deduct-or-reject atomic, one moneyChanged per
     * accepted call). Declared here so U4 handlers emit it type-safely;
     * U6's canonical declaration must use this identical shape.
     */
    moneyChanged: { delta: number; balance: number };
  }
}

export {};
