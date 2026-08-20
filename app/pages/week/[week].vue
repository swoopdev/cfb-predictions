<script setup lang="ts">
import type { LocationQueryRaw } from 'vue-router'
import type { Ref } from 'vue'
import type { Game, Team } from '#shared/types/schedule'
import { KNOWN_CONFERENCES } from '~/components/ConferenceFilter.vue'
import { fillWeekRemaining, clearWeek } from '~/utils/bulkPickOperations'

const route = useRoute()
const router = useRouter()

// Coerce once — never re-read `route.params.week` directly downstream
// (RESEARCH.md Pitfall 3: string/number comparison silently matches nothing).
const week = computed(() => Number(route.params.week))

const { data: teams, isPending: teamsPending, isError: teamsError } = useTeams()
const { data: games, isPending: gamesPending, isError: gamesError } = useGames()

// Pick state: loaded from localStorage and reactive
const picks: Ref<Record<number, number>> = usePicksStorage(2026)
const { markAutoFilled } = useAutoFilledGames(2026)

// Conference championship winner picks: `{ conferenceName: winningTeamId }`,
// separate from `picks` because a championship matchup has no real CFBD
// game id (this task).
const championshipPicks: Ref<Record<string, number>> = useChampionshipPicksStorage(2026)

// Standings sidebar open/collapsed state, lifted here so the header's
// toggle button and StandingsSidebar's own USidebar instance share it.
const standingsOpen = ref(true)

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

// D-07, D-14/D-16: games within a week group under their home team's conference
// (sorted alphabetically), UNLESS a conference filter is active (D-14/D-16), in which case
// all games involving that conference appear in a single section (D-14/D-16).
const conferenceGroups = computed(() => {
  // D-14/D-16: when conference filter is active, show all games in single section
  if (conf.value !== undefined) {
    return [{
      conference: `${conf.value} Games`,
      games: filteredGames.value
    }]
  }
  // Otherwise, use existing grouping by home team's conference
  return groupByConference(filteredGames.value, teamsById.value)
})

// Pitfall 4: "week has zero games" (e.g. week 14) and "filter narrowed an
// otherwise non-empty week to zero games" (e.g. a team's bye week) are
// different empty states with different copy — branch on WHY it's empty,
// not just whether the grid is empty.
const emptyVariant = computed(() => determineEmptyStateVariant(rawWeekGames.value, filteredGames.value))

// IN-02/D-13/STAND-02: standings and tiebreaker resolution live behind one
// composable (`useStandings`), which owns the single readiness guard and
// returns `undefined` (never an empty-object sentinel) until games and teams
// resolve. See the composable's own docblock for the D-13/STAND-02 no-
// watcher/no-debounce rationale and measured cost.
const { standings, rankings, slateComplete, commitOrdering } = useStandings(2026)

const filterLabel = computed(() => {
  if (teamId.value !== undefined) return teamsById.value.get(teamId.value)?.school ?? 'This team'
  if (conf.value !== undefined) return conf.value
  return 'This filter'
})

// Bulk operation handlers (D-12 through D-15)
function handleFillWeek() {
  if (!games.value?.games) return
  const { newPicks, autoFilledIds } = fillWeekRemaining(games.value.games, week.value, picks.value)
  picks.value = newPicks
  markAutoFilled(autoFilledIds)
}

function handleClearWeek() {
  if (!games.value?.games) return
  picks.value = clearWeek(games.value.games, week.value, picks.value)
}
</script>

