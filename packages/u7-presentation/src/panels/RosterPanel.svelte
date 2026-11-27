<!-- RosterPanel — management table with bulk-select + Bulk Sell (W39).
  Dispatches commerce.sellBulk and reports { sold, skipped, total },
  flagging skipped sick fish by name. -->
<script lang="ts">
  import type { Kernel } from '@aquarium/u1-sim-foundation';
  import type { ShellSnapshot, ShellStore } from '../shell/store.js';
  import { selectRoster } from '../shell/selectors.js';
  import { bulkSell } from './actions.js';
  import { clearSelection, toggleInSet } from './helpers.js';

  interface RosterPanelProps {
    store: ShellStore;
    snap: Readonly<ShellSnapshot>;
    kernel: Kernel;
  }
  let { store, snap }: RosterPanelProps = $props();
  let selected = $state(new Set<string>());
  let message: string | null = $state(null);

  let fish = $derived(selectRoster(snap));

  function toggle(id: string): void {
    selected = toggleInSet(selected, id);
  }
  function clear(): void {
    selected = clearSelection();
  }
  function sellSelected(): void {
    const result = bulkSell(store, [...selected]);
    message = result.ok ? (result.message ?? `Sold ${result.value.sold} for $${result.value.total}.`) : result.message;
    if (result.ok) selected = clearSelection();
  }
</script>

<section data-testid="roster-panel">
  <table>
    <tbody>
      {#each fish as f (f.id)}
        <tr data-testid="roster-row-{f.id}">
          <td><input type="checkbox" aria-label="select {f.id}" data-testid="roster-select-{f.id}" checked={selected.has(f.id)} onchange={() => toggle(f.id)} /></td>
          <td>{f.id}</td>
          <td>health {f.health}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <button data-testid="roster-clear" onclick={clear}>Clear</button>
  <button data-testid="roster-bulk-sell" onclick={sellSelected}>Bulk Sell ({selected.size})</button>
  {#if message}<p data-testid="roster-message">{message}</p>{/if}
</section>
