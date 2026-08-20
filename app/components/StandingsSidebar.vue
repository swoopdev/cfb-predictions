<script setup lang="ts">
// `computed`/`ref`/`useId` are imported explicitly from 'vue', and
// StandingsTable is imported relatively rather than through Nuxt's component
// auto-import, so this component mounts in the plain vitest project (the
// project's vitest config registers no Nuxt auto-import plugin — same
// reasoning as StandingsTable's own header note).
import { computed } from 'vue'
import type { StandingsResult } from '#shared/types/standings'
import type { ConferenceId, RankGroup, TeamId } from '#shared/domain/tiebreakers/types'
import { P4_CONFERENCES } from '#shared/domain/standings'
import type { ResolvedTiebreakers, SlateCompletion } from '#shared/domain/standings'
import StandingsTable from './StandingsTable.vue'

/**
 * The standings panel that sits beside the week's game slate (D-01).
 *
 * Owns exactly one decision: WHICH conferences to render (D-02). Ranking,
 * sorting and tie semantics all live in `computeStandings()`; row markup lives
 * in `StandingsTable`. This component neither computes nor re-filters
 * standings data — `computeStandings()` always returns all four P4
 * conferences and this is a display-level choice on top of that, which keeps
 * the computation pure and reusable for Phase 6.
 */
const props = withDefaults(defineProps<{
  /**
   * Output of `useStandings()` — all four P4 conferences, or `undefined`
   * while games/teams are still resolving (WR-06: never an empty-object
   * sentinel — the week page gates this component's mount on `loadState`
   * instead).
   */
  standings: StandingsResult | undefined
  /**
   * The active conference filter(s), straight from `?conf=` (Phase 2, now
   * multi-select). Empty array / `null` / `undefined` means "All".
   */
  activeConference?: string[] | null
  /**
   * Output of `useStandings()` (Plan 06-04, TIE-07). `Partial` because a
   * conference is omitted when its tiebreaker resolution threw (see
   * `resolveAllConferences`) -- `undefined` per-conference is exactly the
   * signal `ChampionshipCard`'s error state reads. This component performs
   * no filtering or computation of its own on it; it only indexes and
   * passes the per-conference entry straight down to `StandingsTable`,
   * which is where `ranking` is actually consumed.
   */
  rankings?: ResolvedTiebreakers | undefined
  /**
   * Output of `useStandings()` (Plan 06-07). `undefined` while games/teams
   * are still resolving -- indexed with `?? false` below, per conference, so
   * an absent map degrades to "not complete" (the D-17 ordering interaction
   * stays hidden) rather than throwing. This component performs no
   * completion computation of its own; it only indexes and passes the
   * per-conference boolean straight down to `StandingsTable`.
   */
  slateComplete?: SlateCompletion | undefined
  /**
   * `useStandings()`'s own `commitOrdering`, threaded straight through
   * unchanged to every `StandingsTable`. A single shared function works for
   * all four conferences because it already takes `conference` as its first
   * argument -- this component holds no storage knowledge of its own.
   */
  commitOrdering?: (conference: ConferenceId, group: RankGroup, orderedTeamIds: readonly TeamId[]) => void
  /**
   * `{ conferenceName: winningTeamId }`, from `useChampionshipPicksStorage`.
   * The championship picker itself now lives on the week 14 page, not here
   * -- this is threaded straight through to `StandingsTable`, display-only,
   * so a picked result still reflects in the standings' overall record.
   */
  championshipPicks?: Record<string, number>
}>(), {
  activeConference: () => [],
  rankings: undefined,
  slateComplete: undefined,
  commitOrdering: undefined,
  championshipPicks: undefined
})

/**
 * Display order when no filter is active. Derived from `P4_CONFERENCES`
 * (itself `Object.keys(CONFERENCE_RULES)`) rather than re-listed here, so
 * "which conferences are P4, and in what order" keeps exactly one definition
 * in the codebase. That order is already SEC, Big Ten, Big 12, ACC.
 * `P4_CONFERENCES` is `readonly ConferenceId[]` (Task 1), so this needs no
 * cast to be usable with `includes` below.
 */
const P4_ORDER = P4_CONFERENCES

/**
 * T-06-07: narrows an arbitrary string to `ConferenceId` by checking
 * membership in `P4_ORDER`, the one place P4 membership is defined. The cast
 * inside is safe because `includes` performs the actual runtime check this
 * function's return type promises — it exists so `selectedConference` and
 * `visibleConferences` come out typed as `ConferenceId`, which is what lets
 * the tightened `StandingsResult` be indexed below without a second cast.
 */
