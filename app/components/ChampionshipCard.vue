<script setup lang="ts">
/**
 * The championship matchup element (TIE-07, D-12, D-13, D-14, P-2).
 *
 * Reads the two championship seeds directly off `championshipFor(ranking)` --
 * `ranking.groups[0]`/`groups[1]` -- and renders nothing else. Standings row
 * order is a DISPLAY artefact of `computeStandings`; the engine's ordered
 * `RankGroup` sequence is the only source of truth for who plays in the
 * championship game (D-12). This component never indexes `groups` by hand
 * and never receives a standings-row array to infer a matchup from.
 *
 * Dumb and presentational: no store access, no composable calls, no data
 * fetching. `schoolById` and `hasPickedConferenceGames` are both derived by
 * the caller (`StandingsTable.vue`) from the same `standings` rows it
 * already has, which is why this component takes no games/picks prop of its
 * own -- see the `state` computed below for how it still tells "not loaded
 * yet" apart from "resolution failed" without one.
 *
 * D-14 is absolute: an unresolved seed renders exactly one presentation --
 * no badge, no icon, no `TerminalReason` text, no branch on WHY the seed is
 * unresolved (mid-season incompleteness and a permanently-uncomputable
 * ranking-step read identically here). `TerminalReason.ruleCitation` belongs
 * only in `TiebreakerReasoning.vue` (Plan 06-06), which is TIE-05's
 * territory -- this component never imports `TerminalReason`.
 *
 * `import { computed, ref } from 'vue'` explicitly, plain HTML elements only
 * (no `UButton`/`UIcon`/auto-import) -- the plain vitest project registers no
 * Nuxt auto-import plugin (06-UI-SPEC.md §1.1).
 */
import { computed, ref } from 'vue'
import type { ConferenceRanking, RankGroup } from '#shared/domain/tiebreakers/types'
import { championshipFor } from '#shared/domain/tiebreakers/engine'

const props = defineProps<{
  ranking: ConferenceRanking | undefined
  schoolById: ReadonlyMap<number, string>
  hasPickedConferenceGames: boolean
  /**
   * Whether this conference's own slate is fully picked (Plan 06-07's
   * per-conference completion map, threaded straight through from
   * `StandingsTable`). The card stays hidden until this is true — a
   * matchup can technically resolve to a name or a short candidate list
   * well before every game is picked, but the card is only useful once
   * the conference's own choices are actually finished deciding it.
   */
  slateComplete: boolean
}>()

/**
 * Local disclosure state for the P-2 candidate overflow control. One flag is
 * sufficient: `championshipFor` guarantees at most one seed slot is ever an
 * unresolved candidate set at a time (seed 2 is suppressed to `undefined`
 * whenever seed 1 itself holds more than one team), so the two possible
 * candidate-block render sites below never compete for this state.
 */
const expanded = ref(false)

type SeedDisplay
  = | { kind: 'name', name: string }
    | { kind: 'candidates', connective: string, candidates: readonly string[] }

function schoolFor(teamId: number): string {
  return props.schoolById.get(teamId) ?? String(teamId)
}

/**
 * P-2: candidates are ordered alphabetically by school, never by
 * `group.teams`'s own order -- which can be a raw team-id sort
 * (06-RESEARCH.md Pitfall 1) and carries no meaningful ranking of its own.
 */
function alphabeticalCandidates(group: RankGroup): readonly string[] {
  return [...group.teams].map(schoolFor).sort((a, b) => a.localeCompare(b))
}

function displayFor(group: RankGroup | undefined, connective: string): SeedDisplay | undefined {
  if (!group) return undefined
  if (group.teams.length === 1) {
    return { kind: 'name', name: schoolFor(group.teams[0]!) }
  }
  return { kind: 'candidates', connective, candidates: alphabeticalCandidates(group) }
}

const seeds = computed(() => (props.ranking ? championshipFor(props.ranking) : {}))

/**
 * D-13/§5.3: when `groups[0]` itself holds more than one team, both
 * championship spots come out of that one group -- `championshipFor`
 * returns `seed2: undefined` for this case, so `secondary` below is
 * naturally `undefined` too and no second, overlapping candidate set is
 * ever rendered.
 */
