<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Game, Team } from '#shared/types/schedule'
import type { StandingsResult } from '#shared/types/standings'
import type { ConferenceId, RankGroup, TeamId } from '#shared/domain/tiebreakers/types'
import { computeStandingsPipeline, P4_CONFERENCES } from '#shared/domain/standings'
import type { ResolvedTiebreakers, SlateCompletion } from '#shared/domain/standings'
import type { ConferenceGroup } from '~/utils/schedule'
import { getAdjacentWeek } from '~/utils/schedule'
import { fillWeekRemaining, fillSeasonRemaining, clearWeek, clearSeason } from '~/utils/bulkPickOperations'
import type { SharedPreviewState } from '~/composables/useSharedPreview'

/**
 * Owns every scenario-scoped composable call (`usePicksStorage`,
 * `useAutoFilledGames`, `useChampionshipPicksStorage`, `useStandings`) and
 * the picks-dependent half of `week/[week].vue`'s template. Mounted with
 * `:key="activeScenarioId"` in the page, so it fully unmounts and remounts
 * on every scenario switch -- that remount is the ONLY safe way to swap
 * which `useStorage()` instance backs `picks`/`autoFilled`/
 * `championshipPicks`/`standings` (RESEARCH.md Pitfall 1, a verified
 * `@vueuse/core` defect: a reactive key passed into one long-lived
 * `useStorage()` call leaks the previous scenario's object/array state into
 * the newly-selected, not-yet-persisted scenario).
 *
 * The two progress indicators (`PickProgress`/`PickProgressWeek`) are
 * deliberately absent: `main`'s UI rework dropped both from the week
 * layout, and `main` is the layout of record here. Both components (and
 * their `scenarioId` prop) are kept for their own unit tests and for a
 * future caller that wants to reinstate them.
 *
 * Every other prop here (`week`, `teamsById`,
 * `conferenceGroups`, `byeTeams`, `sidebarConferences`,
 * `visibleP4Conferences`, `emptyVariant`, `filterLabel`, `loadState`,
 * `conf`, `teamId`, `isChampionshipWeek`, `nextWeekDisabled`) is plain
 * filter/routing state computed by the page and passed straight through --
 * this component recomputes none of it. The two-column layout, sticky
 * header and mobile behaviour below are `main`'s, unchanged; only the pick
 * state feeding them is scenario-aware.
 */
interface Props {
  scenarioId: string
  season?: number
  week: number
  /** Full, unfiltered season games -- the bulk-operation handlers below read ALL games regardless of the active filter. */
  games: Game[]
  conferenceGroups: ConferenceGroup[]
  teamsById: Map<number, Team>
  /** FBS teams with no game this week, already narrowed by the active filter (computed by the page). */
  byeTeams: Team[]
  /** Conferences the standings sidebar should narrow to, from an active conf OR team filter. */
  sidebarConferences: string[]
  /** P4 conferences whose `ChampionshipCard` should render on week 14. */
  visibleP4Conferences: ConferenceId[]
  conf: string[]
  teamId: number[]
  emptyVariant: 'week-empty' | 'filter-empty' | 'populated'
  filterLabel: string
  loadState: 'loading' | 'error' | 'ready'
  isChampionshipWeek: boolean
  nextWeekDisabled: boolean
  /**
   * Phase 8 (SHARE-02/D-07): when set, this component renders a share-link
   * preview instead of the real, storage-backed scenario -- a plain object,
   * never wrapped in `useStorage`, so nothing about a preview ever touches
   * `localStorage` until the page's own "Save a copy" handler explicitly
   * writes it into a brand-new scenario. `null` (the default) is today's
   * unchanged, storage-backed behavior.
   */
  preview?: SharedPreviewState | null
}

const props = withDefaults(defineProps<Props>(), { season: 2026, preview: null })

const emit = defineEmits<{
  'update:conf': [value: string[] | undefined]
  'update:teamId': [value: number[] | undefined]
  'navigate': [week: number]
}>()

