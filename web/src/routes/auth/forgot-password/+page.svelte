<script lang="ts">
  import AuthPageLayout from '$lib/components/layouts/AuthPageLayout.svelte';
  import { Route } from '$lib/route';
  import * as authApi from '$lib/api/auth';
  import { Alert, Button, Field, Input, Text } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let email = $state('');
  let loading = $state(false);
  let sent = $state(false);

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    if (!email || loading) {
      return;
    }

    loading = true;
    try {
      await authApi.forgotPassword(email);
    } catch {
      // The backend always returns ok; never reveal whether the email exists.
    } finally {
      sent = true;
      loading = false;
    }
  };
</script>

<AuthPageLayout title={data.meta.title}>
  {#if sent}
    <Alert color="primary" class="mb-4">
      <Text>{$t('password_reset_email_sent')}</Text>
    </Alert>
    <div class="mt-4 text-center">
      <a href={Route.login()} class="text-sm text-primary hover:underline">{$t('to_login')}</a>
    </div>
  {:else}
    <form onsubmit={onSubmit} class="flex flex-col gap-4">
      <Field label={$t('email')} required="indicator">
        <Input id="email" name="email" type="email" autocomplete="email" bind:value={email} />
      </Field>

      <Button type="submit" size="large" shape="round" fullWidth {loading} class="mt-4">{$t('reset_password')}</Button>

      <div class="mt-2 text-center">
        <a href={Route.login()} class="text-sm text-primary hover:underline">{$t('to_login')}</a>
      </div>
    </form>
  {/if}
</AuthPageLayout>