<template>
  <div class="px-6 lg:px-8 py-6">
    <!-- D-01: games slate and standings share one page, side by side on
         desktop; the sidebar stacks below the slate on narrow viewports. -->
    <div class="flex flex-col lg:flex-row lg:items-start gap-6">
      <div class="min-w-0 flex-1">
        <!-- Header: week heading, nav, fill/clear and the conference/team
             filter row all live in one sticky block, scoped to this column
             only — the standings sidebar is a flex sibling that starts at
             the very top of the page, not pushed down below the header.
             `-mt-6` cancels the page's own `py-6` top padding so the header
             sits flush with zero gap above it once it's stuck to the
             viewport top; `pt-6` puts that same space back INSIDE the box
             (below its background/border) so the heading itself isn't
             jammed against the edge. -->
        <div
          class="sticky top-0 z-50 bg-default/95 backdrop-blur -mt-6 pt-6 pb-4 -mx-6 px-6 lg:-ml-8 lg:pl-8 lg:-mr-6 lg:pr-6 border-b border-neutral-300 dark:border-neutral-800"
        >
          <!-- Week heading with per-week progress bar, Fill/Clear Week
               actions, and navigation, all on one row. Fill/Clear moved here
               from their own row below the heading (this task) so they sit
               to the right of the progress bar they act on, rather than
               occupying a whole separate line. -->
          <div class="flex flex-wrap items-center justify-between gap-4 mb-2">
            <!-- Week heading, per-week progress bar, and Fill/Clear Week
                 actions (D-10, D-02). Fill/Clear sit immediately after the
                 progress bar they act on, left-aligned with it, rather than
                 pushed to the far right of the row. -->
            <div class="flex items-center gap-4 flex-1">
              <h1 class="text-xl font-semibold">
                Week {{ week }}
              </h1>
              <div class="flex-1 max-w-xs">
                <PickProgressWeek
                  :week-num="week"
                  :games="filteredGames"
                />
              </div>
              <div class="flex gap-2">
                <UButton
                  :disabled="filteredGames.filter(g => !(g.id in picks)).length === 0"
                  variant="ghost"
                  size="sm"
                  @click="handleFillWeek"
                >
                  Fill Week
                </UButton>
                <UButton
                  :disabled="filteredGames.filter(g => g.id in picks).length === 0"
                  variant="ghost"
                  size="sm"
                  @click="handleClearWeek"
                >
                  Clear Week
                </UButton>
              </div>
            </div>
            <!-- Week navigation -->
            <WeekNav
              :week="week"
              @navigate="goToWeek"
            />
          </div>

          <div class="flex flex-wrap items-center gap-4">
            <ConferenceFilter v-model="conf" />
            <TeamFilter v-model="teamId" />
            <div class="ml-auto flex items-center gap-2">
              <UColorModeButton size="xl" />
              <UButton
                icon="i-lucide-podium"
                color="neutral"
                variant="ghost"
                size="xl"
                :aria-label="standingsOpen ? 'Hide standings' : 'Show standings'"
                @click="standingsOpen = !standingsOpen"
              />
            </div>
          </div>
        </div>

        <div
          v-if="loadState === 'loading'"
          class="grid gap-4 mt-4"
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
          class="py-12 text-center mt-4"
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
          class="py-12 text-center mt-4"
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
          class="py-12 text-center mt-4"
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
          class="space-y-8 mt-4"
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

      <!-- Standings sidebar (D-01/D-02). Desktop: pinned right of the slate
           and independently scrollable. Mobile: collapsed behind a toggle so
           it never pushes the games out of reach. The sidebar owns the
           all-four-vs-single-conference branching; the week view only hands it
           the full result and the active filter.

           WR-01: gated on `loadState` exactly like the main column. `standings`
           is `{}` until games and teams resolve, and the sidebar renders a
           section heading plus "No teams to show for ..." for every missing
           key — so without this gate four fully-formed empty tables sat beside
           the skeletons while loading, and again on the error branch after the
           page had already said the schedule failed. The gate lives here
           rather than in a `pending` prop because `StandingsSidebar`'s props
           shape is out of scope for this repair.

           The loading branch carries the sidebar's own outer width classes
           (`w-full lg:w-80 lg:shrink-0`) so the two-column layout does not
           jump when the real panel replaces the skeleton. The error branch
           renders nothing at all — the main column has already explained the
           failure. -->
      <StandingsSidebar
        v-if="loadState === 'ready'"
        v-model:open="standingsOpen"
        :standings="standings"
        :active-conference="conf"
        :rankings="rankings"
        :slate-complete="slateComplete"
        :commit-ordering="commitOrdering"
        :teams-by-id="teamsById"
        :championship-picks="championshipPicks"
      />
      <div
        v-else-if="loadState === 'loading'"
        class="hidden lg:block lg:w-80 lg:shrink-0"
      >
        <USkeleton class="h-96 w-full rounded-lg" />
      </div>
    </div>
  </div>
</template>
