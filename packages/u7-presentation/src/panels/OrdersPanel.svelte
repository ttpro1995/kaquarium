<!-- OrdersPanel — orders board (W42). Reward shown pre-fulfil is the board
  estimate; the actual overwrites it post-fulfil (U6 W31). Fulfil dispatches
  orders.fulfil with the checked fish; expiry/fault faults render outcomes. -->
<script lang="ts">
  import type { Kernel } from '@aquarium/u1-sim-foundation';
  import { orderRewardPreview } from '@aquarium/u6-commerce';
  import type { ShellSnapshot, ShellStore } from '../shell/store.js';
  import { selectFishList, selectOrders } from '../shell/selectors.js';
  import { fulfilOrder } from './actions.js';
  import { formatCountdown, toggleInSet } from './helpers.js';

  interface OrdersPanelProps {
    store: ShellStore;
    snap: Readonly<ShellSnapshot>;
    kernel: Kernel;
  }
  let { store, snap, kernel }: OrdersPanelProps = $props();
  let message: string | null = $state(null);
  let picked = $state(new Set<string>());

  let orders = $derived(selectOrders(snap));
  let fish = $derived(selectFishList(snap));

  function toggle(id: string): void {
    picked = toggleInSet(picked, id);
  }
  function estimate(orderId: string): string {
    const speciesOf = (id: string) => kernel.species.get(id);
    const reward = orderRewardPreview(kernel.store.state, orderId, [...picked], speciesOf);
    return reward === undefined ? 'ineligible' : `$${reward}`;
  }
  function fulfil(orderId: string): void {
    const result = fulfilOrder(store, orderId, [...picked]);
    message = result.ok ? `Fulfilled for $${result.value.reward}.` : result.message;
    if (result.ok) picked = new Set();
  }
</script>

<section data-testid="orders-panel">
  <ul>
    {#each orders as order (order.id)}
      <li data-testid="orders-row-{order.id}">
        <span>{order.speciesId} x{order.quantity} · est {estimate(order.id)} · {formatCountdown(order.deadlineDay, snap.gameDay)}</span>
        <button data-testid="orders-fulfil-{order.id}" onclick={() => fulfil(order.id)}>Fulfil</button>
      </li>
    {/each}
  </ul>
  <div>
    {#each fish as f (f.id)}
      <label><input type="checkbox" aria-label="pick {f.id}" data-testid="orders-pick-{f.id}" checked={picked.has(f.id)} onchange={() => toggle(f.id)} />{f.id}</label>
    {/each}
  </div>
  {#if message}<p data-testid="orders-message">{message}</p>{/if}
</section>
