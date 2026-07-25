<script lang="ts">
  import AuthPageLayout from '$lib/components/layouts/AuthPageLayout.svelte';
  import { Route } from '$lib/route';
  import { Button, Heading, Stack } from '@immich/ui';
  import { t } from 'svelte-i18n';
</script>

<AuthPageLayout>
  <div class="flex flex-col place-items-center gap-12 text-center">
    <Heading size="large" color="primary" tag="h1">{$t('welcome_to_immich')}</Heading>
    <Stack>
      <Button href={Route.register()} size="large" shape="round">
        <span class="px-2 font-semibold">{$t('getting_started')}</span>
      </Button>
      <Button href={Route.login()} size="small" shape="round" variant="ghost">
        <span class="px-2 font-semibold">{$t('sign_in')}</span>
      </Button>
    </Stack>
  </div>
</AuthPageLayout>
