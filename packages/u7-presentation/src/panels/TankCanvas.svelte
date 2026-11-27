<!-- TankCanvas — living tank render surface (W36/W37). Owns the ONLY Pixi
  Application/stage via mountTankCanvas: factories are injectable (tests),
  production lazily imports pixi.js, and anything without WebGL soft-fails
  to the fallback instead of crashing boot. Lighting tint follows the game
  clock (snapped under reduced motion); the background and canvas size props
  are forwarded to the factory, never hardcoded. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ShellSnapshot } from '../shell/store.js';
  import { mountTankCanvas, type PixiFactories } from '../tank/pixiStage.js';
  import { selectTankScene } from '../shell/selectors.js';
  import { snappedTint, tintFor, tintHex } from '../tank/lighting.js';

  interface TankCanvasProps {
    snap: Readonly<ShellSnapshot>;
    pixi?: PixiFactories | undefined;
    focusFishId?: string | null | undefined;
    width?: number | undefined;
    height?: number | undefined;
  }
  let { snap, pixi = undefined, focusFishId = null, width = 800, height = 450 }: TankCanvasProps = $props();
  let el: HTMLDivElement | null = $state(null);
  let ready = $state(false);
  let fallback = $state(false);

  let scene = $derived(selectTankScene(snap));

  let background = $derived.by(() => {
    const tint = scene.reducedMotion ? snappedTint(scene.gameHour) : tintFor(scene.gameDay, scene.gameHour);
    return tintHex(tint);
  });

  onMount(() => {
    let cancelled = false;
    if (el !== null) {
      const host: Element = el;
      void mountTankCanvas(host, { background, width, height, factories: pixi }).then((mounted) => {
        if (cancelled) return;
        ready = !mounted.fallback;
        fallback = mounted.fallback;
      });
    }
    return () => {
      cancelled = true;
    };
  });
</script>

<div data-testid="tank-canvas" data-focus-fish={focusFishId ?? ''} data-fish-count={scene.fish.length}>
  <div bind:this={el} data-testid="tank-stage-host"></div>
  {#if ready}<div data-testid="pixi-stage" data-background={background}></div>{/if}
  {#if fallback}<div data-testid="tank-canvas-fallback">3D water unavailable — fish list below.</div>{/if}
  <ul>
    {#each scene.fish as fish (fish.id)}
      <li data-testid="tank-fish-{fish.id}">{fish.id}</li>
    {/each}
  </ul>
</div>