// Fresh useStorage()/composable instances every time this component mounts
// -- the exact mechanism that closes RESEARCH.md's Pitfall 1 leak (see the
// docblock above and the parent's `:key="activeScenarioId"` binding). These
// are the REAL, storage-backed values -- `stored`-prefixed so the plain
// `picks`/`standings`/`rankings`/`slateComplete`/`commitOrdering` names below
// can select between these and a preview's without a second set of template
// bindings (D-07, the "same GameCard/StandingsSidebar, zero new props"
// requirement).
const storedPicks = usePicksStorage(props.scenarioId, props.season)
const { autoFilled, markAutoFilled } = useAutoFilledGames(props.scenarioId, props.season)
const {
  standings: storedStandings,
  rankings: storedRankings,
  slateComplete: storedSlateComplete,
  commitOrdering: storedCommitOrdering
} = useStandings(props.scenarioId, props.season)

// Conference championship winner picks: `{ conferenceName: winningTeamId }`,
// kept separate from `picks` because a championship matchup has no real
// CFBD game id. Scenario-scoped like every other pick key here, so
// duplicating or deleting a scenario carries/removes it too.
const storedChampionshipPicks = useChampionshipPicksStorage(props.scenarioId, props.season)

// Standings sidebar open/collapsed state, lifted here so the header's
// toggle button and StandingsSidebar's own USidebar instance share it.
const standingsOpen = ref(true)

// Filter v-models proxy straight back out to the page, which owns the
// router query -- this component never touches the route itself.
const confModel = computed<string[]>({
  get: () => props.conf,
  set: value => emit('update:conf', value)
})
const teamIdModel = computed<number[]>({
  get: () => props.teamId,
  set: value => emit('update:teamId', value)
})

const teamsArray = computed(() => Array.from(props.teamsById.values()))

// Preview-branch standings. 08-REVIEW WR-03 (iteration 2): the resolve ->
// slate-completion -> apply-manual-ordering -> compute-standings
// composition ORDER used to be duplicated by hand here (06-UI-SPEC.md
// section 9.2's load-bearing order) -- it now lives in exactly one place,
// `computeStandingsPipeline`, shared with `useStandings.ts`'s own real,
// storage-backed computeds, so a future change to the pipeline can never
// leave this branch behind. `undefined` when there is no active preview.
const previewPipeline = computed(() => {
  if (!props.preview) return undefined
  return computeStandingsPipeline(props.games, teamsArray.value, props.preview.picks, props.preview.manualDecisions)
})

const previewRankingsWithManual = computed<ResolvedTiebreakers | undefined>(() => previewPipeline.value?.rankings)
const previewSlateComplete = computed<SlateCompletion | undefined>(() => previewPipeline.value?.slateComplete)
const previewStandings = computed<StandingsResult | undefined>(() => previewPipeline.value?.standings)

// Writable computed: the ONE seam that lets GameCard's in-place mutation
// (`props.picks[game.id] = teamId`) and every bulk-pick handler below work
// identically whether previewing or not, with zero new GameCard.vue props
// (orchestrator-resolved open question #2). During a preview, `set` mutates
// `props.preview.picks` IN PLACE rather than reassigning the prop itself --
// `GameCard.vue` already uses this identical eslint-disable precedent for
// prop mutation of this exact category.
const picks = computed<Record<number, number>>({
  get: () => (props.preview ? props.preview.picks : storedPicks.value),
  set: (newValue) => {
    if (props.preview) {
      for (const key of Object.keys(props.preview.picks)) {
        // eslint-disable-next-line vue/no-mutating-props, @typescript-eslint/no-dynamic-delete
        delete props.preview.picks[Number(key)]
      }
      // eslint-disable-next-line vue/no-mutating-props
      Object.assign(props.preview.picks, newValue)
      return
    }
    storedPicks.value = newValue
  }
})

