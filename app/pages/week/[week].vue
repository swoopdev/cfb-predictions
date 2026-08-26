<script setup lang="ts">
import type { LocationQueryRaw } from 'vue-router'
import type { Game, Team } from '#shared/types/schedule'
import type { ConferenceId } from '#shared/domain/tiebreakers/types'
import type { ConferenceDecisions } from '#shared/domain/tiebreakers/invalidation'
import { P4_CONFERENCES } from '#shared/domain/standings'
import { encodeShareLink, ShareLinkTooLargeError } from '#shared/domain/shareLink'
import { validateConferenceDecisions } from '#shared/domain/tiebreakers/invalidation'
import { KNOWN_CONFERENCES } from '~/components/ConferenceFilter.vue'
import { isWeekBoundary } from '~/utils/schedule'
import { scenarioKeys } from '~/utils/scenarioKeys'
import { useSharedPreview } from '~/composables/useSharedPreview'
import { validatePicksShape } from '~/composables/usePicksStorage'

const route = useRoute()
const router = useRouter()

// Coerce once — never re-read `route.params.week` directly downstream
// (RESEARCH.md Pitfall 3: string/number comparison silently matches nothing).
const week = computed(() => Number(route.params.week))

const { data: teams, isPending: teamsPending, isError: teamsError } = useTeams()
const { data: games, isPending: gamesPending, isError: gamesError } = useGames()

// Rankings/win-probability data is fetched weekly and may not exist yet for
// the season (first fetch hasn't run) -- these never gate `loadState`, they
// just render nothing in GameCard when absent (D- pattern matches the FCS
// team/logo fallbacks already established for teams/games).
const { data: pollRankings } = useRankings()
const { data: winProbabilities } = useWinProbabilities()
const { data: bettingLines } = useBettingLines()
const rankingsByTeamId = computed<Map<number, number>>(() =>
  new Map((pollRankings.value?.rankings ?? []).map(r => [r.teamId, r.rank]))
)
const winProbabilityByGameId = computed<Map<number, number>>(() =>
  new Map((winProbabilities.value?.probabilities ?? []).map(p => [p.gameId, p.homeWinProbability]))
)
const bettingLineByGameId = computed<Map<number, { favored: 'home' | 'away' | 'even', spread: number }>>(() =>
  new Map((bettingLines.value?.lines ?? []).map(l => [l.gameId, { favored: l.favored, spread: l.spread }]))
)

// Phase 7 (D-07, D-09): scenario registry + active pointer, called exactly
// once at the page's own unkeyed top level so the switcher survives a
// scenario switch. `PicksWorkspace` below is the sole reader of
// `activeScenarioId` for picks — mounted with `:key="activeScenarioId"` so
// it fully unmounts/remounts (RESEARCH.md Pitfall 1) on every switch.
const { scenarios, activeScenarioId, createScenario, renameScenario, duplicateScenario, deleteScenario } = useScenarios(2026)

// Delete-confirmation state bridges ScenarioSwitcher's per-row `delete` emit
// (id only) onto DeleteScenarioModal's boolean open/scenarioName contract.
const deleteTarget = ref<{ id: string, name: string } | null>(null)
const deleteModalOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (v: boolean) => { if (!v) deleteTarget.value = null }
})
function handleDeleteRequest(id: string) {
  const target = scenarios.value.find(s => s.id === id)
  if (target) deleteTarget.value = { id: target.id, name: target.name }
}

// Share-link state bridges ScenarioSwitcher's per-row `share` emit (id only)
// onto ShareLinkModal's open/scenarioName/shareUrl contract -- same pattern
// as deleteTarget/deleteModalOpen above.
const shareTarget = ref<{ id: string, name: string, url: string } | null>(null)
const shareModalOpen = computed({
  get: () => shareTarget.value !== null,
  set: (v: boolean) => { if (!v) shareTarget.value = null }
})

