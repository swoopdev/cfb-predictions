<script setup lang="ts">
import type { LocationQueryRaw } from 'vue-router'
import type { Ref } from 'vue'
import type { Game, Team } from '#shared/types/schedule'
import type { ConferenceId } from '#shared/domain/tiebreakers/types'
import { P4_CONFERENCES } from '#shared/domain/standings'
import { KNOWN_CONFERENCES } from '~/components/ConferenceFilter.vue'
import { fillWeekRemaining, fillSeasonRemaining, clearWeek, clearSeason } from '~/utils/bulkPickOperations'
import { isWeekBoundary, getAdjacentWeek } from '~/utils/schedule'

const route = useRoute()
const router = useRouter()

// Coerce once — never re-read `route.params.week` directly downstream
// (RESEARCH.md Pitfall 3: string/number comparison silently matches nothing).
const week = computed(() => Number(route.params.week))

const { data: teams, isPending: teamsPending, isError: teamsError } = useTeams()
const { data: games, isPending: gamesPending, isError: gamesError } = useGames()

// Pick state: loaded from localStorage and reactive
const picks: Ref<Record<number, number>> = usePicksStorage(2026)
const { autoFilled, markAutoFilled } = useAutoFilledGames(2026)

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

function setConf(values: string[] | undefined) {
  router.push({ query: buildConfQuery(route.query, values) as LocationQueryRaw })
}

