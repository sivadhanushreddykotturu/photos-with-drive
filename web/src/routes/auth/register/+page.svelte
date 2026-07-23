<script lang="ts">
  import { goto } from '$app/navigation';
  import AuthPageLayout from '$lib/components/layouts/AuthPageLayout.svelte';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { eventManager } from '$lib/managers/event-manager.svelte';
  import { Route } from '$lib/route';
  import { getServerErrorMessage } from '$lib/utils/handle-error';
  import * as authApi from '$lib/api/auth';
  import { apiUserToUserAdminDto } from '$lib/api/compat';
  import { Alert, Button, Field, Input, PasswordInput } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let name = $state('');
  let loading = $state(false);
  let errorMessage = $state('');

  const passwordsMatch = $derived(password === confirmPassword || confirmPassword.length === 0);
  const valid = $derived(password === confirmPassword && confirmPassword.length > 0 && name.length >= 2);

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const onSubmit = async (event: Event) => {
    event.preventDefault();

    if (!valid || loading) {
      return;
    }

    loading = true;
    errorMessage = '';

    try {
      const user = await authApi.register(name, email, password);
      authManager.setUser(apiUserToUserAdminDto(user));
      eventManager.emit('AuthLogin', user);
      await goto(Route.photos(), { invalidateAll: true });
    } catch (error) {
      errorMessage = getServerErrorMessage(error) || $t('errors.unable_to_create_admin_account');
    } finally {
      loading = false;
    }
  };
</script>

<AuthPageLayout title={data.meta.title}>
  <form onsubmit={onSubmit} method="post" class="flex flex-col gap-4">
    <Field label={$t('name')} required>
      <Input bind:value={name} type="text" autocomplete="name" />
    </Field>

    <Field label={$t('email')} required>
      <Input bind:value={email} type="email" autocomplete="email" />
    </Field>

    <Field label={$t('password')} required>
      <PasswordInput bind:value={password} autocomplete="new-password" />
    </Field>

    <Field label={$t('confirm_password')} required>
      <PasswordInput bind:value={confirmPassword} autocomplete="new-password" />
    </Field>

    {#if !passwordsMatch}
      <Alert color="danger" title={$t('password_does_not_match')} size="medium" />
    {/if}

    {#if errorMessage}
      <Alert color="danger" title={errorMessage} size="medium" class="mt-4" />
    {/if}

    <Button class="mt-4" type="submit" size="giant" shape="round" fullWidth disabled={!valid || loading} {loading}
      >{$t('sign_up')}</Button
    >

    <div class="mt-2 text-center">
      <a href={Route.login()} class="text-sm text-primary hover:underline">{$t('to_login')}</a>
    </div>
  </form>
</AuthPageLayout>
