<script lang="ts">
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { Capacitor } from '@capacitor/core';
  import { App as CapacitorApp } from '@capacitor/app';
  import { getPagesProvider, getSettingsProvider } from '$lib/commands';
  import DownloadPanel from './DownloadPanel.svelte';
  import ErrorLayout from './ErrorLayout.svelte';
  import OnEvents from '$lib/components/OnEvents.svelte';
  import NavigationLoadingBar from './NavigationLoadingBar.svelte';
  import UploadPanel from './UploadPanel.svelte';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { checkForAppUpdate } from '$lib/utils/app-update';
  import { eventManager } from '$lib/managers/event-manager.svelte';
  import { lang, locale } from '$lib/stores/preferences.store';
  import { sidebarStore } from '$lib/stores/sidebar.svelte';
  import {
    CommandPaletteProvider,
    CORE_PAGE_COMMANDS,
    defaultProvider,
    setLocale,
    setTranslations,
    Theme,
    themeManager,
    toastManager,
    TooltipProvider,
  } from '@immich/ui';
  import { onMount, type Snippet } from 'svelte';
  import { t } from 'svelte-i18n';
  import '../app.css';

  interface Props {
    children?: Snippet;
  }

  // Android back button/gesture: step through the app instead of killing it.
  // Viewer open -> close it. Otherwise navigate back; at the root, background the app.
  onMount(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (assetViewerManager.isViewing || canGoBack) {
        window.history.back();
      } else {
        void CapacitorApp.minimizeApp();
      }
    });
    return () => void listener.then((handle) => handle.remove());
  });

  $effect(() => {
    setTranslations({
      cancel: $t('cancel'),
      close: $t('close'),
      confirm: $t('confirm'),
      expand: $t('expand'),
      collapse: $t('collapse'),
      search_placeholder: $t('search'),
      search_no_results: $t('no_results'),
      prompt_default: $t('are_you_sure_to_do_this'),
      show_password: $t('show_password'),
      hide_password: $t('hide_password'),
      dark_theme: themeManager.value === Theme.Dark ? $t('light_theme') : $t('dark_theme'),
      open_menu: $t('open'),
      command_palette_prompt_default: $t('command_palette_prompt'),
      command_palette_to_select: $t('command_palette_to_select'),
      command_palette_to_navigate: $t('command_palette_to_navigate'),
      command_palette_to_close: $t('command_palette_to_close'),
      command_palette_to_show_all: $t('command_palette_to_show_all'),
      navigate_next: $t('next'),
      navigate_previous: $t('previous'),
      open_calendar: $t('open_calendar'),
      toast_success_title: $t('success'),
      toast_info_title: $t('info'),
      toast_warning_title: $t('warning'),
      toast_danger_title: $t('error'),
      save: $t('save'),
      supporter: $t('supporter'),
    });
  });

  $effect(() => setLocale($locale));

  let { children }: Props = $props();

  let showNavigationLoadingBar = $state(false);

  toastManager.setOptions({ class: 'top-16 fixed' });

  onMount(() => {
    const element = document.querySelector('#stencil');
    element?.remove();
    void checkForAppUpdate();
  });

  eventManager.emit('AppInit');

  beforeNavigate(({ from, to }) => {
    if (sidebarStore.isOpen) {
      sidebarStore.reset();
    }

    const fromRouteId = from?.route?.id;
    const toRouteId = to?.route?.id;
    const sameRouteTransition = fromRouteId && toRouteId && fromRouteId === toRouteId;

    if (sameRouteTransition) {
      return;
    }

    eventManager.emit('AppNavigate');

    showNavigationLoadingBar = true;
  });

  afterNavigate(() => {
    showNavigationLoadingBar = false;
  });
</script>

<OnEvents />

<svelte:head>
  <title>{page.data.meta?.title || 'Web'} - Immich</title>
  <link rel="manifest" href="/manifest.json" crossorigin="use-credentials" />
  <meta name="theme-color" content="white" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="black" media="(prefers-color-scheme: dark)" />

  {#if page.data.meta}
    <meta name="description" content={page.data.meta.description} />
  {/if}
</svelte:head>

<TooltipProvider>
  {#if page.data.error}
    <ErrorLayout error={page.data.error}></ErrorLayout>
  {:else}
    {@render children?.()}
  {/if}

  {#if showNavigationLoadingBar}
    <NavigationLoadingBar />
  {/if}

  <DownloadPanel />
  <UploadPanel />

  <CommandPaletteProvider
    providers={[
      getPagesProvider($t),
      getSettingsProvider($t),
      defaultProvider({ name: $t('documentation'), types: ['doc', 'documentation'], actions: CORE_PAGE_COMMANDS }),
    ]}
  />
</TooltipProvider>
