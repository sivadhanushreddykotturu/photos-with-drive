<script lang="ts">
  import SettingAccordion from '$lib/components/shared-components/settings/SettingAccordion.svelte';
  import { mdiCogOutline, mdiGoogleDrive } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import AppSettings from './AppSettings.svelte';
  import ConnectedAccountsSettings from './ConnectedAccountsSettings.svelte';
</script>

<SettingAccordion
  icon={mdiGoogleDrive}
  key="connected-accounts"
  title={$t('connected_accounts')}
  subtitle={$t('connected_accounts_description')}
  isOpen={true}
>
  <ConnectedAccountsSettings />
</SettingAccordion>

<SettingAccordion icon={mdiCogOutline} key="app-settings" title={$t('app_settings')} subtitle={$t('manage_the_app_settings')}>
  <AppSettings />
</SettingAccordion>
