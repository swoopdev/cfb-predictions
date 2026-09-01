<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTeams } from '~/composables/useTeams'

const { data: teams, isPending, isError } = useTeams()

const search = ref('')

const fbsTeams = computed(() => (teams.value ?? []).filter(t => t.classification === 'fbs'))

const filteredTeams = computed(() => {
  const query = search.value.trim().toLowerCase()
  const list = query
    ? fbsTeams.value.filter(t =>
        t.school.toLowerCase().includes(query)
        || t.conference.toLowerCase().includes(query)
        || (t.mascot?.toLowerCase().includes(query) ?? false)
      )
    : fbsTeams.value
  return [...list].sort((a, b) => a.school.localeCompare(b.school))
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
    <div class="mb-6 flex items-center justify-between gap-4">
      <h1 class="text-xl font-semibold">
        Teams
      </h1>
      <UButton
        to="/week/1"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
      >
        Back to picks
      </UButton>
    </div>

    <UInput
      v-model="search"
      icon="i-lucide-search"
      placeholder="Search teams or conferences…"
      size="lg"
      class="mb-6 w-full"
      autofocus
    />

    <div
      v-if="isPending"
      class="text-center text-dimmed py-12"
    >
      Loading teams…
    </div>
    <div
      v-else-if="isError"
      class="text-center text-dimmed py-12"
    >
      Couldn't load teams.
    </div>
    <div
      v-else-if="filteredTeams.length === 0"
      class="text-center text-dimmed py-12"
    >
      No teams match "{{ search }}".
    </div>
    <div
      v-else
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <NuxtLink
        v-for="team in filteredTeams"
        :key="team.id"
        :to="`/team/${team.id}`"
        class="flex flex-col items-center gap-2 rounded-lg border border-default bg-elevated px-3 py-4 text-center transition-colors hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50"
      >
        <img
          :src="team.logo"
          class="size-12 shrink-0"
          :class="{ 'dark:brightness-0 dark:invert': team.logo === '/logos/placeholder.svg' }"
          alt=""
        >
        <span class="min-w-0 truncate text-sm font-medium w-full">{{ team.school }}</span>
        <span class="text-xs text-dimmed truncate w-full">{{ team.conference }}</span>
      </NuxtLink>
    </div>
  </div>
</template>
