<script setup lang="ts">
import type { Game, Team } from '#shared/types/schedule'

const route = useRoute()

// Coerce once — never re-read `route.params.week` directly downstream
// (RESEARCH.md Pitfall 3: string/number comparison silently matches nothing).
const week = computed(() => Number(route.params.week))

const { data: teams } = useTeams()
const { data: games } = useGames()

const teamsById = computed<Map<number, Team>>(() => new Map((teams.value ?? []).map(t => [t.id, t])))

const rawWeekGames = computed<Game[]>(() => (games.value?.games ?? []).filter(g => g.week === week.value))

// D-07: games within a week group under their home team's conference,
// sorted alphabetically by conference name.
const conferenceGroups = computed(() => groupByConference(rawWeekGames.value, teamsById.value))
</script>

<template>
  <div class="px-6 lg:px-8 py-6">
    <h1 class="text-xl font-semibold mb-4">
      Week {{ week }}
    </h1>
    <div class="space-y-8">
      <div
        v-for="group in conferenceGroups"
        :key="group.conference"
      >
        <h2 class="text-xs font-semibold uppercase tracking-wide text-dimmed mb-3">
          {{ group.conference }}
        </h2>
        <div
          class="grid gap-4"
          style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));"
        >
          <GameCard
            v-for="game in group.games"
            :key="game.id"
            :game="game"
            :teams-by-id="teamsById"
          />
        </div>
      </div>
    </div>
  </div>
</template>
