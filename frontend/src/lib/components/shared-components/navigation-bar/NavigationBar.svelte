<script lang="ts" module>
  export const menuButtonId = 'top-menu-button';
</script>

<script lang="ts">
  import { clickOutside } from '$lib/actions/click-outside';
  import SkipLink from '$lib/elements/SkipLink.svelte';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { Route } from '$lib/route';
  import { mediaQueryManager } from '$lib/stores/media-query-manager.svelte';
  import { sidebarStore } from '$lib/stores/sidebar.svelte';
  import { Button, IconButton, Logo } from '@immich/ui';
  import { mdiMenu, mdiTrayArrowUp } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import ThemeButton from '../ThemeButton.svelte';
  import UserAvatar from '../UserAvatar.svelte';
  import AccountInfoPanel from './AccountInfoPanel.svelte';

  type Props = {
    onUploadClick?: () => void;
    noBorder?: boolean;
  };

  let { onUploadClick, noBorder = false }: Props = $props();

  let shouldShowAccountInfoPanel = $state(false);
</script>

<nav id="dashboard-navbar" class="h-(--navbar-height) w-dvw text-sm max-md:h-(--navbar-height-md)">
  <SkipLink text={$t('skip_to_content')} />
  <div
    class="grid h-full grid-cols-[--spacing(32)_auto] items-center py-2 sidebar:grid-cols-[--spacing(64)_auto] {noBorder
      ? ''
      : 'border-b'}"
  >
    <div class="mx-4 flex flex-row items-center gap-1">
      <IconButton
        id={menuButtonId}
        shape="round"
        color="secondary"
        variant="ghost"
        size="medium"
        aria-label={$t('main_menu')}
        icon={mdiMenu}
        onclick={() => {
          sidebarStore.toggle();
        }}
        onmousedown={(event: MouseEvent) => {
          if (sidebarStore.isOpen) {
            // stops event from reaching the default handler when clicking outside of the sidebar
            event.stopPropagation();
          }
        }}
        class="sidebar:hidden"
      />
      <a data-sveltekit-preload-data="hover" href={Route.photos()}>
        <Logo variant={mediaQueryManager.isFullSidebar ? 'inline' : 'icon'} class="max-md:h-12" />
      </a>
    </div>
    <div class="flex justify-between gap-4 pe-6 lg:gap-8">
      <div class="hidden w-full max-w-5xl flex-1 sm:block tall:ps-0"></div>

      <section class="flex w-full place-items-center justify-end gap-1 sm:w-auto md:gap-2">
        {#if onUploadClick}
          <Button
            leadingIcon={mdiTrayArrowUp}
            onclick={onUploadClick}
            class="hidden lg:flex"
            variant="ghost"
            size="medium"
            color="secondary"
            >{$t('upload')}
          </Button>
          <IconButton
            color="secondary"
            shape="round"
            variant="ghost"
            size="medium"
            onclick={onUploadClick}
            title={$t('upload')}
            aria-label={$t('upload')}
            icon={mdiTrayArrowUp}
            class="lg:hidden"
          />
        {/if}

        <ThemeButton />

        <div
          use:clickOutside={{
            onOutclick: () => (shouldShowAccountInfoPanel = false),
            onEscape: () => (shouldShowAccountInfoPanel = false),
          }}
        >
          <button
            type="button"
            class="flex ps-2"
            onclick={() => (shouldShowAccountInfoPanel = !shouldShowAccountInfoPanel)}
            title="{authManager.user.name} ({authManager.user.email})"
          >
            {#key authManager.user}
              <UserAvatar user={authManager.user} size="md" noTitle interactive />
            {/key}
          </button>

          {#if shouldShowAccountInfoPanel}
            <AccountInfoPanel onClose={() => (shouldShowAccountInfoPanel = false)} />
          {/if}
        </div>
      </section>
    </div>
  </div>
</nav>
