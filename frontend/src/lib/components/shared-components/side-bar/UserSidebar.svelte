<script lang="ts">
  import BottomInfo from '$lib/components/shared-components/side-bar/BottomInfo.svelte';
  import Sidebar from '$lib/components/sidebar/Sidebar.svelte';
  import { Route } from '$lib/route';
  import { NavbarItem } from '@immich/ui';
  import {
    mdiCog,
    mdiCogOutline,
    mdiHeart,
    mdiHeartOutline,
    mdiImageAlbum,
    mdiImageMultiple,
    mdiImageMultipleOutline,
    mdiTrashCan,
    mdiTrashCanOutline,
  } from '@mdi/js';
  import { t } from 'svelte-i18n';
</script>

<Sidebar ariaLabel={$t('primary')}>
  <NavbarItem title={$t('photos')} href={Route.photos()} icon={mdiImageMultipleOutline} activeIcon={mdiImageMultiple} />

  <NavbarItem title={$t('favorites')} href={Route.favorites()} icon={mdiHeartOutline} activeIcon={mdiHeart} />

  <NavbarItem title={$t('albums')} href={Route.albums()} icon={{ icon: mdiImageAlbum, flipped: true }} />

  <NavbarItem title={$t('trash')} href={Route.trash()} icon={mdiTrashCanOutline} activeIcon={mdiTrashCan} />

  <NavbarItem
    title={$t('connected_accounts')}
    href={Route.userSettings()}
    icon={mdiCogOutline}
    activeIcon={mdiCog}
  />

  <BottomInfo />
</Sidebar>