// T-08-07/RESEARCH.md Pattern 2: reads the CLICKED row's id via
// scenarioKeys.picks/manualTiebreakers, never activeScenarioId -- the exact
// non-active-scenario raw-localStorage access duplicateScenario/
// deleteScenario already established in Phase 7's useScenarios.ts.
// WR-01: this is a THIRD, independent reader of the same untrusted-storage
// boundary usePicksStorage.ts/useManualTiebreakers.ts already validate on
// every read -- so it routes through the exact same validators
// (`validatePicksShape`, `validateConferenceDecisions`) rather than trusting
// a bare JSON.parse. Corrupted or hand-edited JSON degrades to `{}` for that
// value (matching those composables' own D-07/D-08 corruption disposition)
// instead of throwing out of a click handler. Zero localStorage writes
// anywhere in this function (D-07).
async function handleShare(id: string) {
  if (!games.value) return
  const target = scenarios.value.find(s => s.id === id)
  if (!target) return

  const picksRaw = localStorage.getItem(scenarioKeys.picks(2026, id))
  const decisionsRaw = localStorage.getItem(scenarioKeys.manualTiebreakers(2026, id))

  let picks: Record<number, number> = {}
  try {
    picks = picksRaw ? (validatePicksShape(JSON.parse(picksRaw)) ?? {}) : {}
  } catch {
    picks = {}
  }

  let manualDecisions: ConferenceDecisions = {}
  try {
    manualDecisions = decisionsRaw ? validateConferenceDecisions(JSON.parse(decisionsRaw)) : {}
  } catch {
    manualDecisions = {}
  }

  let code: string
  try {
    code = await encodeShareLink({
      games: games.value.games,
      season: 2026,
      scheduleHash: games.value.scheduleHash,
      picks,
      manualDecisions
    })
  } catch (err) {
    // WR-02: an oversized scenario (an unusually large accumulation of
    // distinct manual-tiebreaker decisions) can't be encoded within
    // MAX_FRAGMENT_CHARS -- don't open the Share modal with a link that
    // would just read as corrupted on the receiving end.
    // 08-REVIEW WR-01 (iteration 2): any OTHER exception (e.g. a malformed
    // scheduleHash) must not be silently swallowed -- log it so a real
    // failure leaves a trail instead of a Share button that just no-ops.
    if (err instanceof ShareLinkTooLargeError) {
      console.warn(`Scenario "${target.name}" is too large to share (${err.encodedLength} chars, limit is smaller).`)
    } else {
      console.error(`Unexpected error building share link for scenario "${target.name}":`, err)
    }
    return
  }

  shareTarget.value = {
    id,
    name: target.name,
    url: `${window.location.origin}${window.location.pathname}#s=${code}`
  }
}

// SHARE-02/03/04 (D-05/D-06/D-07): mounted at the page's own unkeyed top
// level, alongside useScenarios(2026) above -- NOT inside PicksWorkspace --
// so the banner can render above it (D-05) while PicksWorkspace stays keyed
// by activeScenarioId only, unrelated to preview state.
const shareHash = computed(() => route.hash)
const { preview: sharedPreview, bannerVariant: sharedBannerVariant, counts: sharedCounts, dismiss: dismissSharedPreview } = useSharedPreview(games, shareHash)

function handleDismissSharedPreview() {
  dismissSharedPreview()
  router.replace({ hash: '' })
}

// D-06: turns a temporary preview into a permanent, ordinary scenario --
// writes the SAME scenarioKeys-built storage keys every other scenario
// uses, so a saved-copy scenario is structurally indistinguishable from one
// created any other way. Deliberately writes no scenarioKeys.autofilled
// entry: a saved share-link copy's picks are all treated as user-made,
// never auto-filled, since the share payload never carried provenance
// (RESEARCH.md Pattern 2).
function handleSaveCopy() {
  if (!sharedPreview.value) return

  const meta = createScenario()
  localStorage.setItem(scenarioKeys.picks(2026, meta.id), JSON.stringify(sharedPreview.value.picks))
  if (Object.keys(sharedPreview.value.manualDecisions).length > 0) {
    localStorage.setItem(scenarioKeys.manualTiebreakers(2026, meta.id), JSON.stringify(sharedPreview.value.manualDecisions))
  }

  handleDismissSharedPreview()
}

// WR-02: 07-CONTEXT.md D-11 / 07-UI-SPEC.md require a newly-created or
// duplicated scenario to land "immediately editable inline" -- handed to
// ScenarioSwitcher as a prop it watches, rather than the switcher calling
// back into the page, since the switcher has no other reason to know about
// create/duplicate's *results* (only their triggering clicks, which it
// already emits upward).
const pendingEditId = ref<string | null>(null)
function handleCreate() {
  pendingEditId.value = createScenario().id
}
function handleDuplicate(id: string) {
  const copy = duplicateScenario(id)
  if (copy) pendingEditId.value = copy.id
}

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
// rather than crashing or rendering a broken partial state. Read-only here;
// PicksWorkspace's filter controls emit back up to setConf/setTeam, which
// route through buildConfQuery/buildTeamQuery, never an inline partial
// query object (D-03 mutual exclusivity, Pitfall 6).
const conf = computed<string[]>(() => sanitizeConfParam(route.query.conf as string | undefined, KNOWN_CONFERENCES))

const teamId = computed<number[]>(() => sanitizeTeamParam(route.query.team as string | undefined, teamsById.value))

const filteredGames = computed<Game[]>(() =>
  filterGames(rawWeekGames.value, { conf: conf.value, team: teamId.value }, teamsById.value)
)