// A share-link payload carries no championship picks -- the encoded
// bitfield covers real CFBD game ids only -- so a preview starts from an
// empty, purely in-memory map. It must never read or write the real active
// scenario's championship storage (the same D-07 no-writes-during-preview
// rule the picks seam above follows).
const previewChampionshipPicks = ref<Record<string, number>>({})
const championshipPicks = computed<Record<string, number>>(() =>
  (props.preview ? previewChampionshipPicks.value : storedChampionshipPicks.value)
)

const standings = computed<StandingsResult | undefined>(() => (props.preview ? previewStandings.value : storedStandings.value))
const rankings = computed<ResolvedTiebreakers | undefined>(() => (props.preview ? previewRankingsWithManual.value : storedRankings.value))
const slateComplete = computed<SlateCompletion | undefined>(() => (props.preview ? previewSlateComplete.value : storedSlateComplete.value))

// Committing a NEW manual tiebreaker decision is disabled during an active
// preview -- there is no scenario id to attach it to, and no requirement
// calls for it (RESEARCH.md Assumption A3).
function commitOrdering(conference: ConferenceId, group: RankGroup, orderedTeamIds: readonly TeamId[]) {
  if (props.preview) return
  storedCommitOrdering(conference, group, orderedTeamIds)
}

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

// WR-02: Fill Week/Clear Week's disabled state must agree with what
// handleFillWeek/handleClearWeek actually act on -- props.games filtered by
// week ONLY, independent of the active conference/team filter. Previously
// the buttons gated on props.filteredGames (week + conf/team filter), which
// could go disabled while the week still had unpicked/picked games outside
// the current filter that the handlers would silently touch.
const weekGames = computed(() => props.games.filter(g => g.week === props.week))

// Bulk operation handlers (D-12 through D-15) -- identical bodies to the
// pre-Phase-7 week/[week].vue, reading props.games/props.week instead of
// the page's own games.value.games/week.value.
function handleFillWeek() {
  const { newPicks, autoFilledIds } = fillWeekRemaining(props.games, props.week, picks.value)
  picks.value = newPicks
  // T-08-11: a preview's bulk-fill never writes auto-fill provenance into
  // the REAL active scenario's storage -- markAutoFilled/autoFilled are
  // always bound to it, preview or not.
  if (!props.preview) markAutoFilled(autoFilledIds)
}

function handleFillSeason() {
  const { newPicks, autoFilledIds } = fillSeasonRemaining(props.games, picks.value)
  picks.value = newPicks
  if (!props.preview) markAutoFilled(autoFilledIds)
}

function handleClearWeek() {
  picks.value = clearWeek(props.games, props.week, picks.value)
}

function handleClearSeason() {
  picks.value = clearSeason()
  if (!props.preview) autoFilled.value.splice(0) // Also clear provenance tracking
}

function advanceWeek() {
  emit('navigate', getAdjacentWeek(props.week, 'next'))
}
</script>

