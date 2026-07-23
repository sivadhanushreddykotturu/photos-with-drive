<script lang="ts">
  import { shortcut } from '$lib/actions/shortcut';

  import MenuOption from '$lib/components/shared-components/context-menu/MenuOption.svelte';
  import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import { downloadAssets } from '$lib/utils/asset-utils';
  import { getAssetInfo } from '$lib/api/compat';
  import { handleError } from '$lib/utils/handle-error';
  import { IconButton } from '@immich/ui';
  import { mdiDownload } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    menuItem?: boolean;
  }

  let { menuItem = false }: Props = $props();

  const handleDownloadFiles = async () => {
    const assets = assetMultiSelectManager.assets;
    try {
      if (assets.length === 1) {
        const asset = await getAssetInfo({ id: assets[0].id });
        await downloadAssets([asset]);
      } else {
        const infos = await Promise.all(assets.map((asset) => getAssetInfo({ id: asset.id })));
        await downloadAssets(infos);
      }
    } catch (error) {
      handleError(error, $t('errors.unable_to_download_files'));
    }
    assetMultiSelectManager.clear();
  };
</script>

<svelte:document use:shortcut={{ shortcut: { key: 'd', shift: true }, onShortcut: handleDownloadFiles }} />

{#if menuItem}
  <MenuOption text={$t('download')} icon={mdiDownload} onClick={handleDownloadFiles} />
{:else}
  <IconButton
    shape="round"
    color="secondary"
    variant="ghost"
    aria-label={$t('download')}
    icon={mdiDownload}
    onclick={handleDownloadFiles}
  />
{/if}
