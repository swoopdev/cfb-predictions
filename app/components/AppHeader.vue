<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { KNOWN_CONFERENCES } from '~/components/ConferenceFilter.vue'
import { WEEKS } from '~/utils/schedule'

const items = ref<NavigationMenuItem[]>([
  {
    label: 'View Teams',
    to: '/teams'
  },
  {
    label: 'Pick Games',
    to: '/week/1'
  },
  {
    label: 'Pick by Week',
    children: WEEKS.filter(week => week !== 14).map(week => ({
      label: `Week ${week}`,
      to: `/week/${week}`
    }))
  },
  {
    label: 'Pick by Conference',
    ui: { childList: 'grid-cols-3' },
    children: KNOWN_CONFERENCES.map(conference => ({
      label: conference,
      to: `/week/1?conf=${encodeURIComponent(conference)}`
    }))
  }
])
</script>

<template>
  <UHeader
    :ui="{
      left: 'lg:flex-none flex items-center gap-1.5',
      center: 'hidden lg:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:top-1/2 lg:-translate-y-1/2',
      right: 'lg:flex-none flex items-center justify-end gap-1.5'
    }"
  >
    <template #left>
      <BrandMark />
    </template>

    <UNavigationMenu
      :items="items"
      variant="link"
      :ui="{
        link: 'font-medium',
        childList: 'grid grid-cols-4 gap-1'
      }"
    />

    <template #right>
      <UColorModeButton />
    </template>

    <template #body>
      <UNavigationMenu
        :items="items"
        orientation="vertical"
        class="w-full"
      />
    </template>
  </UHeader>
</template>
