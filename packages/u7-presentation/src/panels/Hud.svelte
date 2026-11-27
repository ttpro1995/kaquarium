<!-- Hud — top bar (W38): money, level/XP, game-day clock, pause/speed, bell. -->
<script lang="ts">
  import type { Kernel } from '@aquarium/u1-sim-foundation';
  import type { ShellSnapshot, ShellStore } from '../shell/store.js';
  import { selectHud } from '../shell/selectors.js';
  import { setPaused, setSpeed } from './actions.js';
  import { formatGameTime, formatMoney } from './helpers.js';

  interface HudProps {
    store: ShellStore;
    snap: Readonly<ShellSnapshot>;
    kernel: Kernel;
    onbell: () => void;
  }
  let { store, snap, onbell }: HudProps = $props();
  let hud = $derived(selectHud(snap));
  let message: string | null = $state(null);

  function speed(speed: 1 | 2 | 4): void {
    const result = setSpeed(store, speed);
    message = result.message;
  }
  function pause(): void {
    const result = setPaused(store, true);
    message = result.message;
  }
  function resume(): void {
    const result = setPaused(store, false);
    message = result.message;
  }
</script>

<header data-testid="hud">
  <span data-testid="hud-money">{formatMoney(hud.money)}</span>
  <span data-testid="hud-level">Lv {hud.level} · {hud.xp} XP{hud.xpToNext === null ? ' (max)' : ` · ${hud.xpToNext} to next`}</span>
  <span data-testid="hud-clock">{formatGameTime(hud.gameDay, hud.gameHour)}</span>
  {#if hud.paused}
    <button data-testid="hud-resume" onclick={resume}>Resume</button>
  {:else}
    <button data-testid="hud-pause" onclick={pause}>Pause</button>
  {/if}
  <button data-testid="hud-speed-1" disabled={hud.speed === 1} onclick={() => speed(1)}>x1</button>
  <button data-testid="hud-speed-2" disabled={hud.speed === 2} onclick={() => speed(2)}>x2</button>
  <button data-testid="hud-speed-4" disabled={hud.speed === 4} onclick={() => speed(4)}>x4</button>
  <button data-testid="hud-bell" onclick={onbell}>Bell ({hud.unreadCount})</button>
  {#if message}<span data-testid="hud-message">{message}</span>{/if}
</header>