const primary = computed<SeedDisplay | undefined>(() => displayFor(seeds.value.seed1, 'Two of: '))
const secondary = computed<SeedDisplay | undefined>(() => displayFor(seeds.value.seed2, 'One of: '))

const pendingBlock = computed<Extract<SeedDisplay, { kind: 'candidates' }> | undefined>(() => {
  if (primary.value?.kind === 'candidates') return primary.value
  if (secondary.value?.kind === 'candidates') return secondary.value
  return undefined
})

const visibleCandidates = computed(() => {
  if (!pendingBlock.value) return []
  return expanded.value ? pendingBlock.value.candidates : pendingBlock.value.candidates.slice(0, 3)
})

const hiddenCount = computed(() =>
  pendingBlock.value ? Math.max(0, pendingBlock.value.candidates.length - 3) : 0
)

/**
 * §10 state precedence: loading, then empty (absence of picks -- NOT an
 * unsettled-tie distinction, per D-14), then error, then the normal matchup
 * read.
 *
 * Loading is detected via `schoolById.size === 0`: an empty lookup means
 * `StandingsTable`'s `standings` prop has zero rows, which is the only
 * signal available here that games/teams have not resolved yet -- this
 * component deliberately takes no standings-row prop of its own (Task 3's
 * `schoolById`/`hasPickedConferenceGames` computeds are both built over
 * those same rows in the caller).
 */
const state = computed<'loading' | 'empty' | 'error' | 'matchup'>(() => {
  if (props.ranking === undefined && props.schoolById.size === 0) return 'loading'
  if (!props.hasPickedConferenceGames) return 'empty'
  if (props.ranking === undefined) return 'error'
  return 'matchup'
})
</script>

<template>
  <div
    v-if="slateComplete && (state === 'matchup' || state === 'error')"
    class="bg-elevated ring ring-accented rounded-lg p-3 mb-4"
  >
    <p class="text-xs font-semibold uppercase tracking-wide text-muted">
      CHAMPIONSHIP GAME
    </p>

    <template v-if="state === 'error'">
      <p class="text-xs font-semibold uppercase tracking-wide text-muted">
        Tiebreakers unavailable
      </p>
      <p class="text-sm text-muted">
        We couldn't resolve this conference's procedure. The standings below are ordered by record only. Changing a pick may resolve it.
      </p>
    </template>

    <template v-else>
      <p
        v-if="primary?.kind === 'name'"
        class="text-base font-semibold text-highlighted"
      >
        {{ primary.name }}
      </p>
      <div v-else-if="primary?.kind === 'candidates'">
        <p class="text-sm text-default">
          {{ primary.connective }}{{ visibleCandidates.join(' / ') }}
          <button
            v-if="hiddenCount > 0 || expanded"
            type="button"
            class="text-xs font-normal text-toned underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :aria-expanded="expanded"
            @click="expanded = !expanded"
          >
            {{ expanded ? 'Show fewer' : `+${hiddenCount} more` }}
          </button>
        </p>
        <p class="text-xs text-dimmed">
          Listed alphabetically.
        </p>
      </div>

      <p
        v-if="secondary"
        class="text-xs text-dimmed"
      >
        vs.
      </p>

      <p
        v-if="secondary?.kind === 'name'"
        class="text-base font-semibold text-highlighted"
      >
        {{ secondary.name }}
      </p>
      <div v-else-if="secondary?.kind === 'candidates'">
        <p class="text-sm text-default">
          {{ secondary.connective }}{{ visibleCandidates.join(' / ') }}
          <button
            v-if="hiddenCount > 0 || expanded"
            type="button"
            class="text-xs font-normal text-toned underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :aria-expanded="expanded"
            @click="expanded = !expanded"
          >
            {{ expanded ? 'Show fewer' : `+${hiddenCount} more` }}
          </button>
        </p>
        <p class="text-xs text-dimmed">
          Listed alphabetically.
        </p>
      </div>
    </template>
  </div>
</template>
