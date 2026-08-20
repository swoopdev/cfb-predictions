<script setup lang="ts">
import type { Team } from '#shared/types/schedule'

defineProps<{
  teams: readonly Team[]
}>()
</script>

<template>
  <UCard
    :ui="{
      root: 'bg-transparent ring-1 ring-default',
      body: 'p-3 sm:p-3'
    }"
  >
    <h3 class="text-xs font-semibold uppercase tracking-wide text-dimmed mb-2">
      On Bye
    </h3>
    <ul class="flex flex-wrap gap-x-4 gap-y-2">
      <li
        v-for="team in teams"
        :key="team.id"
        class="flex items-center gap-2 min-w-0"
      >
        <img
          :src="team.logo"
          class="size-6 shrink-0"
          :class="{ 'dark:brightness-0 dark:invert': team.logo === '/logos/placeholder.svg' }"
          alt=""
        >
        <span
          class="truncate text-sm text-default"
          :title="team.school"
        >{{ team.school }}</span>
      </li>
    </ul>
  </UCard>
</template>
