<script setup lang="ts">
/**
 * The championship matchup element (TIE-07, D-12, D-13, D-14, P-2; reskinned
 * and made pickable this task).
 *
 * Reads the two championship seeds directly off `championshipFor(ranking)` --
 * `ranking.groups[0]`/`groups[1]` -- and renders nothing else. Standings row
 * order is a DISPLAY artefact of `computeStandings`; the engine's ordered
 * `RankGroup` sequence is the only source of truth for who plays in the
 * championship game (D-12). This component never indexes `groups` by hand
 * and never receives a standings-row array to infer a matchup from.
 *
 * `schoolById` and `hasPickedConferenceGames` are both derived by the caller
 * (`StandingsTable.vue`) from the same `standings` rows it already has,
 * which is why this component takes no games/picks prop of its own for
 * THOSE two -- see the `state` computed below for how it still tells "not
 * loaded yet" apart from "resolution failed" without one.
 *
 * D-14 is absolute for the still-unresolved presentation: an unresolved seed
 * renders exactly one presentation -- no badge, no icon, no `TerminalReason`
 * text, no branch on WHY the seed is unresolved. `TerminalReason.ruleCitation`
 * belongs only in `TiebreakerReasoning.vue` (Plan 06-06), which is TIE-05's
 * territory -- this component never imports `TerminalReason`.
 *
 * **This task's addition: a pickable matchup, styled like `GameCard`.** Once
 * both seeds resolve to a single concrete team each, the card renders the
 * exact same two-row, click-to-pick pattern `GameCard` uses for a real
 * slate game (checkmark, logo, team-color accent) instead of static text --
 * see `pickable` below. `championshipPicks` is mutated directly by
 * `togglePick`, the same convention `GameCard` uses for its own `picks`
 * prop, keyed by `conferenceName` (a championship matchup has no real CFBD
 * game id to key off of). The picked winner's effect on the standings
 * table's overall record is `StandingsTable`'s own concern
 * (`displayOverallRecord`) -- this component only records the pick.
 */
import { computed, ref } from 'vue'
import type { ConferenceRanking, RankGroup, ConferenceId, TeamId } from '#shared/domain/tiebreakers/types'
import type { Team } from '#shared/types/schedule'
import { championshipFor } from '#shared/domain/tiebreakers/engine'
import { validateTeamContrast, applyContrastFilter } from '~/utils/teamContrast'

const props = withDefaults(defineProps<{
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
  /** Which conference this is -- the key `championshipPicks` is read/written under. */
  conferenceName: ConferenceId
  /** Full team lookup, for logos/colors on the pickable rows. */
  teamsById?: ReadonlyMap<number, Team>
  /** `{ conferenceName: winningTeamId }`, mutated directly by `togglePick`. */
  championshipPicks?: Record<string, number>
}>(), {
  teamsById: undefined,
  championshipPicks: undefined
})

/**
 * Local disclosure state for the P-2 candidate overflow control. One flag is
 * sufficient: `championshipFor` guarantees at most one seed slot is ever an
 * unresolved candidate set at a time (seed 2 is suppressed to `undefined`
 * whenever seed 1 itself holds more than one team), so the two possible
 * candidate-block render sites below never compete for this state.
 */
const expanded = ref(false)

type SeedDisplay
  = | { kind: 'name', teamId: TeamId, name: string }
    | { kind: 'candidates', connective: string, candidates: readonly string[] }

function schoolFor(teamId: number): string {
  return props.schoolById.get(teamId) ?? String(teamId)
}

const PLACEHOLDER_TEAM = Object.freeze({
  logo: '/logos/placeholder.svg',
  color: '#6b7280',
  alternateColor: '#6b7280'
})

/**
 * `teamsById` is the full app-wide team map (passed down from the week
 * page), so a championship participant -- always a P4 team already present
 * in `schoolById` -- is expected to resolve here too. The placeholder
 * fallback mirrors `GameCard`'s own FCS-opponent fallback (gray, generic
 * shield) purely defensively, for a `teamsById` that hasn't loaded yet.
 */
