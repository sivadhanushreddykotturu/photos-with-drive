<script lang="ts">
  import { goto } from '$app/navigation';
  import AuthPageLayout from '$lib/components/layouts/AuthPageLayout.svelte';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { eventManager } from '$lib/managers/event-manager.svelte';
  import { Route } from '$lib/route';
  import { getServerErrorMessage } from '$lib/utils/handle-error';
  import * as authApi from '$lib/api/auth';
  import { apiUserToUserAdminDto } from '$lib/api/compat';
  import { Alert, Button, Field, Input, PasswordInput, Stack } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let errorMessage: string = $state('');
  let email = $state('');
  let password = $state('');
  let loading = $state(false);

  const handleLogin = async () => {
    try {
      errorMessage = '';
      loading = true;
      const user = await authApi.login(email, password);
      authManager.setUser(apiUserToUserAdminDto(user));
      eventManager.emit('AuthLogin', user);
      await goto(data.continueUrl, { invalidateAll: true });
      return;
    } catch (error) {
      errorMessage = getServerErrorMessage(error) || $t('errors.incorrect_email_or_password');
      loading = false;
      return;
    }
  };

  const onsubmit = async (event: Event) => {
    event.preventDefault();
    await handleLogin();
  };
</script>

<AuthPageLayout title={data.meta.title}>
  <Stack gap={4}>
    <form {onsubmit} class="flex flex-col gap-4">
      {#if errorMessage}
        <Alert color="danger" title={errorMessage} closable />
      {/if}

      <Field label={$t('email')} required="indicator">
        <Input id="email" name="email" type="email" autocomplete="email" bind:value={email} />
      </Field>

      <Field label={$t('password')} required="indicator">
        <PasswordInput id="password" bind:value={password} autocomplete="current-password" />
      </Field>

      <Button type="submit" size="large" shape="round" fullWidth {loading} class="mt-6">{$t('to_login')}</Button>
    </form>

    <div class="mt-2 flex flex-col items-center gap-2">
      <a href={Route.forgotPassword()} class="text-sm text-primary hover:underline">{$t('forgot_password')}</a>
      <a href={Route.register()} class="text-sm text-primary hover:underline">{$t('sign_up')}</a>
    </div>
  </Stack>
</AuthPageLayout>
