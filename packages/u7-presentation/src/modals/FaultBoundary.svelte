<!-- FaultBoundary — full-screen tick-abort fault panel (W46; C2). Catches
  render faults and tick-abort surfacing; the ONLY action is reload to the
  last autosave. Never a store rollback. -->
<script lang="ts">
  import type { FaultInfo } from '../shell/fault.js';

  interface FaultBoundaryProps {
    fault: FaultInfo;
    onreload: () => void;
  }
  let { fault, onreload }: FaultBoundaryProps = $props();
  let message: string | null = $state(null);

  function reload(): void {
    onreload();
  }
</script>

<div data-testid="fault-boundary" role="alert">
  <h2 data-testid="fault-title">Simulation halted ({fault.systemId} at tick {fault.tick})</h2>
  <p data-testid="fault-message">{fault.message}</p>
  <button data-testid="fault-reload" onclick={reload}>Reload last autosave</button>
  {#if message}<p data-testid="fault-reload-message">{message}</p>{/if}
</div>
