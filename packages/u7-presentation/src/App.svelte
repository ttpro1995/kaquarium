<!-- App — Svelte shell composition root (W47). Composes ALL 13 screens
  (Hud, Toolbar, TankCanvas, 10 panels — always mounted, inactive ones
  hidden so tab state survives) plus AwaySummaryModal, ConfirmDialog and
  FaultBoundary. The away modal STATE lives here (set by the catch-up, not
  by a helper); the fault hub is subscribed here so the fault panel CAN
  trigger. Every panel is bound to store selectors + dispatch. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Kernel } from '@aquarium/u1-sim-foundation';
  import type { Species } from '@aquarium/u1-sim-foundation/state';
  import type { ShellStore } from './shell/store.js';
  import type { PixiFactories } from './tank/pixiStage.js';
  import { runAwaySequence, resumeFromAway, type AwaySummary } from './shell/away.js';
  import { checkFault, driveTick, notifyFault, reloadToAutosave, watchFaults, type FaultInfo } from './shell/fault.js';
  import { confirmImportGame, confirmLoadGame } from './save/menu.js';
  import Hud from './panels/Hud.svelte';
  import Toolbar, { type Tab } from './panels/Toolbar.svelte';
  import TankCanvas from './panels/TankCanvas.svelte';
  import FishPanel from './panels/FishPanel.svelte';
  import RosterPanel from './panels/RosterPanel.svelte';
  import StorePanel from './panels/StorePanel.svelte';
  import FeedingPanel from './panels/FeedingPanel.svelte';
  import BreedingPanel from './panels/BreedingPanel.svelte';
  import OrdersPanel from './panels/OrdersPanel.svelte';
  import TankPanel from './panels/TankPanel.svelte';
  import SavePanel, { type StaleRequest } from './panels/SavePanel.svelte';
  import SettingsPanel from './panels/SettingsPanel.svelte';
  import BellPanel from './panels/BellPanel.svelte';
  import AwaySummaryModal from './modals/AwaySummaryModal.svelte';
  import ConfirmDialog from './modals/ConfirmDialog.svelte';
  import FaultBoundary from './modals/FaultBoundary.svelte';

  interface AppProps {
    store: ShellStore;
    kernel: Kernel;
    pixi?: PixiFactories | undefined;
    catchUpHours?: number | undefined;
  }
  let { store, kernel, pixi = undefined, catchUpHours = 0 }: AppProps = $props();

  let snap = $state(store.snapshot());
  let tab: Tab = $state('tank');
  let away: AwaySummary | null = $state(null);
  let fault: FaultInfo | null = $state(null);
  let stale: StaleRequest | null = $state(null);
  let selectedFishId: string | null = $state(null);
  let saveRefresh = $state(0);
  let faultReloadMessage: string | null = $state(null);

  let species: readonly Species[] = $derived([...kernel.species.all()]);

  function hidden(name: Tab): boolean {
    return tab !== name;
  }

  function resume(): void {
    const result = resumeFromAway(store);
    if (result.ok) away = null;
  }
  function reload(): void {
    const result = reloadToAutosave(kernel);
    if (result.ok) {
      fault = null;
      faultReloadMessage = null;
      snap = store.snapshot();
      saveRefresh += 1;
    } else {
      faultReloadMessage = result.message;
    }
  }
  function confirmStale(): void {
    if (stale === null) return;
    const result =
      stale.action === 'load' && stale.ref !== undefined
        ? confirmLoadGame(kernel.saves, stale.ref)
        : confirmImportGame(kernel.saves, stale.text ?? '');
    if (result.ok) {
      stale = null;
      snap = store.snapshot();
      saveRefresh += 1;
    } else {
      stale = { ...stale, message: result.message ?? 'Confirm failed.' };
    }
  }
  function focusSubject(subjectId: string): void {
    selectedFishId = subjectId;
    tab = 'tank';
  }

  onMount(() => {
    const offStore = store.subscribe((s) => {
      snap = s;
    });
    const offFault = watchFaults(kernel, (f) => {
      fault = f;
    });
    if (catchUpHours > 0) {
      away = runAwaySequence(kernel, catchUpHours);
      snap = store.snapshot();
    }
    fault = checkFault(kernel);
    const timer = setInterval(() => {
      driveTick(kernel);
      notifyFault(kernel);
      store.resync();
      snap = store.snapshot();
    }, 1000);
    return () => {
      offStore();
      offFault();
      clearInterval(timer);
    };
  });
</script>

<div data-testid="app-shell">
  <Hud {store} {snap} {kernel} onbell={() => { tab = 'bell'; }} />
  <Toolbar activeTab={tab} onswitch={(t) => { tab = t; }} />
  <div data-testid="screen-tank" hidden={hidden('tank')}>
    <TankCanvas {snap} {pixi} focusFishId={selectedFishId} />
    <FishPanel {store} {snap} {kernel} fishId={selectedFishId} />
    <TankPanel {store} {snap} {kernel} />
  </div>
  <div data-testid="screen-store" hidden={hidden('store')}>
    <StorePanel {store} {snap} {kernel} {species} />
  </div>
  <div data-testid="screen-feeding" hidden={hidden('feeding')}>
    <FeedingPanel {store} {snap} {kernel} />
  </div>
  <div data-testid="screen-breeding" hidden={hidden('breeding')}>
    <BreedingPanel {store} {snap} {kernel} />
  </div>
  <div data-testid="screen-orders" hidden={hidden('orders')}>
    <OrdersPanel {store} {snap} {kernel} />
  </div>
  <div data-testid="screen-roster" hidden={hidden('roster')}>
    <RosterPanel {store} {snap} {kernel} />
  </div>
  <div data-testid="screen-save" hidden={hidden('save')}>
    <SavePanel {store} {snap} {kernel} onconfirm={(request) => { stale = request; }} refreshToken={saveRefresh} />
  </div>
  <div data-testid="screen-settings" hidden={hidden('settings')}>
    <SettingsPanel {store} {snap} {kernel} />
  </div>
  <div data-testid="screen-bell" hidden={hidden('bell')}>
    <BellPanel {store} {snap} {kernel} onfocus={focusSubject} />
  </div>
  {#if away !== null}
    <AwaySummaryModal summary={away} onresume={resume} />
  {/if}
  {#if stale !== null}
    <ConfirmDialog message={stale.message} onconfirm={confirmStale} oncancel={() => { stale = null; }} />
  {/if}
  {#if fault !== null}
    <FaultBoundary {fault} onreload={reload} />
  {/if}
</div>
