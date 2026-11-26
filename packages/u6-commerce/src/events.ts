// events — U6 SimEvent variants (C4). Each unit owns its variants and
// adds them to the open map by TypeScript module augmentation; the
// commerce/notify systems push into ctx.events and command handlers into
// ctx.events, and the C4 drain delivers them exactly once. moneyChanged
// is U6's canonical shape, reused by U2/U4 under the C2 purchase-path
// exception (identical shape in every declaration).
import type { FishId, Species, TankId } from '@aquarium/u1-sim-foundation/state';

declare module '@aquarium/u1-sim-foundation/events' {
  interface SimEventMap {
    /** W26 buy success, with the pure U3 fishSpawned the handler emits. */
    fishBought: { fishId: FishId; speciesId: string; price: number };
    /** W28 per-fish sale (market sales only, never on fulfil). */
    fishSold: { fishId: FishId; price: number };
    /** W31 fulfil success; the actual paid reward. */
    orderFulfilled: { orderId: string; reward: number };
    /** W32 deadline pass; reputation already dropped. */
    orderExpired: { orderId: string };
    /** W33 threshold crossing; one per level gained, ascending. */
    levelUp: { level: number };
    /**
     * Canonical money shape (C2 exception): validate-first,
     * deduct-or-reject atomic, one per accepted purchase-path call.
     */
    moneyChanged: { delta: number; balance: number };
  }
}

export type { FishId, Species, TankId };
export {};
