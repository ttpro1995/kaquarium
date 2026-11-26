// events — U5 SimEvent variants (C4). Each unit owns its variants and
// adds them to the open map by TypeScript module augmentation; the
// breeding system pushes into ctx.events and command handlers into
// ctx.events, and the C4 drain delivers them exactly once.
import type { CohortId, FishId } from '@aquarium/u1-sim-foundation/state';

declare module '@aquarium/u1-sim-foundation/events' {
  interface SimEventMap {
    /** W23a conception / W23b laying; slot order is female-first. */
    breedingStarted: { fishIds: [FishId, FishId] };
    /** W23a birth / W23b hatch; count is the cohort count after the step. */
    fryHatched: { cohortId: CohortId; count: number };
    /** W25 grading; count is the graded number, the remainder stays. */
    cohortGraded: { cohortId: CohortId; count: number };
  }
}

export {};