function setTeam(ids: number[] | undefined) {
  router.push({ query: buildTeamQuery(route.query, ids) as LocationQueryRaw })
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
const conf = computed<string[]>({
  get: () => sanitizeConfParam(route.query.conf as string | undefined, KNOWN_CONFERENCES),
  set: value => setConf(value)
})

const teamId = computed<number[]>({
  get: () => sanitizeTeamParam(route.query.team as string | undefined, teamsById.value),
  set: value => setTeam(value)
})

const filteredGames = computed<Game[]>(() =>
  filterGames(rawWeekGames.value, { conf: conf.value, team: teamId.value }, teamsById.value)
)

// FBS teams with no game this week (this task) -- computed off
// `rawWeekGames`, never `filteredGames`, since a team's bye is a fact about
// the week itself, not about the active conf/team filter; the conf/team
// filter is then applied on top so the bye list still narrows along with
// the rest of the page. Week 14 (championship week) has no real games at
// all, so every FBS team would otherwise show as "on bye" there -- the list
// is suppressed for that week instead.
const byeTeams = computed<Team[]>(() => {
  if (isChampionshipWeek.value) return []
  const playingIds = new Set<number>()
  for (const game of rawWeekGames.value) {
    playingIds.add(game.homeId)
    playingIds.add(game.awayId)
  }
  return (teams.value ?? [])
    .filter(t => t.classification === 'fbs' && !playingIds.has(t.id))
    .filter(t => conf.value.length === 0 || conf.value.includes(t.conference))
    .filter(t => teamId.value.length === 0 || teamId.value.includes(t.id))
    .sort((a, b) => a.school.localeCompare(b.school))
})

// When teams are selected instead of a conference (D-03: the two filters
// are mutually exclusive), the standings sidebar should still narrow to
// just the selected teams' conference(s) rather than showing all four —
// derived here, not inside StandingsSidebar, since conference membership
// comes from `teamsById` which is already resolved on this page.
const sidebarConferences = computed<string[]>(() => {
  if (conf.value.length > 0) return conf.value
  if (teamId.value.length === 0) return []
  const conferences = new Set<string>()
  for (const id of teamId.value) {
    const conference = teamsById.value.get(id)?.conference
    if (conference) conferences.add(conference)
  }
  return [...conferences]
})

// D-07, D-14/D-16: games within a week group under their home team's conference
// (sorted alphabetically), UNLESS a conference filter is active (D-14/D-16), in which case
// each SELECTED conference gets its own section rather than being merged
// into one (this task) -- a game is listed under a selected conference's
// section if either side belongs to it (matching `filterGames`'s own
// either-side match), so a cross-conference matchup between two selected
// conferences appears in both sections rather than being arbitrarily
// assigned to just the home side's.
const conferenceGroups = computed(() => {
  if (conf.value.length > 0) {
    return [...conf.value]
      .sort((a, b) => a.localeCompare(b))
      .map(conference => ({
        conference: `${conference} Games`,
        games: filteredGames.value.filter(game =>
          teamsById.value.get(game.homeId)?.conference === conference
          || teamsById.value.get(game.awayId)?.conference === conference
        )
      }))
      .filter(group => group.games.length > 0)
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

// Week 14 is conference championship week (this task) -- it has zero real
// games in the CFBD schedule, so instead of the normal `GameCard` grid this
// page renders one `ChampionshipCard` per P4 conference, built from the
// SAME `standings`/`rankings`/`slateComplete` the sidebar already computes
// via `useStandings` (never a second computation of conference standings).
const isChampionshipWeek = computed(() => week.value === 14)

// Week 14 has no real games to filter by conf/team, so it reuses
// `sidebarConferences` -- the same conference set the standings sidebar
// already narrows to for an active conf OR team filter (D-03: mutually
// exclusive) -- to decide which championship cards to show. An empty
// `sidebarConferences` means no filter is active, so every P4 conference
// still renders.
const visibleP4Conferences = computed<ConferenceId[]>(() => {
  if (sidebarConferences.value.length === 0) return [...P4_CONFERENCES]
  return P4_CONFERENCES.filter(conference => sidebarConferences.value.includes(conference))
})

const championshipSchoolById = computed<Map<ConferenceId, ReadonlyMap<number, string>>>(() => {
  const map = new Map<ConferenceId, ReadonlyMap<number, string>>()
  for (const conference of P4_CONFERENCES) {
    const rows = standings.value?.[conference] ?? []
    map.set(conference, new Map(rows.map(team => [team.id, team.school])))
  }
  return map
})

// Mirrors the empty-state predicate ChampionshipCard used to compute
// itself (via StandingsTable): true once any picked game has produced a
// conference record for this conference.
const championshipHasPickedGames = computed<Map<ConferenceId, boolean>>(() => {
  const map = new Map<ConferenceId, boolean>()
  for (const conference of P4_CONFERENCES) {
    const rows = standings.value?.[conference] ?? []
    map.set(conference, rows.some(team => team.confRecord.wins + team.confRecord.losses > 0))
  }
  return map
})

const filterLabel = computed(() => {
  if (teamId.value.length > 0) {
    return teamId.value.map(id => teamsById.value.get(id)?.school ?? 'This team').join(', ')
  }
  if (conf.value.length > 0) return conf.value.join(', ')
  return 'This filter'
})

// Bulk operation handlers (D-12 through D-15)
function handleFillWeek() {
  if (!games.value?.games) return
  const { newPicks, autoFilledIds } = fillWeekRemaining(games.value.games, week.value, picks.value)
  picks.value = newPicks
  markAutoFilled(autoFilledIds)
}

function handleFillSeason() {
  if (!games.value?.games) return
  const { newPicks, autoFilledIds } = fillSeasonRemaining(games.value.games, picks.value)
  picks.value = newPicks
  markAutoFilled(autoFilledIds)
}

function handleClearWeek() {
  if (!games.value?.games) return
  picks.value = clearWeek(games.value.games, week.value, picks.value)
}

function handleClearSeason() {
  picks.value = clearSeason()
  autoFilled.value.splice(0) // Also clear provenance tracking
}

// Advance-week card at the end of the slate (this task): disabled once
// `week` is already the last navigable entry in `WEEKS`, matching WeekNav's
// own next-button boundary logic rather than a separate check.
const nextWeekDisabled = computed(() => isWeekBoundary(week.value).nextDisabled)
function advanceWeek() {
  goToWeek(getAdjacentWeek(week.value, 'next'))
}
</script>

<template>
  <div>
    <!-- D-01: games slate and standings share one page, side by side on
         desktop; the sidebar stacks below the slate on narrow viewports.
         No page-level container/padding here (this task) -- the sidebar
         needs to touch the top and right edge of the screen, so each
         column owns exactly the padding it needs instead. -->
    <div class="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-0">
      <div class="min-w-0 flex-1 px-6 lg:px-8 pb-6">
        <!-- Header: week heading, nav, fill/clear and the conference/team
             filter row all live in one sticky block, scoped to this column
             only — the standings sidebar is a flex sibling that starts at
             the very top of the page, not pushed down below the header.
             Flush to the column's own top/side padding directly (this
             task) -- no more negative-margin cancel-and-restore trick,
             since the page no longer wraps everything in its own padding. -->
        <div
          class="sticky top-0 z-50 bg-default/95 backdrop-blur -mx-6 px-6 lg:-mx-8 lg:px-8 pt-6 pb-4 border-b border-neutral-300 dark:border-neutral-800"
        >
          <!-- Header layout (this task): three rows on mobile -- week nav
               centered alone on top, conference/team filters side by side
               below it, then Fill/Clear alongside theme/podium on the
               bottom row -- collapsing into the single desktop row via
               `lg:contents` on each row wrapper, with explicit `lg:order-*`
               on every item so the desktop ordering (nav, filters,
               Fill/Clear, theme/podium) stays exactly what it was before
               this task, independent of the mobile DOM grouping. -->
          <div class="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
            <div class="flex justify-center lg:contents">
              <!-- Week navigation -->
              <WeekNav
                :week="week"
                class="lg:order-1"
                @navigate="goToWeek"
              />
            </div>
            <div class="flex flex-nowrap items-center justify-center gap-4 lg:contents">
              <ConferenceFilter
                v-model="conf"
                class="lg:order-2"
              />
              <TeamFilter
                v-model="teamId"
                class="lg:order-3"
              />
            </div>
            <div class="flex items-center gap-4 lg:contents">
              <div class="flex gap-2 lg:order-4">
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
                <UButton
                  :disabled="(games?.games ?? []).filter(g => !(g.id in picks)).length === 0"
                  variant="ghost"
                  size="sm"
                  @click="handleFillSeason"
                >
                  Fill Season
                </UButton>
                <UButton
                  :disabled="Object.keys(picks).length === 0"
                  variant="ghost"
                  size="sm"
                  @click="handleClearSeason"
                >
                  Clear Season
                </UButton>
              </div>
              <div class="ml-auto flex items-center gap-2 lg:order-5 lg:ml-auto">
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

        <!-- Week 14: conference championship week (this task). No real
             `GameCard` grid exists for it -- one `ChampionshipCard` per P4
             conference stands in for it instead, each rendering its own
             loading/placeholder/matchup state independently, so this branch
             never needs its own loading/empty handling. -->
        <div
          v-else-if="isChampionshipWeek"
          class="grid gap-4 mt-4"
          style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));"
        >
          <ChampionshipCard
            v-for="conference in visibleP4Conferences"
            :key="conference"
            :ranking="rankings?.[conference]"
            :school-by-id="championshipSchoolById.get(conference) ?? new Map()"
            :has-picked-conference-games="championshipHasPickedGames.get(conference) ?? false"
            :slate-complete="slateComplete?.[conference] ?? false"
            :conference-name="conference"
            :teams-by-id="teamsById"
            :championship-picks="championshipPicks"
          />
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
            v-for="(group, groupIndex) in conferenceGroups"
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
              <!-- Advance-week card (this task): when there are no byes,
                   it joins the last conference group's own grid so it flows
                   into the same row as the last game cards rather than
                   starting a new grid/row of its own. -->
              <AdvanceWeekCard
                v-if="byeTeams.length === 0 && groupIndex === conferenceGroups.length - 1"
                :disabled="nextWeekDisabled"
                @click="advanceWeek"
              />
            </div>
          </div>

          <!-- Teams with no game this week (this task): one card, not a
               per-conference grid like the groups above -- byes span every
               conference at once, so a single card at the end of the slate
               lists them all together. -->
          <div v-if="byeTeams.length > 0">
            <h2 class="text-xs font-semibold uppercase tracking-wide text-dimmed mb-3">
              Byes
            </h2>
            <div
              class="grid gap-4"
              style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));"
            >
              <ByeCard :teams="byeTeams" />
              <!-- Advance-week card (this task): joins the byes grid (the
                   last row of the slate) so it sits in the same row as the
                   last card instead of on its own line. -->
              <AdvanceWeekCard
                :disabled="nextWeekDisabled"
                @click="advanceWeek"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Standings sidebar (D-01/D-02). Desktop: pinned right of the slate
           and independently scrollable, flush against the top and right
           edge of the screen (this task). Mobile: collapsed behind a toggle
           so it never pushes the games out of reach, with its own side
           padding so it doesn't span edge-to-edge on narrow viewports. The
           sidebar owns the all-four-vs-single-conference branching; the
           week view only hands it the full result and the active filter.

           WR-01: gated on `loadState` exactly like the main column. `standings`
           is `{}` until games and teams resolve, and the sidebar renders a
           section heading plus "No teams to show for ..." for every missing
           key — so without this gate four fully-formed empty tables sat beside
           the skeletons while loading, and again on the error branch after the
           page had already said the schedule failed. The gate lives here
           rather than in a `pending` prop because `StandingsSidebar`'s props
           shape is out of scope for this repair.

           The loading branch carries the sidebar's own outer width/padding
           classes so the two-column layout does not jump when the real
           panel replaces the skeleton. The error branch renders nothing at
           all — the main column has already explained the failure. -->
      <div class="w-full px-6 pb-6 lg:w-auto lg:shrink-0 lg:min-h-screen lg:px-0 lg:pb-0">
        <StandingsSidebar
          v-if="loadState === 'ready'"
          v-model:open="standingsOpen"
          :standings="standings"
          :teams-by-id="teamsById"
          :active-conference="sidebarConferences"
          :rankings="rankings"
          :slate-complete="slateComplete"
          :commit-ordering="commitOrdering"
          :championship-picks="championshipPicks"
        />
        <USkeleton
          v-else-if="loadState === 'loading'"
          class="hidden h-96 w-80 rounded-lg lg:block"
        />
      </div>
    </div>
  </div>
</template>
