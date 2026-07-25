<script lang="ts">
  import { Button, FormModal } from '@immich/ui';
  import { mdiCellphoneArrowDown } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    version: string;
    notes?: string;
    downloadUrl: string;
    onClose: () => void;
  };

  let { version, notes = '', downloadUrl, onClose }: Props = $props();
</script>

<FormModal title={$t('update_available')} icon={mdiCellphoneArrowDown} {onClose} onSubmit={() => onClose()}>
  <div class="flex flex-col gap-4">
    <p class="text-sm">
      {$t('update_available_description', { values: { version } })}
    </p>

    {#if notes}
      <div class="max-h-48 overflow-y-auto rounded-xl bg-gray-100 p-3 text-xs whitespace-pre-wrap dark:bg-gray-800">
        {notes.slice(0, 600)}
      </div>
    {/if}

    <div class="flex justify-end gap-2">
      <Button shape="round" variant="ghost" color="secondary" onclick={() => onClose()}>
        {$t('later')}
      </Button>
      <Button shape="round" href={downloadUrl} target="_blank" rel="noopener noreferrer">
        {$t('download_update')}
      </Button>
    </div>
  </div>
</FormModal>
