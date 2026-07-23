<script lang="ts">
  import UserPageLayout from '$lib/components/layouts/UserPageLayout.svelte';
  import ButtonContextMenu from '$lib/components/shared-components/context-menu/ButtonContextMenu.svelte';
  import EmptyPlaceholder from '$lib/components/shared-components/EmptyPlaceholder.svelte';
  import DeleteAssets from '$lib/components/timeline/actions/DeleteAssetsAction.svelte';
  import DownloadAction from '$lib/components/timeline/actions/DownloadAction.svelte';
  import SelectAllAssets from '$lib/components/timeline/actions/SelectAllAction.svelte';
  import AssetSelectControlBar from '$lib/components/timeline/AssetSelectControlBar.svelte';
  import Timeline from '$lib/components/timeline/Timeline.svelte';
  import { AssetAction } from '$lib/constants';
  import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { goto } from '$app/navigation';
  import { TimelineManager } from '$lib/managers/timeline-manager/timeline-manager.svelte';
  import { mediaStore } from '$lib/managers/timeline-manager/internal/media-store.svelte';
  import { Route } from '$lib/route';
  import { connectedAccountsStore } from '$lib/stores/connected-accounts.svelte';
  import { openFileUploadDialog } from '$lib/utils/file-uploader';
  import { AssetVisibility } from '$lib/api/compat';
  import { mdiDotsVertical } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  let timelineManager = $state<TimelineManager>() as TimelineManager;
  const options = { visibility: AssetVisibility.Timeline };

  const handleEscape = () => {
    if (assetViewerManager.isViewing) {
      return;
    }
    if (assetMultiSelectManager.selectionActive) {
      assetMultiSelectManager.clear();
      return;
    }
  };

  onMount(() => {
    void connectedAccountsStore.load();
  });
</script>

<UserPageLayout hideNavbar={assetMultiSelectManager.selectionActive} scrollbar={false}>
  <Timeline
    enableRouting={true}
    bind:timelineManager
    {options}
    assetInteraction={assetMultiSelectManager}
    onEscape={handleEscape}
  >
    {#snippet empty()}
      {#if connectedAccountsStore.accounts !== undefined && !connectedAccountsStore.hasAccounts}
        <EmptyPlaceholder
          text={$t('connect_account_to_get_started')}
          onClick={() => goto(Route.userSettings())}
          class="mx-auto mt-10"
        />
      {:else}
        <EmptyPlaceholder text={$t('no_assets_message')} onClick={() => openFileUploadDialog()} class="mx-auto mt-10" />
      {/if}
    {/snippet}
  </Timeline>
</UserPageLayout>

{#if assetMultiSelectManager.selectionActive}
  <AssetSelectControlBar>
    <SelectAllAssets {timelineManager} assetInteraction={assetMultiSelectManager} />
    <ButtonContextMenu icon={mdiDotsVertical} title={$t('menu')}>
      <DownloadAction menuItem />
      <DeleteAssets
        menuItem
        onAssetDelete={(assetIds: string[]) => {
          timelineManager.removeAssets(assetIds);
          mediaStore.removeFiles(assetIds);
        }}
      />
    </ButtonContextMenu>
  </AssetSelectControlBar>
{/if}
