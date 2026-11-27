<!-- StorePanel — species shop + equipment/tier upgrades (W40).
  Lists every catalogue species (locked entries show their unlock
  requirement, never hidden). Buy dispatches commerce.buyFish; equipment
  and tier rows dispatch U2 commands. Funds/unlock/capacity rejections
  surface the handler message at the tapped item. -->
<script lang="ts">
  import type { Kernel } from '@aquarium/u1-sim-foundation';
  import type { Species } from '@aquarium/u1-sim-foundation/state';
  import { buyableSpecies } from '@aquarium/u6-commerce';
  import type { ShellSnapshot, ShellStore } from '../shell/store.js';
  import { selectStoreContext } from '../shell/selectors.js';
  import { buyEquipment, buyFish, upgradeTier } from './actions.js';

  interface StorePanelProps {
    store: ShellStore;
    snap: Readonly<ShellSnapshot>;
    kernel: Kernel;
    species: readonly Species[];
  }
  let { store, snap, kernel, species }: StorePanelProps = $props();
  let messages = $state(new Map<string, string>());

  let ctx = $derived(selectStoreContext(snap));
  let buyable = $derived(buyableSpecies(kernel.store.state, species).map((s) => s.id));

  function say(id: string, message: string | null): void {
    const next = new Map(messages);
    if (message === null) next.delete(id);
    else next.set(id, message);
    messages = next;
  }
  function buy(speciesId: string): void {
    const result = buyFish(store, speciesId);
    say(speciesId, result.message);
  }
  function equipment(kind: 'filter' | 'heater' | 'light' | 'autoFeeder', level: number): void {
    const result = buyEquipment(store, kind, level);
    say(`${kind}-${level}`, result.message);
  }
  function tier(tier: number): void {
    const result = upgradeTier(store, tier);
    say(`tier-${tier}`, result.message);
  }
</script>

<section data-testid="store-panel">
  <p data-testid="store-money">${ctx.money} · level {ctx.level}</p>
  <ul>
    {#each species as s (s.id)}
      <li data-testid="store-row-{s.id}">
        <span>{s.id} · ${s.buyPrice}{buyable.includes(s.id) ? '' : ` · locked (level ${s.tier})`}</span>
        <button data-testid="store-buy-{s.id}" disabled={!buyable.includes(s.id)} onclick={() => buy(s.id)}>Buy</button>
        {#if messages.get(s.id)}<span data-testid="store-message-{s.id}">{messages.get(s.id)}</span>{/if}
      </li>
    {/each}
  </ul>
  <div>
    <button data-testid="store-equipment-heater-1" onclick={() => equipment('heater', 1)}>Heater</button>
    {#if messages.get('heater-1')}<span data-testid="store-message-heater-1">{messages.get('heater-1')}</span>{/if}
    <button data-testid="store-tier-2" onclick={() => tier(2)}>Tier 2</button>
    {#if messages.get('tier-2')}<span data-testid="store-message-tier-2">{messages.get('tier-2')}</span>{/if}
  </div>
</section>
