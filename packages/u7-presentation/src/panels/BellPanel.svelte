<!-- BellPanel — notification bell (W43; FR12.1). Renders the U6-owned queue
  newest-first with priority icon + text (never colour alone). Clicking a
  fish notification focuses that fish (Tank tab + FishPanel); Dismiss sends
  notifications.dismiss. aria-live polite, criticals assertive. -->
<script lang="ts">
  import type { Kernel } from '@aquarium/u1-sim-foundation';
  import type { ShellSnapshot, ShellStore } from '../shell/store.js';
  import { selectBell } from '../shell/selectors.js';
  import { dismissNotification } from './actions.js';

  interface BellPanelProps {
    store: ShellStore;
    snap: Readonly<ShellSnapshot>;
    kernel: Kernel;
    onfocus: (subjectId: string) => void;
  }
  let { store, snap, onfocus }: BellPanelProps = $props();
  let message: string | null = $state(null);

  let bell = $derived(selectBell(snap));
  let ordered = $derived([...bell.notifications].reverse());

  function dismiss(id: string): void {
    const result = dismissNotification(store, id);
    message = result.message;
  }
</script>

<section data-testid="bell-panel" aria-live="polite">
  <ul>
    {#each ordered as n (n.id)}
      <li data-testid="bell-item-{n.id}" data-critical={n.priority === 'critical'}>
        <span>[{n.priority}] {n.message}</span>
        {#if n.subjectId}<button data-testid="bell-focus-{n.id}" onclick={() => { if (n.subjectId !== undefined) onfocus(n.subjectId); }}>Focus</button>{/if}
        <button data-testid="bell-dismiss-{n.id}" onclick={() => dismiss(n.id)}>Dismiss</button>
      </li>
    {/each}
  </ul>
  {#if message}<p data-testid="bell-message">{message}</p>{/if}
</section>