<template>
  <!-- D-01: games slate and standings share one page, side by side on
       desktop; the sidebar stacks below the slate on narrow viewports.
       No page-level container/padding here -- the sidebar needs to touch
       the top and right edge of the screen, so each column owns exactly
       the padding it needs instead. -->
  <div class="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-0">
    <div class="min-w-0 flex-1 px-6 lg:px-8 pb-6">
      <!-- Header: scenario switcher, week nav, fill/clear and the
           conference/team filter row all live in one sticky block, scoped
           to this column only — the standings sidebar is a flex sibling
           that starts at the very top of the page, not pushed down below
           the header. -->
      <div
        class="sticky top-0 z-50 bg-default/95 backdrop-blur -mx-6 px-6 lg:-mx-8 lg:px-8 pt-6 pb-4 border-b border-neutral-300 dark:border-neutral-800"
      >
        <!-- Header layout: stacked rows on mobile -- scenario switcher,
             then week nav, then conference/team filters side by side, then
             Fill/Clear alongside theme/podium -- collapsing into the single
             desktop row via `lg:contents` on each row wrapper, with
             explicit `lg:order-*` on every item so the desktop ordering
             stays independent of the mobile DOM grouping. -->
        <div class="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
          <!-- Phase 7 (D-07): scenario switcher. Rendered from the page's
               own scope through this slot, so the page keeps ownership of
               the scenario registry while the switcher still sits inside
               main's sticky header rather than in a separate bar above it
               (which would stop the standings sidebar touching the top
               edge of the screen). -->
          <div class="flex min-w-0 justify-center lg:contents">
            <div class="min-w-0 lg:order-1">
              <slot name="scenario" />
            </div>
          </div>

          <div class="flex justify-center lg:contents">
            <!-- Week navigation -->
            <WeekNav
              :week="week"
              class="lg:order-2"
              @navigate="w => emit('navigate', w)"
            />
          </div>
          <div class="flex flex-nowrap items-center justify-center gap-4 lg:contents">
            <ConferenceFilter
              v-model="confModel"
              class="lg:order-3"
            />
            <TeamFilter
              v-model="teamIdModel"
              class="lg:order-4"
            />
          </div>
          <div class="flex items-center gap-4 lg:contents">
            <div class="flex gap-2 lg:order-5">
              <UButton
                :disabled="weekGames.filter(g => !(g.id in picks)).length === 0"
                variant="ghost"
                size="sm"
                @click="handleFillWeek"
              >
                Fill Week
              </UButton>
              <UButton
                :disabled="weekGames.filter(g => g.id in picks).length === 0"
                variant="ghost"
                size="sm"
                @click="handleClearWeek"
              >
                Clear Week
              </UButton>
              <UButton
                :disabled="props.games.filter(g => !(g.id in picks)).length === 0"
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
            <div class="ml-auto flex items-center gap-2 lg:order-6 lg:ml-auto">
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

      <!-- Week 14: conference championship week. No real `GameCard` grid
           exists for it -- one `ChampionshipCard` per P4 conference stands
           in for it instead, each rendering its own loading/placeholder/
           matchup state independently, so this branch never needs its own
           loading/empty handling. -->
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
            <!-- Advance-week card: when there are no byes, it joins the
                 last conference group's own grid so it flows into the same
                 row as the last game cards rather than starting a new
                 grid/row of its own. -->
            <AdvanceWeekCard
              v-if="byeTeams.length === 0 && groupIndex === conferenceGroups.length - 1"
              :disabled="nextWeekDisabled"
              @click="advanceWeek"
            />
          </div>
        </div>

        <!-- Teams with no game this week: one card, not a per-conference
             grid like the groups above -- byes span every conference at
             once, so a single card at the end of the slate lists them all
             together. -->
        <div v-if="byeTeams.length > 0">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-dimmed mb-3">
            Byes
          </h2>
          <div
            class="grid gap-4"
            style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));"
          >
            <ByeCard :teams="byeTeams" />
            <!-- Advance-week card: joins the byes grid (the last row of the
                 slate) so it sits in the same row as the last card instead
                 of on its own line. -->
            <AdvanceWeekCard
              :disabled="nextWeekDisabled"
              @click="advanceWeek"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Standings sidebar (D-01/D-02). Desktop: pinned right of the slate
         and independently scrollable, flush against the top and right edge
         of the screen. Mobile: collapsed behind a toggle so it never pushes
         the games out of reach, with its own side padding so it doesn't
         span edge-to-edge on narrow viewports.

         WR-01: gated on `loadState` exactly like the main column, so four
         fully-formed empty tables never sit beside the skeletons while
         loading. The loading branch carries the sidebar's own outer
         width/padding classes so the two-column layout does not jump when
         the real panel replaces the skeleton. -->
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
        :preview-active="props.preview !== null"
      />
      <USkeleton
        v-else-if="loadState === 'loading'"
        class="hidden h-96 w-80 rounded-lg lg:block"
      />
    </div>
  </div>
</template>
