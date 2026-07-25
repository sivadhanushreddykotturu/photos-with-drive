<script lang="ts">
  import { page } from '$app/state';
  import AuthPageLayout from '$lib/components/layouts/AuthPageLayout.svelte';
  import { apiFetch } from '$lib/api/client';
  import { Route } from '$lib/route';
  import { Alert, Button, LoadingSpinner } from '@immich/ui';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  let viewState: 'loading' | 'success' | 'error' = $state('loading');

  onMount(async () => {
    const token = page.url.searchParams.get('token') ?? '';
    if (!token) {
      viewState = 'error';
      return;
    }

    try {
      await apiFetch<{ status: string }>('/auth/revoke-sessions', {
        method: 'POST',
        body: JSON.stringify({ token }),
        skipAuthRetry: true,
      });
      viewState = 'success';
    } catch {
      viewState = 'error';
    }
  });
</script>

<AuthPageLayout>
  <div class="flex flex-col items-center gap-6 text-center">
    {#if viewState === 'loading'}
      <LoadingSpinner />
    {:else if viewState === 'success'}
      <Alert color="success" title={$t('signed_out_everywhere')} closable={false} />
    {:else}
      <Alert color="danger" title={$t('sign_out_link_invalid')} closable={false} />
    {/if}

    {#if viewState !== 'loading'}
      <Button href={Route.login()} shape="round">{$t('to_login')}</Button>
    {/if}
  </div>
</AuthPageLayout>
