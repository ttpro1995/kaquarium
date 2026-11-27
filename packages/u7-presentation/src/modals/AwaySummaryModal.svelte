<!-- AwaySummaryModal — single while-you-were-away summary (W45). Blocking
  modal: elapsed days plus hatched/matured/died/orders counts computed from
  the catch-up event batch. Resume dispatches clock.setPaused false (speed
  restarts at 1 per U1 BR1.2) and closes the modal. -->
<script lang="ts">
  import type { AwaySummary } from '../shell/away.js';

  interface AwaySummaryModalProps {
    summary: AwaySummary;
    onresume: () => void;
  }
  let { summary, onresume }: AwaySummaryModalProps = $props();
</script>

<div data-testid="away-summary-modal" role="dialog" aria-modal="true">
  <h2 data-testid="away-title">While you were away ({summary.elapsedDays}d)</h2>
  <p data-testid="away-counts">hatched {summary.hatched} · matured {summary.matured} · died {summary.diedOfOldAge} · expired {summary.ordersExpired}{summary.capped ? ' · capped' : ''}</p>
  <button data-testid="away-resume" onclick={onresume}>Resume</button>
</div>
