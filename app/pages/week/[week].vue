<script setup lang="ts">
import type { LocationQueryRaw } from 'vue-router'
import type { Ref } from 'vue'
import type { Game, Team } from '#shared/types/schedule'
import { KNOWN_CONFERENCES } from '~/components/ConferenceFilter.vue'

const route = useRoute()
const router = useRouter()

// Coerce once — never re-read `route.params.week` directly downstream
// (RESEARCH.md Pitfall 3: string/number comparison silently matches nothing).
const week = computed(() => Number(route.params.week))

const { data: teams, isPending: teamsPending, isError: teamsError } = useTeams()
const { data: games, isPending: gamesPending, isError: gamesError } = useGames()

// Pick state: loaded from localStorage and reactive
const picks: Ref<Record<number, number>> = usePicksStorage(2026)

// Drives loading/error branching for the ONE-TIME initial data resolution.
// Subsequent week/filter changes read already-cached data (staleTime:
// Infinity) and never re-enter 'loading'.
const loadState = computed(() => determineLoadState([
  { isPending: teamsPending.value, isError: teamsError.value },
  { isPending: gamesPending.value, isError: gamesError.value }
]))

const teamsById = computed<Map<number, Team>>(() => new Map((teams.value ?? []).map(t => [t.id, t])))

const rawWeekGames = computed<Game[]>(() => (games.value?.games ?? []).filter(g => g.week === week.value))

function setConf(value: string | undefined) {
  router.push({ query: buildConfQuery(route.query, value) as LocationQueryRaw })
}

function setTeam(id: number | undefined) {
  router.push({ query: buildTeamQuery(route.query, id) as LocationQueryRaw })
}

// D-14/D-15/Pitfall 6: navigating weeks via WeekNav must preserve the
// currently-active conf/team filter unchanged — never null it out the way
// buildConfQuery/buildTeamQuery intentionally null out EACH OTHER.
function goToWeek(targetWeek: number) {
  const { params, query } = buildWeekQuery(route.query, targetWeek)
  router.push({ path: `/week/${params.week}`, query: query as LocationQueryRaw })
}

// D-10/Security Domain V5: sanitized straight from the URL query — an
// invalid/malicious `conf`/`team` value falls back to unfiltered ("All")
// rather than crashing or rendering a broken partial state. Writable so
// ConferenceFilter/TeamFilter can `v-model` directly; the setter routes
// through setConf/setTeam -> buildConfQuery/buildTeamQuery, never an
// inline partial query object (D-03 mutual exclusivity, Pitfall 6).
const conf = computed<string | undefined>({
  get: () => sanitizeConfParam(route.query.conf as string | undefined, KNOWN_CONFERENCES),
  set: value => setConf(value)
})

const teamId = computed<number | undefined>({
  get: () => sanitizeTeamParam(route.query.team as string | undefined, teamsById.value),
  set: value => setTeam(value)
})

const filteredGames = computed<Game[]>(() =>
  filterGames(rawWeekGames.value, { conf: conf.value, team: teamId.value }, teamsById.value)
)

// D-07: games within a week group under their home team's conference,
// sorted alphabetically by conference name.
const conferenceGroups = computed(() => groupByConference(filteredGames.value, teamsById.value))

// Pitfall 4: "week has zero games" (e.g. week 14) and "filter narrowed an
// otherwise non-empty week to zero games" (e.g. a team's bye week) are
// different empty states with different copy — branch on WHY it's empty,
// not just whether the grid is empty.
const emptyVariant = computed(() => determineEmptyStateVariant(rawWeekGames.value, filteredGames.value))

const filterLabel = computed(() => {
  if (teamId.value !== undefined) return teamsById.value.get(teamId.value)?.school ?? 'This team'
  if (conf.value !== undefined) return conf.value
  return 'This filter'
})
</script>

<template>
  <div class="px-6 lg:px-8 py-6">
    <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
      <h1 class="text-xl font-semibold">
        Week {{ week }}
      </h1>
      <WeekNav
        :week="week"
        @navigate="goToWeek"
      />
    </div>

    <div class="flex flex-wrap items-center gap-4 mb-6">
      <ConferenceFilter v-model="conf" />
      <TeamFilter v-model="teamId" />
    </div>

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
      v-else-if="emptyVariant === 'week-empty'"
      class="py-12 text-center"
    >
      <h2 class="text-2xl font-semibold mb-2">
        No games this week
      </h2>
      <p class="text-dimmed">
        Week {{ week }} has no games in the 2026 schedule. Try another week.
      </p>
    </div>

    <div
      v-else-if="emptyVariant === 'filter-empty'"
      class="py-12 text-center"
    >
      <h2 class="text-2xl font-semibold mb-2">
        No games match this filter
      </h2>
      <p class="text-dimmed">
        {{ filterLabel }} has no games in Week {{ week }}. Clear the filter or pick another week.
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
            :picks="picks"
          />
        </div>
      </div>
    </div>
  </div>
</template>
