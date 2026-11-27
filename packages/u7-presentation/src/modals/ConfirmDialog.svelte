<!-- ConfirmDialog — blocking STALE_SAVE confirm (W44). Never a silent
  overwrite: the pending load/import retries with confirmStale only after
  the player confirms. -->
<script lang="ts">
  interface ConfirmDialogProps {
    message: string;
    onconfirm: () => void;
    oncancel: () => void;
  }
  let { message, onconfirm, oncancel }: ConfirmDialogProps = $props();
</script>

<div data-testid="confirm-dialog" role="alertdialog" aria-modal="true">
  <p data-testid="confirm-message">{message}</p>
  <button data-testid="confirm-ok" onclick={onconfirm}>Load anyway</button>
  <button data-testid="confirm-cancel" onclick={oncancel}>Cancel</button>
</div>
