<script setup lang="ts">
import type { Game, Team } from '#shared/types/schedule'

const route = useRoute()

// Coerce once — never re-read `route.params.week` directly downstream
// (RESEARCH.md Pitfall 3: string/number comparison silently matches nothing).
const week = computed(() => Number(route.params.week))

const { data: teams, isPending: teamsPending, isError: teamsError } = useTeams()
const { data: games, isPending: gamesPending, isError: gamesError } = useGames()

// Drives loading/error branching for the ONE-TIME initial data resolution.
// Subsequent week/filter changes read already-cached data (staleTime:
// Infinity) and never re-enter 'loading'.
const loadState = computed(() => determineLoadState([
  { isPending: teamsPending.value, isError: teamsError.value },
  { isPending: gamesPending.value, isError: gamesError.value }
]))

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

    <div
      v-if="loadState === 'loading'"
      class="grid gap-4"
      style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));"
    >
      <USkeleton
        v-for="n in 6"
        :key="n"
        class="h-20 w-full rounded-lg"
      />
    </div>

    <div
      v-else-if="loadState === 'error'"
      class="py-12 text-center"
    >
      <h2 class="text-2xl font-semibold mb-2">
        Couldn't load the schedule.
      </h2>
      <p class="text-dimmed">
        Something went wrong loading this season's data. Refresh the page — if the problem continues, the schedule data may be missing from this deploy.
      </p>
    </div>

    <div
      v-else
      class="space-y-8"
    >
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
