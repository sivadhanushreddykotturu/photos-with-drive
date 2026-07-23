<script lang="ts">
  import { patchFile } from '$lib/api/files';
  import { fileRecordToAssetDto, type AssetResponseDto } from '$lib/api/compat';
  import { handleError } from '$lib/utils/handle-error';
  import { Field, FormModal, Input } from '@immich/ui';
  import { mdiPencilOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    asset: AssetResponseDto;
    onClose: (renamed?: AssetResponseDto) => void;
  };

  let { asset, onClose }: Props = $props();

  let name = $state(asset.originalFileName);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === asset.originalFileName) {
      onClose();
      return;
    }

    try {
      const updated = await patchFile(asset.id, { name: trimmed });
      onClose(fileRecordToAssetDto(updated));
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_changes'));
      onClose();
    }
  };
</script>

<FormModal title={$t('rename')} icon={mdiPencilOutline} {onClose} onSubmit={handleSubmit}>
  <Field label={$t('name')} required="indicator">
    <Input bind:value={name} autofocus />
  </Field>
</FormModal>
