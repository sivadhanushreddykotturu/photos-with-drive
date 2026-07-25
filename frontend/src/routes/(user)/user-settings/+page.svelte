<script lang="ts">
  import UserPageLayout from '$lib/components/layouts/UserPageLayout.svelte';
  import UserSettingsList from './UserSettingsList.svelte';
  import { Container } from '@immich/ui';
  import type { PageData } from './$types';

  type Props = {
    data: PageData;
  };

  let { data }: Props = $props();
</script>

<UserPageLayout title={data.meta.title}>
  <Container size="medium" center>
    <UserSettingsList />
  </Container>
</UserPageLayout>