function teamFor(teamId: TeamId): Team {
  return props.teamsById?.get(teamId) ?? {
    id: teamId,
    school: schoolFor(teamId),
    mascot: null,
    abbreviation: null,
    conference: props.conferenceName,
    classification: null,
    ...PLACEHOLDER_TEAM
  }
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
    const teamId = group.teams[0]!
    return { kind: 'name', teamId, name: schoolFor(teamId) }
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
 * The card only becomes an actual pick control once BOTH spots have
 * resolved to one concrete team each -- an unresolved/candidate seed falls
 * back to the plain-text presentation below (`pendingBlock`), same as
 * before this task. `championshipPicks` being present is also required:
 * a caller that doesn't wire up pick storage gets the read-only text
 * presentation, never a control it can click with no effect.
 */
const pickable = computed(() =>
  primary.value?.kind === 'name'
  && secondary.value?.kind === 'name'
  && props.championshipPicks !== undefined
)

const homeTeam = computed<Team | undefined>(() =>
  primary.value?.kind === 'name' ? teamFor(primary.value.teamId) : undefined
)
const awayTeam = computed<Team | undefined>(() =>
  secondary.value?.kind === 'name' ? teamFor(secondary.value.teamId) : undefined
)

/**
 * A 90deg linear gradient between the two participants' primary colors,
 * for the top badge (this task). Independent of `pickable` -- the two
 * teams' colors are known as soon as both seeds resolve to a name, even
 * before `championshipPicks` makes the card an actual pick control, so the
 * badge can go two-color as soon as there's a real matchup to show.
 */
const pillGradient = computed<string | undefined>(() => {
  if (!homeTeam.value || !awayTeam.value) return undefined
  return `linear-gradient(90deg, ${awayTeam.value.color} 0%, ${homeTeam.value.color} 100%)`
})

/**
 * Same two-color split-border technique `GameCard` uses (`.game-card-
 * gradient-border`, this task): away's color on top, home's on bottom. Both
 * participants' colors are only known once `homeTeam`/`awayTeam` resolve
 * (both seeds are a concrete name), so unresolved/placeholder/error states
 * fall back to a flat neutral border instead of a gradient with nothing
 * real to show.
 */
const awayBorderColor = computed(() => awayTeam.value?.color ?? '#6b7280')
const homeBorderColor = computed(() => homeTeam.value?.color ?? awayBorderColor.value)

const pickedTeamId = computed<TeamId | undefined>(() => props.championshipPicks?.[props.conferenceName])

function togglePick(teamId: TeamId): void {
  if (!props.championshipPicks) return
  if (pickedTeamId.value === teamId) {
    // eslint-disable-next-line vue/no-mutating-props, @typescript-eslint/no-dynamic-delete
    delete props.championshipPicks[props.conferenceName]
  } else {
    // eslint-disable-next-line vue/no-mutating-props
    props.championshipPicks[props.conferenceName] = teamId
  }
}

function handleTeamKeydown(teamId: TeamId, event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    togglePick(teamId)
  }
}

function contrastFor(team: Team) {
  return validateTeamContrast(team.color, 'light')
}

function textColorFor(bgColor: string): string {
  const hex = bgColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128 ? '#000000' : '#ffffff'
}

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

/**
 * Week 14 placeholder (this task): the card itself is now always visible on
 * the week 14 page, one per conference, rather than only appearing once
 * `slateComplete`. Before the conference's own regular season is fully
 * picked, both matchup slots render as "TBD" instead of the resolved
 * name/candidate-list presentation below — `pickable`, `primary`,
 * `secondary` etc. all stay gated on `slateComplete` exactly as before, so
 * nothing here changes when a real matchup becomes pickable.
 */
const isPlaceholder = computed(() => !props.slateComplete)
</script>

