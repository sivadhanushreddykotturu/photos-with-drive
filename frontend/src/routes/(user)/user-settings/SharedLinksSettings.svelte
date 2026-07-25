<script lang="ts">
  import { listShareLinks, deleteShareLink, type ShareLink } from '$lib/api/share';
  import { handleError } from '$lib/utils/handle-error';
  import { Icon, IconButton, LoadingSpinner, modalManager } from '@immich/ui';
  import { mdiDeleteOutline, mdiLinkVariant } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  let links: ShareLink[] | undefined = $state();

  const load = async () => {
    try {
      links = await listShareLinks();
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_changes'));
      links = [];
    }
  };

  onMount(load);

  const linkName = (link: ShareLink) => link.file?.name ?? link.album?.name ?? '?';

  const isExpired = (link: ShareLink) => link.expiresAt !== null && new Date(link.expiresAt) < new Date();

  const handleRevoke = async (link: ShareLink) => {
    const confirmed = await modalManager.showDialog({
      title: $t('revoke'),
      prompt: $t('revoke_link_confirmation'),
    });
    if (!confirmed) {
      return;
    }

    try {
      await deleteShareLink(link.id);
      links = links?.filter((existing) => existing.id !== link.id);
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_changes'));
    }
  };
</script>

<div class="flex flex-col gap-3">
  {#if links === undefined}
    <div class="flex justify-center p-4"><LoadingSpinner /></div>
  {:else if links.length === 0}
    <p class="text-sm text-gray-500 dark:text-gray-400">{$t('no_shared_links')}</p>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each links as link (link.id)}
        <li class="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <Icon icon={mdiLinkVariant} size="22" class="shrink-0 text-primary" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{linkName(link)}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {#if isExpired(link)}
                <span class="text-red-500">{$t('expired')}</span>
              {:else if link.expiresAt}
                {$t('expires')}: {new Date(link.expiresAt).toLocaleString()}
              {:else}
                {$t('expiry_never')}
              {/if}
            </p>
          </div>
          <IconButton
            shape="round"
            color="danger"
            variant="ghost"
            size="small"
            icon={mdiDeleteOutline}
            aria-label={$t('revoke')}
            onclick={() => handleRevoke(link)}
          />
        </li>
      {/each}
    </ul>
  {/if}
</div>