// Week 14 is conference championship week -- it has zero real games in the
// CFBD schedule, so instead of the normal `GameCard` grid the workspace
// renders one `ChampionshipCard` per P4 conference.
const isChampionshipWeek = computed(() => week.value === 14)

// FBS teams with no game this week -- computed off `rawWeekGames`, never
// `filteredGames`, since a team's bye is a fact about the week itself, not
// about the active conf/team filter; the conf/team filter is then applied on
// top so the bye list still narrows along with the rest of the page. Week 14
// (championship week) has no real games at all, so every FBS team would
// otherwise show as "on bye" there -- the list is suppressed for that week.
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

// D-07, D-14/D-16: games within a week group under their home team's
// conference (sorted alphabetically), UNLESS a conference filter is active,
// in which case each SELECTED conference gets its own section rather than
// being merged into one -- a game is listed under a selected conference's
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

const filterLabel = computed(() => {
  if (teamId.value.length > 0) {
    return teamId.value.map(id => teamsById.value.get(id)?.school ?? 'This team').join(', ')
  }
  if (conf.value.length > 0) return conf.value.join(', ')
  return 'This filter'
})

// Advance-week card at the end of the slate: disabled once `week` is
// already the last navigable entry in `WEEKS`, matching WeekNav's own
// next-button boundary logic rather than a separate check.
const nextWeekDisabled = computed(() => isWeekBoundary(week.value).nextDisabled)
</script>

<template>
  <div>
    <!-- SHARE-02/03/04 (D-05): rendered above PicksWorkspace,
         unconditionally whenever a share-link preview is active -- T-08-10's
         structural guarantee that a shared scenario can never render without
         this banner alongside it. Given its own horizontal padding rather
         than a page-level wrapper, so the standings sidebar inside
         PicksWorkspace still reaches the right edge of the screen. -->
    <SharedScenarioBanner
      v-if="sharedBannerVariant !== 'none'"
      :variant="sharedBannerVariant"
      :applied-count="sharedCounts?.applied"
      :total-count="sharedCounts?.total"
      class="mx-6 mt-6 lg:mx-8"
      @save-copy="handleSaveCopy"
      @dismiss="handleDismissSharedPreview"
    />

    <DeleteScenarioModal
      :open="deleteModalOpen"
      :scenario-name="deleteTarget?.name ?? ''"
      @update:open="v => deleteModalOpen = v"
      @confirm="() => { if (deleteTarget) deleteScenario(deleteTarget.id); deleteTarget = null }"
    />

    <ShareLinkModal
      :open="shareModalOpen"
      :scenario-name="shareTarget?.name ?? ''"
      :share-url="shareTarget?.url ?? ''"
      @update:open="v => shareModalOpen = v"
    />

    <!-- `:key="activeScenarioId"` forces PicksWorkspace to fully unmount and
         remount on every scenario switch — the ONLY safe way to swap which
         useStorage() instance backs picks/autoFilled/championshipPicks/
         standings (RESEARCH.md Pitfall 1). The ScenarioSwitcher itself is
         passed down through the `scenario` slot so it renders inside the
         workspace's own sticky header (matching main's single-header
         layout, including its mobile stacking) while staying owned by this
         page's unkeyed scope. -->
    <PicksWorkspace
      :key="activeScenarioId"
      :scenario-id="activeScenarioId"
      :season="2026"
      :week="week"
      :games="games?.games ?? []"
      :conference-groups="conferenceGroups"
      :teams-by-id="teamsById"
      :rankings-by-team-id="rankingsByTeamId"
      :win-probability-by-game-id="winProbabilityByGameId"
      :betting-line-by-game-id="bettingLineByGameId"
      :bye-teams="byeTeams"
      :sidebar-conferences="sidebarConferences"
      :visible-p4-conferences="visibleP4Conferences"
      :conf="conf"
      :team-id="teamId"
      :empty-variant="emptyVariant"
      :filter-label="filterLabel"
      :load-state="loadState"
      :is-championship-week="isChampionshipWeek"
      :next-week-disabled="nextWeekDisabled"
      :preview="sharedPreview"
      @update:conf="setConf"
      @update:team-id="setTeam"
      @navigate="goToWeek"
    >
      <template #scenario>
        <ScenarioSwitcher
          :scenarios="scenarios"
          :model-value="activeScenarioId"
          :pending-edit-id="pendingEditId"
          @update:model-value="id => activeScenarioId = id"
          @rename="renameScenario"
          @duplicate="handleDuplicate"
          @create="handleCreate"
          @delete="handleDeleteRequest"
          @share="handleShare"
        />
      </template>
    </PicksWorkspace>
  </div>
</template>
