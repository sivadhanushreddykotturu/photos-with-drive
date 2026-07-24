<script lang="ts">
  import { goto } from '$app/navigation';
  import AuroraAuthShell from '$lib/components/layouts/AuroraAuthShell.svelte';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { eventManager } from '$lib/managers/event-manager.svelte';
  import { Route } from '$lib/route';
  import { getServerErrorMessage } from '$lib/utils/handle-error';
  import * as authApi from '$lib/api/auth';
  import { apiUserToUserAdminDto } from '$lib/api/compat';
  import { Alert, Button, Field, Input, PasswordInput } from '@immich/ui';
  import { t } from 'svelte-i18n';

  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let name = $state('');
  let loading = $state(false);
  let errorMessage = $state('');

  const passwordsMatch = $derived(password === confirmPassword || confirmPassword.length === 0);
  const valid = $derived(password === confirmPassword && password.length >= 8 && name.length >= 2);

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

<AuroraAuthShell>
  <h1 class="mb-6 text-2xl font-bold text-white">{$t('sign_up')}</h1>

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
      <Alert color="danger" title={errorMessage} size="medium" />
    {/if}

    <Button class="mt-2" type="submit" size="large" shape="round" fullWidth disabled={!valid || loading} {loading}>
      {$t('sign_up')}
    </Button>

    <div class="mt-2 text-center">
      <a href={Route.login()} class="text-sm text-cyan-300 hover:underline">{$t('to_login')}</a>
    </div>
  </form>
</AuroraAuthShell>
