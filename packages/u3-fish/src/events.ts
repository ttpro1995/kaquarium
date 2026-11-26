// events — U3 SimEvent variants (C4). Each unit owns its variants and
// adds them to the open map by TypeScript module augmentation; systems
// push into ctx.events and the C4 drain delivers them exactly once.
// fishSick stays U2's variant: U3 health drops read the same numbers,
// so no duplicate cause logic lives here. Death by temperature maps to
// the environmental waterQuality cause; the temperature episode
// already told that story.
import type { FishId, TankId } from '@aquarium/u1-sim-foundation/state';

declare module '@aquarium/u1-sim-foundation/events' {
  interface SimEventMap {
    /** W13 buy (via the U6 handler); U5 births use fryHatched instead. */
    fishSpawned: { fishId: FishId; speciesId: string; tankId: TankId };
    /** W12 death; never emitted while catchUp except oldAge (BR10.7). */
    fishDied: { fishId: FishId; cause: 'oldAge' | 'starvation' | 'waterQuality' };
    /** W12 stage transition; seniors stay mature (BR10.5). */
    fishMatured: { fishId: FishId; stage: 'adult' | 'senior' };
  }
}
