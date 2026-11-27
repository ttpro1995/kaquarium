<!-- FeedingPanel — food stocks, manual/fry feeding, auto-feeder program (W48).
  Real U4 commands only. NOT_AVAILABLE without the device, funds and
  quantity errors surface at the row that caused them. Fry cohorts come
  from U5's cohortsInTank (eggs rejected by the handler, not the panel). -->
<script lang="ts">
  import type { Kernel } from '@aquarium/u1-sim-foundation';
  import { feedingProgram } from '@aquarium/u4-feeding';
  import type { ShellSnapshot, ShellStore } from '../shell/store.js';
  import { selectBreeding, selectFeeding } from '../shell/selectors.js';
  import { buyFood, feedFish, feedFry, setAutoFeeder } from './actions.js';

  interface FeedingPanelProps {
    store: ShellStore;
    snap: Readonly<ShellSnapshot>;
    kernel: Kernel;
  }
  let { store, snap, kernel }: FeedingPanelProps = $props();
  let message: string | null = $state(null);
  let fryCohortId = $state('');

  let feeding = $derived(selectFeeding(snap));
  let cohorts = $derived(selectBreeding(snap).cohorts.filter((c) => c.stage === 'fry'));
  let program = $derived(feedingProgram(kernel.store.state));

  function buy(kind: string): void {
    const result = buyFood(store, kind, 2);
    message = result.message;
  }
  function feed(foodId: string): void {
    const result = feedFish(store, foodId, 1);
    message = result.message;
  }
  function feedFryRow(foodId: string): void {
    if (fryCohortId === '') {
      message = 'Pick a fry cohort first.';
      return;
    }
    const result = feedFry(store, foodId, fryCohortId, 1);
    message = result.message;
  }
  function schedule(): void {
    const result = setAutoFeeder(store, { foodKind: 'flakes', portions: 1, intervalHours: 6 });
    message = result.message;
  }
  function clearSchedule(): void {
    const result = setAutoFeeder(store, null);
    message = result.message;
  }
</script>

<section data-testid="feeding-panel">
  <div>
    <button data-testid="feeding-buy-flakes" onclick={() => buy('flakes')}>Buy flakes</button>
    <button data-testid="feeding-buy-liveFirst" onclick={() => buy('liveFirst')}>Buy fry food</button>
  </div>
  <ul>
    {#each feeding.foodStacks as stack (stack.id)}
      <li data-testid="feeding-stack-{stack.id}">
        <span>{stack.kind} x{stack.qty}{stack.expired ? ' (expired)' : ''}</span>
        <button data-testid="feeding-feed-{stack.id}" onclick={() => feed(stack.id)}>Feed fish</button>
        <button data-testid="feeding-feed-fry-{stack.id}" onclick={() => feedFryRow(stack.id)}>Feed fry</button>
      </li>
    {/each}
  </ul>
  <label>Cohort
    <select aria-label="fry cohort" data-testid="feeding-cohort" value={fryCohortId} onchange={(e) => { fryCohortId = e.currentTarget.value; }}>
      <option value="">—</option>
      {#each cohorts as c (c.id)}
        <option value={c.id}>{c.id}</option>
      {/each}
    </select>
  </label>
  <p data-testid="feeding-program">{program.installed ? `program: ${program.schedule?.foodKind ?? 'none'}` : 'no feeder installed'}</p>
  <button data-testid="feeding-schedule" onclick={schedule}>Schedule feeder</button>
  <button data-testid="feeding-schedule-clear" onclick={clearSchedule}>Clear feeder</button>
  {#if message}<p data-testid="feeding-message">{message}</p>{/if}
</section>
