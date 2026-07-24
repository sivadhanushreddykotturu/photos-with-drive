<script lang="ts">
  import { goto } from '$app/navigation';
  import OtpInput from '$lib/components/OtpInput.svelte';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { eventManager } from '$lib/managers/event-manager.svelte';
  import { Route } from '$lib/route';
  import { getServerErrorMessage } from '$lib/utils/handle-error';
  import * as authApi from '$lib/api/auth';
  import { apiUserToUserAdminDto } from '$lib/api/compat';
  import { Alert, Button, Field, Input, LoadingSpinner, PasswordInput } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  type Mode = 'password' | 'code';
  let mode = $state<Mode>('password');

  let errorMessage: string = $state('');
  let email = $state('');
  let password = $state('');
  let loading = $state(false);

  // OTP flow state
  let codeSent = $state(false);
  let verifying = $state(false);

  const completeLogin = async (user: Awaited<ReturnType<typeof authApi.login>>) => {
    authManager.setUser(apiUserToUserAdminDto(user));
    eventManager.emit('AuthLogin', user);
    await goto(data.continueUrl, { invalidateAll: true });
  };

  const handlePasswordLogin = async () => {
    try {
      errorMessage = '';
      loading = true;
      const user = await authApi.login(email, password);
      await completeLogin(user);
    } catch (error) {
      errorMessage = getServerErrorMessage(error) || $t('errors.incorrect_email_or_password');
      loading = false;
    }
  };

  const handleSendCode = async () => {
    try {
      errorMessage = '';
      loading = true;
      await authApi.requestOtp(email);
      codeSent = true;
    } catch (error) {
      errorMessage = getServerErrorMessage(error) || $t('errors.unable_to_send_code');
    } finally {
      loading = false;
    }
  };

  const handleVerifyCode = async (code: string) => {
    try {
      errorMessage = '';
      verifying = true;
      const user = await authApi.verifyOtp(email, code);
      await completeLogin(user);
    } catch (error) {
      errorMessage = getServerErrorMessage(error) || $t('errors.invalid_code');
      verifying = false;
    }
  };

  const switchMode = (next: Mode) => {
    mode = next;
    errorMessage = '';
    codeSent = false;
  };
</script>

<div class="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0B1026] p-4">
  <!-- Signature: drifting aurora light-pool -->
  <div class="aurora-orb" aria-hidden="true"></div>
  <div class="aurora-orb aurora-orb--second" aria-hidden="true"></div>

  <div class="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl md:grid-cols-[1.1fr_1fr]">
    <!-- Brand panel -->
    <div class="hidden flex-col justify-between p-10 md:flex">
      <div>
        <p class="font-mono text-xs tracking-[0.3em] text-cyan-300/80 uppercase">PhotoDrive</p>
        <h1 class="mt-6 text-4xl leading-tight font-bold text-white">
          Every photo.<br />Every drive.<br />One place.
        </h1>
        <p class="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
          Pool your Google Drive accounts into a single, calm library. Your photos stay in your drives — this is just the window.
        </p>
      </div>
      <p class="font-mono text-xs text-slate-500">self-hosted · multi-drive · open</p>
    </div>

    <!-- Form panel -->
    <div class="flex flex-col gap-6 p-6 sm:p-10">
      <div class="md:hidden">
        <p class="font-mono text-xs tracking-[0.3em] text-cyan-300/80 uppercase">PhotoDrive</p>
      </div>

      <!-- Mode tabs -->
      <div class="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/20 p-1">
        <button
          type="button"
          class="rounded-xl px-3 py-2 text-sm font-medium transition-colors {mode === 'password'
            ? 'bg-white/10 text-white'
            : 'text-slate-400 hover:text-white'}"
          onclick={() => switchMode('password')}
        >
          {$t('password')}
        </button>
        <button
          type="button"
          class="rounded-xl px-3 py-2 text-sm font-medium transition-colors {mode === 'code'
            ? 'bg-white/10 text-white'
            : 'text-slate-400 hover:text-white'}"
          onclick={() => switchMode('code')}
        >
          {$t('email_code')}
        </button>
      </div>

      {#if errorMessage}
        <Alert color="danger" title={errorMessage} closable />
      {/if}

      {#if mode === 'password'}
        <form
          onsubmit={(event) => {
            event.preventDefault();
            void handlePasswordLogin();
          }}
          class="flex flex-col gap-4"
        >
          <Field label={$t('email')} required="indicator">
            <Input id="email" name="email" type="email" autocomplete="email" bind:value={email} required />
          </Field>

          <Field label={$t('password')} required="indicator">
            <PasswordInput id="password" bind:value={password} autocomplete="current-password" required />
          </Field>

          <Button type="submit" size="large" shape="round" fullWidth {loading} class="mt-2">{$t('to_login')}</Button>
        </form>

        <div class="flex flex-col items-center gap-2">
          <a href={Route.forgotPassword()} class="text-sm text-cyan-300 hover:underline">{$t('forgot_password')}</a>
          <a href={Route.register()} class="text-sm text-cyan-300 hover:underline">{$t('sign_up')}</a>
        </div>
      {:else if !codeSent}
        <form
          onsubmit={(event) => {
            event.preventDefault();
            void handleSendCode();
          }}
          class="flex flex-col gap-4"
        >
          <p class="text-sm text-slate-400">{$t('email_code_description')}</p>
          <Field label={$t('email')} required="indicator">
            <Input id="otp-email" name="email" type="email" autocomplete="email" bind:value={email} required />
          </Field>
          <Button type="submit" size="large" shape="round" fullWidth {loading}>{$t('send_code')}</Button>
        </form>
      {:else}
        <div class="flex flex-col items-center gap-5">
          <p class="text-center text-sm text-slate-400">
            {$t('code_sent_to', { values: { email } })}
          </p>
          {#if verifying}
            <LoadingSpinner />
          {:else}
            <OtpInput onComplete={handleVerifyCode} />
          {/if}
          <button type="button" class="text-sm text-cyan-300 hover:underline" onclick={() => (codeSent = false)}>
            {$t('use_a_different_email')}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .aurora-orb {
    position: absolute;
    width: 60vmax;
    height: 60vmax;
    top: -25vmax;
    right: -15vmax;
    border-radius: 9999px;
    background: radial-gradient(circle at 35% 35%, rgba(99, 102, 241, 0.35), rgba(6, 182, 212, 0.12) 55%, transparent 70%);
    filter: blur(40px);
    animation: drift 18s ease-in-out infinite alternate;
  }

  .aurora-orb--second {
    top: auto;
    right: auto;
    bottom: -30vmax;
    left: -20vmax;
    background: radial-gradient(circle at 60% 60%, rgba(6, 182, 212, 0.28), rgba(99, 102, 241, 0.1) 55%, transparent 70%);
    animation-duration: 22s;
    animation-direction: alternate-reverse;
  }

  @keyframes drift {
    from {
      transform: translate3d(0, 0, 0) scale(1);
    }
    to {
      transform: translate3d(-6vmax, 4vmax, 0) scale(1.15);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .aurora-orb {
      animation: none;
    }
  }
</style>
