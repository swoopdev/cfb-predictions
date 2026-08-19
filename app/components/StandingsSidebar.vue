<script setup lang="ts">
// `computed`/`ref`/`useId` are imported explicitly from 'vue', and
// StandingsTable is imported relatively rather than through Nuxt's component
// auto-import, so this component mounts in the plain vitest project (the
// project's vitest config registers no Nuxt auto-import plugin — same
// reasoning as StandingsTable's own header note).
import { computed, ref, useId } from 'vue'
import type { StandingsResult } from '#shared/types/standings'
import type { ConferenceId } from '#shared/domain/tiebreakers/types'
import { P4_CONFERENCES } from '#shared/domain/standings'
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
   * The active conference filter, straight from `?conf=` (Phase 2). `null` /
   * `undefined` means "All".
   */
  activeConference?: string | null
}>(), {
  activeConference: null
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
 * query param. Anything that is not one of the four P4 conference names — an
 * unknown or hand-edited string, the literal "All" sentinel, or a G5
 * conference that has no standings in v1 — is treated as "no filter" rather
 * than rendering an empty or broken panel.
 */
const selectedConference = computed<ConferenceId | null>(() => {
  const value = props.activeConference
  return typeof value === 'string' && isP4Conference(value) ? value : null
})

const visibleConferences = computed<ConferenceId[]>(() =>
  selectedConference.value ? [selectedConference.value] : [...P4_ORDER]
)

/**
 * A filter IS active but names a conference that has no standings. Without a
 * line of explanation the sidebar would look like it had silently ignored the
 * user's filter.
 */
const showsUnfilterableNote = computed<boolean>(() =>
  typeof props.activeConference === 'string'
  && props.activeConference !== ''
  && props.activeConference !== 'All'
  && selectedConference.value === null
)

// Ephemeral, per-session sidebar visibility on narrow viewports (D-01).
// Deliberately not persisted: it is a viewing preference for the current
// scroll position, not part of the user's scenario.
const expanded = ref(false)
const panelId = useId()
</script>

<template>
  <aside
    class="w-full lg:w-80 lg:shrink-0 lg:sticky lg:top-6"
    aria-label="Conference standings"
  >
    <!-- Mobile only: the panel is tall (up to 67 rows across four
         conferences), so it stays collapsed until asked for rather than
         pushing the game slate off the bottom of the screen. On `lg` and up
         the button is gone and the panel is unconditionally visible — the
         breakpoint is `lg`, not the `md` the plan suggested, because between
         768px and 1024px a 320px sidebar leaves the 280px-min game grid a
         single cramped column. -->
    <button
      type="button"
      class="lg:hidden mb-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-default bg-elevated ring ring-accented hover:bg-accented transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :aria-expanded="expanded"
      :aria-controls="panelId"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Hide standings' : 'Show standings' }}
      <!-- Decorative: the button's own text already says which way it goes,
           so the chevron is hidden from assistive tech. -->
      <svg
        class="size-4 transition-transform"
        :class="expanded ? 'rotate-180' : ''"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M6 8l4 4 4-4" />
      </svg>
    </button>

    <div
      :id="panelId"
      class="lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto overscroll-contain rounded-lg bg-default ring ring-default p-3 sm:p-4"
      :class="expanded ? 'block' : 'hidden'"
    >
      <p
        v-if="showsUnfilterableNote"
        class="mb-3 text-xs text-dimmed"
      >
        Standings cover the four power conferences.
      </p>

      <div class="divide-y divide-default">
        <div
          v-for="conference in visibleConferences"
          :key="conference"
          class="py-4 first:pt-0 last:pb-0"
        >
          <StandingsTable
            :standings="standings?.[conference] ?? []"
            :conference-name="conference"
          />
        </div>
      </div>
    </div>
  </aside>
</template>
