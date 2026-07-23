<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import AuthPageLayout from '$lib/components/layouts/AuthPageLayout.svelte';
  import { Route } from '$lib/route';
  import { Alert, Button, LoadingSpinner } from '@immich/ui';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  const status = $derived(page.url.searchParams.get('status'));

  onMount(() => {
    if (status === 'success') {
      const timeout = setTimeout(() => goto(Route.userSettings()), 1500);
      return () => clearTimeout(timeout);
    }
  });
</script>

<AuthPageLayout>
  <div class="flex flex-col items-center gap-6 text-center">
    {#if status === 'success'}
      <Alert color="success" title={$t('account_connected_successfully')} closable={false} />
      <div class="flex items-center gap-2 text-sm text-gray-500">
        <LoadingSpinner />
        <span>{$t('redirecting')}</span>
      </div>
    {:else}
      <Alert color="danger" title={$t('errors.unable_to_connect_account')} closable={false} />
      <Button href={Route.userSettings()} shape="round">{$t('go_to_settings')}</Button>
    {/if}
  </div>
</AuthPageLayout>