function isP4Conference(value: string): value is ConferenceId {
  return P4_ORDER.includes(value as ConferenceId)
}

/**
 * T-05-03/T-06-07: `activeConference` originates in a user-controlled URL
 * query param (now multi-select). Anything that is not one of the four P4
 * conference names — an unknown or hand-edited string, or a G5 conference
 * that has no standings in v1 — is dropped rather than rendering an empty or
 * broken panel. Order follows `P4_ORDER`, not selection order, so the panel
 * stays stable regardless of pick order.
 */
const selectedConferences = computed<ConferenceId[]>(() => {
  const values = props.activeConference ?? []
  return P4_ORDER.filter(c => values.includes(c) && isP4Conference(c))
})

const visibleConferences = computed<ConferenceId[]>(() =>
  selectedConferences.value.length > 0 ? selectedConferences.value : [...P4_ORDER]
)

/**
 * `UAccordion`'s own item shape (this task). `value` doubles as the label
 * -- there is no separate display name for a conference anywhere in this
 * app -- and as the key `StandingsTable` is re-indexed by in the `#body`
 * slot below.
 */
const accordionItems = computed(() =>
  visibleConferences.value.map(conference => ({ value: conference, label: conference }))
)

/**
 * A filter IS active but names a conference that has no standings. Without a
 * line of explanation the sidebar would look like it had silently ignored the
 * user's filter.
 */
const showsUnfilterableNote = computed<boolean>(() =>
  (props.activeConference?.length ?? 0) > 0
  && selectedConferences.value.length === 0
)

// Sidebar open/collapsed state (D-01). Owned by the parent via v-model so a
// header-level toggle button can drive the same panel USidebar renders here.
// Deliberately not persisted: it is a viewing preference for the current
// session, not part of the user's scenario.
const open = defineModel<boolean>('open', { default: true })
</script>

<template>
  <!-- USidebar's default `container` is viewport-fixed, meant for full app
       shells. This page's standings panel instead lives inline in the
       page's normal flow (following document scroll), so `container` is
       overridden to `sticky` and the `gap` spacer (which only exists to
       reserve layout space for a fixed sidebar) is dropped — the sticky
       container reserves its own space directly. -->
  <USidebar
    v-model:open="open"
    side="right"
    collapsible="icon"
    title="Standings"
    aria-label="Conference standings"
    :style="{ '--sidebar-width': '26rem' }"
    :ui="{
      root: 'shrink-0 data-[state=collapsed]:hidden',
      gap: 'hidden',
      container: 'static lg:sticky lg:top-0 z-[60] flex h-auto lg:min-h-screen w-full lg:w-(--sidebar-width) border-s-0 end-auto',
      inner: 'divide-y divide-default rounded-lg lg:rounded-none ring ring-default lg:ring-0 lg:border-s lg:border-default bg-default overflow-hidden',
      body: 'p-3 sm:p-4'
    }"
  >
    <template #default="{ state }">
      <template v-if="state === 'expanded'">
        <p
          v-if="showsUnfilterableNote"
          class="mb-3 text-xs text-dimmed"
        >
          Standings cover the four power conferences.
        </p>

        <!-- `UAccordion`, not a hand-rolled disclosure button: every
             conference collapses independently (`type="multiple"`), all
             start open (`default-value`), and each is truly removed from
             the DOM while collapsed via the accordion's own
             `unmount-on-hide` (matching the "absent, not hidden" disclosure
             convention `TiebreakerReasoning` already uses elsewhere in this
             tree). `StandingsTable` renders with `show-heading="false"`
             here because the accordion trigger's own label already IS the
             conference name -- a second `<h3>` inside would duplicate it. -->
        <UAccordion
          :items="accordionItems"
          type="multiple"
          :default-value="visibleConferences"
          :ui="{
            root: 'w-full',
            trigger: 'text-xs font-semibold uppercase tracking-wide text-toned py-2',
            content: 'pb-4'
          }"
        >
          <template #body="{ item }">
            <StandingsTable
              :standings="standings?.[(item.value as ConferenceId)] ?? []"
              :conference-name="item.value"
              :ranking="rankings?.[(item.value as ConferenceId)]"
              :slate-complete="slateComplete?.[(item.value as ConferenceId)] ?? false"
              :commit-ordering="commitOrdering"
              :show-heading="false"
              :championship-picks="championshipPicks"
            />
          </template>
        </UAccordion>
      </template>
    </template>
  </USidebar>
</template>
