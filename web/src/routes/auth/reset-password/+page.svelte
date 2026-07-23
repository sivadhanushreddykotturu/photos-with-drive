<script lang="ts">
  import { goto } from '$app/navigation';
  import AuthPageLayout from '$lib/components/layouts/AuthPageLayout.svelte';
  import { Route } from '$lib/route';
  import { getServerErrorMessage } from '$lib/utils/handle-error';
  import * as authApi from '$lib/api/auth';
  import { Alert, Button, Field, PasswordInput } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let password = $state('');
  let confirmPassword = $state('');
  let loading = $state(false);
  let errorMessage = $state('');

  const passwordsMatch = $derived(password === confirmPassword || confirmPassword.length === 0);
  const valid = $derived(data.token.length > 0 && password === confirmPassword && password.length >= 8);

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    if (!valid || loading) {
      return;
    }

    loading = true;
    errorMessage = '';
    try {
      await authApi.resetPassword(data.token, password);
      await goto(Route.login());
    } catch (error) {
      errorMessage = getServerErrorMessage(error) || $t('errors.unable_to_reset_password');
      loading = false;
    }
  };
</script>

<AuthPageLayout title={data.meta.title}>
  <form onsubmit={onSubmit} class="flex flex-col gap-4">
    {#if !data.token}
      <Alert color="danger" title={$t('errors.unable_to_reset_password')} />
    {/if}

    <Field label={$t('new_password')} required>
      <PasswordInput bind:value={password} autocomplete="new-password" />
    </Field>

    <Field label={$t('confirm_password')} required>
      <PasswordInput bind:value={confirmPassword} autocomplete="new-password" />
    </Field>

    {#if !passwordsMatch}
      <Alert color="danger" title={$t('password_does_not_match')} size="medium" />
    {/if}

    {#if errorMessage}
      <Alert color="danger" title={errorMessage} size="medium" />
    {/if}

    <Button class="mt-4" type="submit" size="giant" shape="round" fullWidth disabled={!valid || loading} {loading}
      >{$t('reset_password')}</Button
    >
  </form>
</AuthPageLayout>
