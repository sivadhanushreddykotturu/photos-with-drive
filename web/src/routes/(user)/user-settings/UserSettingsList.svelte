<script lang="ts">
  import SettingAccordion from '$lib/components/shared-components/settings/SettingAccordion.svelte';
  import { mdiCogOutline, mdiGoogleDrive, mdiLinkVariant } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import AppSettings from './AppSettings.svelte';
  import ConnectedAccountsSettings from './ConnectedAccountsSettings.svelte';
  import SharedLinksSettings from './SharedLinksSettings.svelte';
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

<SettingAccordion
  icon={mdiLinkVariant}
  key="shared-links"
  title={$t('shared_links')}
  subtitle={$t('shared_links_description')}
>
  <SharedLinksSettings />
</SettingAccordion>

<SettingAccordion icon={mdiCogOutline} key="app-settings" title={$t('app_settings')} subtitle={$t('manage_the_app_settings')}>
  <AppSettings />
</SettingAccordion>
