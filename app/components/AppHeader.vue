<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const items = ref<NavigationMenuItem[]>([
  {
    label: 'How It Works',
    to: '/#how-it-works'
  },
  {
    label: 'Standings & Tiebreakers',
    to: '/#standings'
  },
  {
    label: 'Scenarios & Sharing',
    to: '/#scenarios'
  }
])
</script>

<template>
  <UHeader
    :ui="{
      left: 'lg:flex-none flex items-center gap-1.5',
      center: 'hidden lg:flex flex-1 justify-center',
      right: 'lg:flex-none flex items-center justify-end gap-1.5'
    }"
  >
    <template #left>
      <NuxtLink
        to="/"
        class="flex shrink-0 items-center"
      >
        <span class="text-2xl font-bold italic tracking-tighter">Saturday Central</span>
      </NuxtLink>
    </template>

    <UNavigationMenu
      :items="items"
      variant="link"
      :ui="{
        link: 'font-medium',
        childList: 'grid grid-cols-1 gap-1'
      }"
    />

    <template #right>
      <UColorModeButton />

      <UButton
        label="Predict the Season"
        trailing-icon="i-lucide-arrow-right"
        color="primary"
        variant="solid"
        to="/week/1"
        class="hidden lg:inline-flex"
      />
    </template>

    <template #body>
      <UNavigationMenu
        :items="items"
        orientation="vertical"
        class="w-full"
      />

      <UButton
        label="Predict the Season"
        icon="i-lucide-arrow-right"
        color="primary"
        variant="solid"
        to="/week/1"
        block
        class="mt-4"
      />
    </template>
  </UHeader>
</template>
