<!-- FishPanel — click-a-fish detail (W39): health + cause, satiety, size/stage,
  sellPrice preview, Sell dispatching commerce.sellFish. Rejections render
  the named message in place. -->
<script lang="ts">
  import type { Kernel } from '@aquarium/u1-sim-foundation';
  import { sellPrice } from '@aquarium/u6-commerce';
  import type { ShellSnapshot, ShellStore } from '../shell/store.js';
  import { selectFishList } from '../shell/selectors.js';
  import { sellFish } from './actions.js';

  interface FishPanelProps {
    store: ShellStore;
    snap: Readonly<ShellSnapshot>;
    kernel: Kernel;
    fishId: string | null;
  }
  let { store, snap, kernel, fishId }: FishPanelProps = $props();
  let message: string | null = $state(null);

  let fish = $derived(selectFishList(snap).find((f) => f.id === fishId) ?? null);
  let preview = $derived.by(() => {
    if (fish === null) return null;
    const species = kernel.species.get(fish.speciesId);
    return sellPrice(kernel.store.state, fish.id, species) ?? null;
  });

  function sell(): void {
    if (fish === null) return;
    const result = sellFish(store, fish.id);
    message = result.message;
  }
</script>

<section data-testid="fish-panel">
  {#if fish === null}
    <p data-testid="fish-panel-empty">Click a fish to inspect it.</p>
  {:else}
    <h2 data-testid="fish-panel-name">{fish.id}</h2>
    <p data-testid="fish-panel-health">health {fish.health} · satiety {fish.satiety}</p>
    <p data-testid="fish-panel-size">size {fish.sizeCm}cm · {fish.stage}{fish.mature ? ' · mature' : ''}</p>
    <p data-testid="fish-panel-preview">{preview === null ? 'not sellable' : `$${preview}`}</p>
    <button data-testid="fish-panel-sell" onclick={sell}>Sell</button>
    {#if message}<p data-testid="fish-panel-message">{message}</p>{/if}
  {/if}
</section>
