<!-- Toolbar — tab navigation (W38; W43 bell reachable). Tab state is UI-local, never GameState. -->
<script lang="ts">
  export type Tab = 'tank' | 'store' | 'feeding' | 'breeding' | 'orders' | 'roster' | 'save' | 'settings' | 'bell';

  interface ToolbarProps {
    activeTab: Tab;
    onswitch: (tab: Tab) => void;
  }
  let { activeTab, onswitch }: ToolbarProps = $props();
  const tabs: Tab[] = ['tank', 'store', 'feeding', 'breeding', 'orders', 'roster', 'save', 'settings', 'bell'];
</script>

<nav data-testid="toolbar">
  {#each tabs as tab (tab)}
    <button
      data-testid="toolbar-tab-{tab}"
      aria-pressed={activeTab === tab}
      disabled={activeTab === tab}
      onclick={() => onswitch(tab)}>{tab}</button>
  {/each}
</nav>