<template>
  <UCard
    v-if="state !== 'loading'"
    :ui="{
      root: 'relative bg-transparent overflow-visible mb-4 rounded-lg game-card-gradient-border',
      body: 'p-3 sm:p-3'
    }"
    :style="{
      '--away-border-color': awayBorderColor,
      '--home-border-color': homeBorderColor
    }"
  >
    <!-- Same badge treatment `GameCard` uses for its own top-straddling
         badges, so a championship card reads as one visual family with the
         regular slate rather than a bespoke box. Once both participants are
         known, the pill's background is a gradient of their two team
         colors instead of the flat `primary` fill -- a same-conference
         color clash (e.g. two red teams) is still legible because the text
         is white with a shadow, not colored to match either team. Wrapped
         in the same click-to-reveal `UPopover` as GameCard's own "Conference"
         / "Neutral" pills (this task) so it explains itself the same way. -->
    <div class="absolute -top-2.5 right-2 z-10">
      <UPopover mode="click">
        <UBadge
          :color="pillGradient ? 'neutral' : 'primary'"
          :variant="pillGradient ? undefined : 'solid'"
          label="Conference Championship"
          class="cursor-pointer"
          :class="pillGradient ? 'text-white border-transparent' : undefined"
          :style="pillGradient ? { backgroundImage: pillGradient, textShadow: '0 1px 2px rgb(0 0 0 / 0.55)' } : undefined"
        />
        <template #content>
          <p class="text-sm p-2 max-w-48">
            This game decides the conference's champion.
          </p>
        </template>
      </UPopover>
    </div>

    <!-- Placeholder: the conference's own regular season isn't fully picked
         yet, so there's nothing real to show -- both slots read "TBD" rather
         than the card being absent entirely (this task). -->
    <template v-if="isPlaceholder">
      <p class="text-base font-semibold text-dimmed pt-2">
        TBD
      </p>
      <p class="text-xs text-dimmed">
        vs.
      </p>
      <p class="text-base font-semibold text-dimmed">
        TBD
      </p>
    </template>

    <template v-else-if="state === 'error'">
      <p class="text-xs font-semibold uppercase tracking-wide text-muted pt-2">
        Tiebreakers unavailable
      </p>
      <p class="text-sm text-muted">
        We couldn't resolve this conference's procedure. The standings below are ordered by record only. Changing a pick may resolve it.
      </p>
    </template>

    <!-- Pickable: same two-row, click-to-pick pattern as `GameCard`. -->
    <template v-else-if="pickable && awayTeam && homeTeam">
      <div
        class="flex items-center gap-2 cursor-pointer user-select-none rounded px-2 py-3 mt-2 transition-colors"
        :class="{
          'border-l-8': pickedTeamId === awayTeam.id,
          'hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50': pickedTeamId !== awayTeam.id
        }"
        :style="{
          ...(pickedTeamId === awayTeam.id ? {
            borderColor: awayTeam.color,
            backgroundColor: awayTeam.alternateColor,
            ...applyContrastFilter(contrastFor(awayTeam))
          } : {})
        }"
        :tabindex="0"
        :aria-label="pickedTeamId === awayTeam.id
          ? `Clear pick: ${awayTeam.school}`
          : `Pick ${awayTeam.school} to win the ${conferenceName} Championship`
        "
        role="button"
        @click="togglePick(awayTeam.id)"
        @keydown="handleTeamKeydown(awayTeam.id, $event)"
      >
        <div class="w-4 h-4 flex items-center justify-center shrink-0">
          <UIcon
            v-if="pickedTeamId === awayTeam.id"
            name="lucide:check"
            class="w-4 h-4"
            :style="{ color: textColorFor(awayTeam.alternateColor) }"
          />
          <div
            v-else
            class="w-4 h-4"
          />
        </div>
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <img
            :src="awayTeam.logo"
            class="size-8 shrink-0"
            :class="{ 'dark:brightness-0 dark:invert': awayTeam.logo === '/logos/placeholder.svg' }"
            alt=""
          >
          <span
            class="truncate text-sm"
            :style="{ color: pickedTeamId === awayTeam.id ? textColorFor(awayTeam.alternateColor) : undefined }"
            :class="{ 'text-default': pickedTeamId !== awayTeam.id }"
            :title="awayTeam.school"
          >{{ awayTeam.school }}</span>
        </div>
      </div>

      <div
        class="flex items-center gap-2 cursor-pointer user-select-none rounded px-2 py-3 transition-colors"
        :class="{
          'border-l-8': pickedTeamId === homeTeam.id,
          'hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50': pickedTeamId !== homeTeam.id
        }"
        :style="{
          ...(pickedTeamId === homeTeam.id ? {
            borderColor: homeTeam.color,
            backgroundColor: homeTeam.alternateColor,
            ...applyContrastFilter(contrastFor(homeTeam))
          } : {})
        }"
        :tabindex="0"
        :aria-label="pickedTeamId === homeTeam.id
          ? `Clear pick: ${homeTeam.school}`
          : `Pick ${homeTeam.school} to win the ${conferenceName} Championship`
        "
        role="button"
        @click="togglePick(homeTeam.id)"
        @keydown="handleTeamKeydown(homeTeam.id, $event)"
      >
        <div class="w-4 h-4 flex items-center justify-center shrink-0">
          <UIcon
            v-if="pickedTeamId === homeTeam.id"
            name="lucide:check"
            class="w-4 h-4"
            :style="{ color: textColorFor(homeTeam.alternateColor) }"
          />
          <div
            v-else
            class="w-4 h-4"
          />
        </div>
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <img
            :src="homeTeam.logo"
            class="size-8 shrink-0"
            :class="{ 'dark:brightness-0 dark:invert': homeTeam.logo === '/logos/placeholder.svg' }"
            alt=""
          >
          <span
            class="truncate text-sm"
            :style="{ color: pickedTeamId === homeTeam.id ? textColorFor(homeTeam.alternateColor) : undefined }"
            :class="{ 'text-default': pickedTeamId !== homeTeam.id }"
            :title="homeTeam.school"
          >{{ homeTeam.school }}</span>
        </div>
      </div>
    </template>

    <!-- Not yet pickable: seeds still unresolved to candidate lists, or no
         pick storage was supplied -- the original plain-text presentation. -->
    <template v-else>
      <p
        v-if="primary?.kind === 'name'"
        class="text-base font-semibold text-highlighted pt-2"
      >
        {{ primary.name }}
      </p>
      <div
        v-else-if="primary?.kind === 'candidates'"
        class="pt-2"
      >
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
  </UCard>
</template>

<style scoped>
.game-card-gradient-border::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2px;
  background: linear-gradient(
    to bottom,
    var(--away-border-color) 0%,
    var(--away-border-color) 50%,
    var(--home-border-color) 50%,
    var(--home-border-color) 100%
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
</style>
