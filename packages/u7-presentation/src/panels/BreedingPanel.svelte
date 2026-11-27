<!-- BreedingPanel — pairs + cohorts (W41). Condition breakdown via
  breedingReadiness, capacity/stunt projection via gradePreview. Pair,
  unpair and grade dispatch the U5 commands; eggs/not-ready and the
  gravid/cooling lock explain themselves in the panel message. -->
<script lang="ts">
  import type { Kernel } from '@aquarium/u1-sim-foundation';
  import { breedingReadiness, gradePreview } from '@aquarium/u5-breeding';
  import type { ShellSnapshot, ShellStore } from '../shell/store.js';
  import { selectBreeding, selectFishList } from '../shell/selectors.js';
  import { gradeCohort, pairFish, unpairPair } from './actions.js';

  interface BreedingPanelProps {
    store: ShellStore;
    snap: Readonly<ShellSnapshot>;
    kernel: Kernel;
  }
  let { store, snap, kernel }: BreedingPanelProps = $props();
  let message: string | null = $state(null);
  let femaleId = $state('');
  let maleId = $state('');
  let gradeCount = $state(1);

  let breeding = $derived(selectBreeding(snap));
  let fish = $derived(selectFishList(snap));

  function pair(): void {
    const result = pairFish(store, femaleId, maleId);
    message = result.message;
  }
  function unpair(pairId: string): void {
    const result = unpairPair(store, pairId);
    message = result.message;
  }
  function grade(cohortId: string): void {
    const result = gradeCohort(store, cohortId, gradeCount);
    message = result.message;
  }
  function readiness(pairId: string): string {
    const species = kernel.species.get(kernel.store.state.pairs[pairId]?.speciesId ?? '');
    const readiness = breedingReadiness(kernel.store.state, pairId, species);
    return readiness === undefined ? 'unknown' : `ready ${readiness.passes ? 'yes' : 'no'} · ${Math.round(readiness.probabilityPerTick * 1000) / 10}%/tick`;
  }
  function projection(cohortId: string): string {
    const cohort = kernel.store.state.cohorts[cohortId];
    const species = cohort === undefined ? undefined : kernel.species.get(cohort.speciesId);
    const preview = gradePreview(kernel.store.state, species, cohortId, gradeCount);
    if (preview === undefined) return 'no preview';
    return preview.ready ? `fits · stunted ${preview.stunted ? 'yes' : 'no'}` : (preview.reason ?? 'not ready');
  }
</script>

<section data-testid="breeding-panel">
  <div>
    <select aria-label="female" data-testid="breeding-female" value={femaleId} onchange={(e) => { femaleId = e.currentTarget.value; }}>
      <option value="">female —</option>
      {#each fish.filter((f) => f.id.includes('f') || true) as f (f.id)}
        <option value={f.id}>{f.id}</option>
      {/each}
    </select>
    <select aria-label="male" data-testid="breeding-male" value={maleId} onchange={(e) => { maleId = e.currentTarget.value; }}>
      <option value="">male —</option>
      {#each fish as f (f.id)}
        <option value={f.id}>{f.id}</option>
      {/each}
    </select>
    <button data-testid="breeding-pair" onclick={pair}>Pair</button>
  </div>
  <ul>
    {#each breeding.pairs as pair (pair.id)}
      <li data-testid="breeding-pair-{pair.id}">
        <span>{pair.id} · {pair.state} · {readiness(pair.id)}</span>
        <button data-testid="breeding-unpair-{pair.id}" onclick={() => unpair(pair.id)}>Unpair</button>
      </li>
    {/each}
  </ul>
  <ul>
    {#each breeding.cohorts as cohort (cohort.id)}
      <li data-testid="breeding-cohort-{cohort.id}">
        <span>{cohort.id} · {cohort.stage} x{cohort.count} · {projection(cohort.id)}</span>
        <input type="number" aria-label="grade count" data-testid="breeding-grade-count" value={gradeCount} min={1} onchange={(e) => { gradeCount = Number(e.currentTarget.value) || 1; }} />
        <button data-testid="breeding-grade-{cohort.id}" onclick={() => grade(cohort.id)}>Grade</button>
      </li>
    {/each}
  </ul>
  {#if message}<p data-testid="breeding-message">{message}</p>{/if}
</section>
