<script lang="ts">
  import { shortcut } from '$lib/actions/shortcut';

  import MenuOption from '$lib/components/shared-components/context-menu/MenuOption.svelte';
  import { buildMediaUrl } from '$lib/api/client';
  import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import { downloadAssets } from '$lib/utils/asset-utils';
  import { downloadUrl } from '$lib/utils';
  import { getAssetInfo } from '$lib/api/compat';
  import { handleError } from '$lib/utils/handle-error';
  import { IconButton, toastManager } from '@immich/ui';
  import { mdiDownload } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    menuItem?: boolean;
  }

  let { menuItem = false }: Props = $props();

  const ZIP_MAX_FILES = 50;

  const handleDownloadFiles = async () => {
    const assets = assetMultiSelectManager.assets;
    try {
      if (assets.length === 1) {
        const asset = await getAssetInfo({ id: assets[0].id });
        await downloadAssets([asset]);
      } else if (assets.length > 1) {
        const ids = assets.map((asset) => asset.id);
        if (ids.length > ZIP_MAX_FILES) {
          toastManager.warning($t('download_zip_limit', { values: { count: ZIP_MAX_FILES } }), { timeout: 8000 });
        }
        // Server streams one ZIP: Drive -> backend -> browser, no multi-download prompts.
        downloadUrl(buildMediaUrl('/files/download-zip', { ids: ids.slice(0, ZIP_MAX_FILES).join(',') }), 'photos.zip');
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
