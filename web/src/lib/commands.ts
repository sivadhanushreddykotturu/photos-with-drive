import { defaultProvider, themeManager, ThemePreference, type ActionItem } from '@immich/ui';
import { mdiCog, mdiImageAlbum, mdiImageMultipleOutline, mdiKeyboard, mdiThemeLightDark } from '@mdi/js';
import type { MessageFormatter } from 'svelte-i18n';
import { goto } from '$app/navigation';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { Route } from '$lib/route';

export const getPagesProvider = ($t: MessageFormatter) => {
  const userPages: ActionItem[] = [
    {
      title: $t('photos'),
      icon: mdiImageMultipleOutline,
      onAction: () => goto(Route.photos()),
    },
    {
      title: $t('albums'),
      icon: mdiImageAlbum,
      onAction: () => goto(Route.albums()),
    },
    {
      title: $t('admin.user_settings'),
      icon: mdiCog,
      onAction: () => goto(Route.userSettings()),
    },
  ].map((route) => ({ $if: () => authManager.authenticated, ...route }));

  return defaultProvider({ name: $t('page'), actions: userPages });
};

export const getSettingsProvider = ($t: MessageFormatter) => {
  const settings: ActionItem[] = [
    {
      title: $t('theme'),
      description: $t('toggle_theme_description'),
      icon: mdiThemeLightDark,
      onAction: () => themeManager.toggle(),
      shortcuts: { shift: true, key: 't' },
    },
    {
      title: $t('system_theme'),
      description: $t('system_theme_command_description', {
        values: { value: themeManager.prefersDark ? $t('dark') : $t('light') },
      }),
      icon: mdiThemeLightDark,
      onAction: () => themeManager.setPreference(ThemePreference.System),
    },
    {
      title: $t('keyboard_shortcuts'),
      icon: mdiKeyboard,
      onAction: () => goto(Route.userSettings()),
    },
  ];

  return defaultProvider({ name: $t('command'), actions: settings });
};
