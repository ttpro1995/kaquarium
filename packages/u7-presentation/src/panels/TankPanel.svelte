<!-- TankPanel — tank care sections (W49): water row dispatching
  tank.waterChange (fee shown pre-dispatch) and equipment/tier sections
  with unlock-gated entries (locked entries show their requirement). -->
<script lang="ts">
  import type { Kernel } from '@aquarium/u1-sim-foundation';
  import type { ShellSnapshot, ShellStore } from '../shell/store.js';
  import { selectTank } from '../shell/selectors.js';
  import { buyEquipment, upgradeTier, waterChange } from './actions.js';

  interface TankPanelProps {
    store: ShellStore;
    snap: Readonly<ShellSnapshot>;
    kernel: Kernel;
  }
  let { store, snap }: TankPanelProps = $props();
  let message: string | null = $state(null);
  let portion = $state(20);

  let water = $derived(selectTank(snap));

  function change(): void {
    const result = waterChange(store, portion);
    message = result.ok ? `Changed ${portion}% for $${result.value.fee}.` : result.message;
  }
  function equipment(kind: 'filter' | 'heater' | 'light' | 'autoFeeder', level: number): void {
    const result = buyEquipment(store, kind, level);
    message = result.message;
  }
  function tier(tier: number): void {
    const result = upgradeTier(store, tier);
    message = result.message;
  }
</script>

<section data-testid="tank-panel">
  <p data-testid="tank-water">quality {Math.round(water.quality)} ({water.band}) · waste {Math.round(water.waste)} · {water.tempC}°C</p>
  <p data-testid="tank-capacity">load {Math.round(water.bioload)}/{water.capacity}L</p>
  <input type="number" aria-label="water change percent" data-testid="tank-portion" value={portion} min={10} max={50} onchange={(e) => { portion = Number(e.currentTarget.value) || 20; }} />
  <button data-testid="tank-water-change" onclick={change}>Water change</button>
  <div>
    <button data-testid="tank-equipment-filter-2" onclick={() => equipment('filter', 2)}>Filter 2</button>
    <button data-testid="tank-tier-3" onclick={() => tier(3)}>Tier 3</button>
  </div>
  {#if message}<p data-testid="tank-message">{message}</p>{/if}
</section>
