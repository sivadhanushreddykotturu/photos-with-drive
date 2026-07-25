<script lang="ts">
  import { createShareLink } from '$lib/api/share';
  import { copyToClipboard } from '$lib/utils';
  import { handleError } from '$lib/utils/handle-error';
  import { Button, Field, FormModal, Icon, Input, LoadingSpinner } from '@immich/ui';
  import { mdiCheck, mdiContentCopy, mdiLinkVariant } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    fileId?: string;
    albumId?: string;
    name?: string;
    onClose: () => void;
  };

  let { fileId, albumId, name, onClose }: Props = $props();

  const expiryOptions = [
    { label: $t('expiry_1_day'), hours: 24 },
    { label: $t('expiry_7_days'), hours: 24 * 7 },
    { label: $t('expiry_30_days'), hours: 24 * 30 },
    { label: $t('expiry_never'), hours: null },
  ];

  let selectedHours: number | null = $state(24 * 7);
  let creating = $state(false);
  let createdUrl: string | undefined = $state();
  let copied = $state(false);

  const handleCreate = async () => {
    if (creating) {
      return;
    }
    creating = true;
    try {
      const result = await createShareLink({ fileId, albumId, expiresInHours: selectedHours });
      createdUrl = result.url;
    } catch (error) {
      handleError(error, $t('errors.unable_to_create_share_link'));
    } finally {
      creating = false;
    }
  };

  const handleCopy = async () => {
    if (!createdUrl) {
      return;
    }
    await copyToClipboard(createdUrl);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  };
</script>

<FormModal title={$t('share_link')} icon={mdiLinkVariant} {onClose} onSubmit={() => onClose()}>
  {#if !createdUrl}
    <div class="flex flex-col gap-4">
      {#if name}
        <p class="truncate text-sm text-gray-600 dark:text-gray-300">{name}</p>
      {/if}

      <Field label={$t('link_expires_in')}>
        <div class="flex flex-wrap gap-2">
          {#each expiryOptions as option (option.label)}
            <button
              type="button"
              class="rounded-full border px-3 py-1 text-sm transition-colors {selectedHours === option.hours
                ? 'border-immich-primary bg-immich-primary/10 text-immich-primary'
                : 'border-gray-300 text-gray-600 hover:border-immich-primary dark:border-gray-600 dark:text-gray-300'}"
              onclick={() => (selectedHours = option.hours)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </Field>

      <Button shape="round" fullWidth loading={creating} onclick={handleCreate}>
        {$t('create_share_link')}
      </Button>
    </div>
  {:else}
    <div class="flex flex-col gap-3">
      <Field label={$t('share_link_created')}>
        <div class="flex items-center gap-2">
          <Input value={createdUrl} readonly />
          <Button shape="round" size="small" leadingIcon={copied ? mdiCheck : mdiContentCopy} onclick={handleCopy}>
            {copied ? $t('link_copied') : $t('copy_link')}
          </Button>
        </div>
      </Field>
      <Button shape="round" variant="ghost" color="secondary" onclick={() => onClose()}>
        {$t('done')}
      </Button>
    </div>
  {/if}
</FormModal>
