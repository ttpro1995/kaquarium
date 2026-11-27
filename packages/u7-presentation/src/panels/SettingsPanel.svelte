<!-- SettingsPanel — settings tab (W49): reducedMotion (W37), autoPauseCritical
  (W43), volume. Dispatches settings.update with the CHANGED FIELDS ONLY
  (diffed against the snapshot); changes apply live and persist via the
  next autosave. -->
<script lang="ts">
  import type { Kernel } from '@aquarium/u1-sim-foundation';
  import type { ShellSnapshot, ShellStore } from '../shell/store.js';
  import { selectSettings } from '../shell/selectors.js';
  import { updateSettings } from './actions.js';

  interface SettingsPanelProps {
    store: ShellStore;
    snap: Readonly<ShellSnapshot>;
    kernel: Kernel;
  }
  let { store, snap }: SettingsPanelProps = $props();
  let message: string | null = $state(null);

  let settings = $derived(selectSettings(snap));

  function toggleReducedMotion(): void {
    const result = updateSettings(store, { reducedMotion: !settings.reducedMotion });
    message = result.message;
  }
  function toggleAutoPause(): void {
    const result = updateSettings(store, { autoPauseCritical: !settings.autoPauseCritical });
    message = result.message;
  }
  function volume(which: 'master' | 'sfx', value: number): void {
    const result = updateSettings(store, { volume: { [which]: value } as { master?: number; sfx?: number } });
    message = result.message;
  }
</script>

<section data-testid="settings-panel">
  <label><input type="checkbox" data-testid="settings-reduced-motion" checked={settings.reducedMotion} onchange={toggleReducedMotion} />Reduced motion</label>
  <label><input type="checkbox" data-testid="settings-auto-pause" checked={settings.autoPauseCritical} onchange={toggleAutoPause} />Auto-pause on critical</label>
  <label>Master <input type="range" data-testid="settings-volume-master" value={settings.volume.master} min={0} max={1} step={0.1} onchange={(e) => volume('master', Number(e.currentTarget.value))} /></label>
  <label>SFX <input type="range" data-testid="settings-volume-sfx" value={settings.volume.sfx} min={0} max={1} step={0.1} onchange={(e) => volume('sfx', Number(e.currentTarget.value))} /></label>
  {#if message}<p data-testid="settings-message">{message}</p>{/if}
</section>
