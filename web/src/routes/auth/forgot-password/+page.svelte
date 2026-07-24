<script lang="ts">
  import { goto } from '$app/navigation';
  import AuthPageLayout from '$lib/components/layouts/AuthPageLayout.svelte';
  import OtpInput from '$lib/components/OtpInput.svelte';
  import { Route } from '$lib/route';
  import { getServerErrorMessage } from '$lib/utils/handle-error';
  import * as authApi from '$lib/api/auth';
  import { Alert, Button, Field, Input, LoadingSpinner, PasswordInput, Text } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let email = $state('');
  let loading = $state(false);
  let codeSent = $state(false);
  let errorMessage = $state('');

  // Step 2: code + new password
  let code = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let resetting = $state(false);

  const passwordsMatch = $derived(password === confirmPassword || confirmPassword.length === 0);
  const resetValid = $derived(code.length === 6 && password === confirmPassword && password.length >= 8);

  const onSendCode = async (event: Event) => {
    event.preventDefault();
    if (!email || loading) {
      return;
    }

    loading = true;
    errorMessage = '';
    try {
      await authApi.forgotPassword(email);
      codeSent = true;
    } catch (error) {
      errorMessage = getServerErrorMessage(error) || $t('errors.unable_to_send_code');
    } finally {
      loading = false;
    }
  };

  const onReset = async (event: Event) => {
    event.preventDefault();
    if (!resetValid || resetting) {
      return;
    }

    resetting = true;
    errorMessage = '';
    try {
      await authApi.resetPassword(email, code, password);
      await goto(Route.login());
    } catch (error) {
      errorMessage = getServerErrorMessage(error) || $t('errors.invalid_code');
      resetting = false;
    }
  };
</script>

<AuthPageLayout title={data.meta.title}>
  {#if !codeSent}
    <form onsubmit={onSendCode} class="flex flex-col gap-4">
      <Field label={$t('email')} required="indicator">
        <Input id="email" name="email" type="email" autocomplete="email" bind:value={email} />
      </Field>

      {#if errorMessage}
        <Alert color="danger" title={errorMessage} closable />
      {/if}

      <Button type="submit" size="large" shape="round" fullWidth {loading} class="mt-4">{$t('send_code')}</Button>

      <div class="mt-2 text-center">
        <a href={Route.login()} class="text-sm text-primary hover:underline">{$t('to_login')}</a>
      </div>
    </form>
  {:else}
    <form onsubmit={onReset} class="flex flex-col gap-4">
      <Alert color="primary" class="mb-2">
        <Text>{$t('code_sent_to', { values: { email } })}</Text>
      </Alert>

      <div class="flex justify-center">
        <OtpInput onComplete={(value) => (code = value)} />
      </div>

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
        <Alert color="danger" title={errorMessage} closable />
      {/if}

      <Button type="submit" size="large" shape="round" fullWidth disabled={!resetValid || resetting} loading={resetting} class="mt-4">
        {$t('reset_password')}
      </Button>

      <div class="mt-2 text-center">
        <button type="button" class="text-sm text-primary hover:underline" onclick={() => (codeSent = false)}>
          {$t('use_a_different_email')}
        </button>
      </div>
    </form>
  {/if}
</AuthPageLayout>
