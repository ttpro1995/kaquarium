<!-- SavePanel — save/load menu (W44). Calls the SaveLoadApi directly, never
  the command bus (C6). STALE_SAVE opens the confirm dialog through
  onconfirm — never a silent overwrite. Import validates before touching
  the current save. App owns the confirm step and bumps refreshToken
  afterwards so the slot list re-reads. -->
<script lang="ts">
  import type { Kernel } from '@aquarium/u1-sim-foundation';
  import type { SlotInfo, SlotRef } from '@aquarium/u1-sim-foundation';
  import type { ShellSnapshot, ShellStore } from '../shell/store.js';
  import { selectSaveContext } from '../shell/selectors.js';
  import { deleteGame, exportGame, importGame, listSlots, loadGame, saveGame } from '../save/menu.js';

  export interface StaleRequest {
    action: 'load' | 'import';
    ref?: SlotRef | undefined;
    text?: string | undefined;
    message: string;
  }

  interface SavePanelProps {
    store: ShellStore;
    snap: Readonly<ShellSnapshot>;
    kernel: Kernel;
    onconfirm: (request: StaleRequest) => void;
    refreshToken: number;
  }
  let { store, snap, kernel, onconfirm, refreshToken }: SavePanelProps = $props();
  let ctx = $derived(selectSaveContext(snap));
  let name = $state('');
  let importText = $state('');
  let message: string | null = $state(null);
  let slots = $state<SlotInfo[]>([]);

  $effect(() => {
    void refreshToken;
    slots = listSlots(kernel.saves);
  });

  function slotKey(ref: SlotRef): string {
    return ref.kind === 'auto' ? `auto-${ref.index}` : ref.name;
  }
  function save(): void {
    const result = saveGame(kernel.saves, name === '' ? 'manual' : name);
    message = result.message;
    slots = listSlots(kernel.saves);
  }
  function load(ref: SlotRef): void {
    const result = loadGame(kernel.saves, ref);
    if (result.needsConfirm) {
      onconfirm({ action: 'load', ref, message: result.message ?? 'Stale save.' });
      return;
    }
    message = result.message;
    slots = listSlots(kernel.saves);
  }
  function remove(ref: SlotRef): void {
    const result = deleteGame(kernel.saves, ref);
    message = result.message;
    slots = listSlots(kernel.saves);
  }
  function exportIt(): void {
    const result = exportGame(kernel.saves);
    message = result.ok ? result.value.text : result.message;
  }
  function importIt(): void {
    const result = importGame(kernel.saves, importText);
    if (result.needsConfirm) {
      onconfirm({ action: 'import', text: importText, message: result.message ?? 'Stale save.' });
      return;
    }
    message = result.message;
    slots = listSlots(kernel.saves);
  }
</script>

<section data-testid="save-panel">
  <p data-testid="save-context">day {ctx.gameDay} · ${ctx.money} · level {ctx.level}</p>
  <input aria-label="slot name" data-testid="save-name" value={name} placeholder="slot name" oninput={(e) => { name = e.currentTarget.value; }} />
  <button data-testid="save-save" onclick={save}>Save</button>
  <ul>
    {#each slots as slot (slotKey(slot.ref))}
      <li data-testid="save-slot-{slotKey(slot.ref)}">
        <button data-testid="save-load-{slotKey(slot.ref)}" onclick={() => load(slot.ref)}>Load</button>
        <button data-testid="save-delete-{slotKey(slot.ref)}" onclick={() => remove(slot.ref)}>Delete</button>
      </li>
    {/each}
  </ul>
  <button data-testid="save-export" onclick={exportIt}>Export</button>
  <textarea aria-label="import text" data-testid="save-import-text" value={importText} oninput={(e) => { importText = e.currentTarget.value; }}></textarea>
  <button data-testid="save-import" onclick={importIt}>Import</button>
  {#if message}<p data-testid="save-message">{message}</p>{/if}
</section>
