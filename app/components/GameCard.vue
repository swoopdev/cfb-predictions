<script setup lang="ts">
import type { Game, Team } from '#shared/types/schedule'

const props = defineProps<{
  game: Game
  teamsById: Map<number, Team>
}>()

// `homeId` always resolves (0 games have a missing home-team join, per
// RESEARCH.md Pitfall 5) — no fallback needed on the home side.
const home = computed(() => props.teamsById.get(props.game.homeId))

// `awayId` may be an FCS opponent absent from teams.json (127 of 888 games,
// D-06) — falls back to the raw `awayTeam` string + the placeholder shield,
// reusing Phase 1's exact vendored asset.
const away = computed(() => props.teamsById.get(props.game.awayId) ?? {
  school: props.game.awayTeam,
  logo: '/logos/placeholder.svg'
})
</script>

<template>
  <UCard :ui="{ body: 'p-3 sm:p-3' }">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <img
          :src="away.logo"
          class="size-8 shrink-0"
          alt=""
        >
        <span
          class="truncate text-sm"
          :title="away.school"
        >{{ away.school }}</span>
      </div>
      <span class="text-dimmed text-sm shrink-0">@</span>
      <div class="flex items-center gap-2 min-w-0">
        <img
          :src="home?.logo"
          class="size-8 shrink-0"
          alt=""
        >
        <span
          class="truncate text-sm"
          :title="home?.school"
        >{{ home?.school }}</span>
      </div>
    </div>
    <div
      v-if="game.neutralSite || game.conferenceGame"
      class="flex gap-1 mt-2"
    >
      <UBadge
        v-if="game.neutralSite"
        color="neutral"
        variant="subtle"
        label="Neutral site"
      />
      <UBadge
        v-if="game.conferenceGame"
        color="primary"
        variant="subtle"
        label="Conference game"
      />
    </div>
  </UCard>
</template>
