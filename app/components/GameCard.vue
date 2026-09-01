<script setup lang="ts">
import type { Game, Team } from '#shared/types/schedule'
import type { GameMediaInfo } from '#shared/types/media'
import type { BettingLine } from '#shared/types/bettingLines'
import type { VenueInfo } from '#shared/types/venues'
import type { TeamRatingEntry } from '#shared/types/teamRatings'
import { validateTeamContrast, applyContrastFilter } from '~/utils/teamContrast'

const props = defineProps<{
  game: Game
  teamsById: Map<number, Team>
  /** Current poll rank keyed by team id -- absent (no badge) when a team is unranked. */
  rankingsByTeamId: Map<number, number>
  /** Pregame home-team win probability (0-1) -- absent (no badge) when CFBD hasn't published one for this game. */
  winProbability?: number
  /** Resolved betting line for this game -- absent when no line is published. */
  bettingLine?: BettingLine
  /** TV/streaming broadcast for this game -- game-detail modal data, absent when unpublished. */
  media?: GameMediaInfo
  /** Venue directory keyed by venue id, joined against `game.venueId`. */
  venuesById: Map<number, VenueInfo>
  /** SP+/FPI/Elo/ATS merged rating keyed by team id. */
  teamRatingsByTeamId: Map<number, TeamRatingEntry>
  /** Recruiting talent composite keyed by team id. */
  talentByTeamId: Map<number, number>
  picks: Record<number, number>
}>()

// `homeId` always resolves (0 games have a missing home-team join, per
// RESEARCH.md Pitfall 5) — no fallback needed on the home side.
const home = computed(() => props.teamsById.get(props.game.homeId))

// `awayId` may be an FCS opponent absent from teams.json (127 of 888 games,
// D-06) — falls back to the raw `awayTeam` string + the placeholder shield,
// reusing Phase 1's exact vendored asset.
const away = computed(() => props.teamsById.get(props.game.awayId) ?? {
  id: props.game.awayId,
  school: props.game.awayTeam,
  logo: '/logos/placeholder.svg',
  color: '#6b7280', // Gray fallback for FCS teams (no team-specific color)
  mascot: null,
  abbreviation: null,
  conference: 'FCS',
  classification: null,
  alternateColor: '#6b7280'
} as Team)

// Pick state computations
const pickedTeamId = computed(() => props.picks[props.game.id])

// Locked once CFBD reports the game final: no more editing this pick, and
// the win-probability badge below is replaced by the actual score. Whether
// `pickedTeamId` matches the actual winner is decided upstream, by
// `reconcilePicks` -- this component only ever renders whatever's already
// in `picks`, same as an in-progress game.
const isLocked = computed(() => props.game.completed)

const awayRank = computed(() => props.rankingsByTeamId.get(away.value.id))
const homeRank = computed(() => props.rankingsByTeamId.get(home.value?.id ?? -1))

// Rounded whole-percent win chance per side, derived from the single
// home-side probability CFBD publishes -- undefined (no badge) when the
// game has no published estimate at all. Suppressed once locked -- the
// score badge takes over that slot.
const awayWinPercent = computed(() =>
  isLocked.value || props.winProbability === undefined ? undefined : Math.round((1 - props.winProbability) * 100)
)
const homeWinPercent = computed(() =>
  isLocked.value || props.winProbability === undefined ? undefined : Math.round(props.winProbability * 100)
)

// Final score per side -- only meaningful once `isLocked`, but read
// unconditionally since `game.homePoints`/`awayPoints` are always present
// on the prop (`null` pre-kickoff).
const awayPoints = computed(() => props.game.awayPoints)
const homePoints = computed(() => props.game.homePoints)

// Spread label per side: "Pick 'em" for both on an even line, otherwise
// "-N" for the favored side and "+N" for the other -- a point spread is one
// number describing both sides of the same line (the underdog's number is
// always the exact negation of the favorite's, never independently fetched
// or capable of disagreeing), so both sides always render.
const awaySpreadLabel = computed(() => {
  if (!props.bettingLine) return undefined
  if (props.bettingLine.favored === 'even') return 'Pick \'em'
  return props.bettingLine.favored === 'away' ? `-${props.bettingLine.spread}` : `+${props.bettingLine.spread}`
})
const homeSpreadLabel = computed(() => {
  if (!props.bettingLine) return undefined
  if (props.bettingLine.favored === 'even') return 'Pick \'em'
  return props.bettingLine.favored === 'home' ? `-${props.bettingLine.spread}` : `+${props.bettingLine.spread}`
})

// Game-detail modal data: venue joins directly off the game's own venueId
// now (CFBD's `/games` already returns it -- no weather dependency needed),
// the rest are direct per-team lookups. `hasDetails` gates whether the
// "Details" trigger renders at all -- no dead button when there's nothing
// to show.
const venue = computed(() => (props.game.venueId != null ? props.venuesById.get(props.game.venueId) : undefined))
const awayRating = computed(() => props.teamRatingsByTeamId.get(away.value.id))
const homeRating = computed(() => props.teamRatingsByTeamId.get(home.value?.id ?? -1))
const awayTalent = computed(() => props.talentByTeamId.get(away.value.id))
const homeTalent = computed(() => props.talentByTeamId.get(home.value?.id ?? -1))

const hasDetails = computed(() =>
  !!props.media
  || !!venue.value
  || !!props.bettingLine
  || awayRating.value?.spRating != null || homeRating.value?.spRating != null
  || awayRating.value?.fpi != null || homeRating.value?.fpi != null
  || awayRating.value?.elo != null || homeRating.value?.elo != null
  || awayRating.value?.atsWins != null || homeRating.value?.atsWins != null
  || awayTalent.value !== undefined || homeTalent.value !== undefined
)
const detailsOpen = ref(false)

const homeBorderColor = computed(() => home.value?.color ?? away.value.color)

// Contrast validation for team colors
const homeContrast = computed(() =>
  validateTeamContrast(home.value?.color ?? '#000000', 'light')
)
const awayContrast = computed(() =>
  validateTeamContrast(away.value?.color ?? '#000000', 'light')
)

// Determine if secondary color is light or dark (for text contrast)
function getTextColorForBackground(bgColor: string): string {
  const hex = bgColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128 ? '#000000' : '#ffffff'
}

const homeSecondaryTextColor = computed(() =>
  getTextColorForBackground(home.value?.alternateColor ?? '#ffffff')
)
const awaySecondaryTextColor = computed(() =>
  getTextColorForBackground(away.value?.alternateColor ?? '#ffffff')
)

// Toggle pick: sets or clears the pick for this game. No-op once locked --
// `reconcilePicks` (PicksWorkspace.vue) already owns what the pick is at
// that point.
function togglePick(teamId: number) {
  if (isLocked.value) return
  if (pickedTeamId.value === teamId) {
    // eslint-disable-next-line vue/no-mutating-props, @typescript-eslint/no-dynamic-delete
    delete props.picks[props.game.id]
  } else {
    // eslint-disable-next-line vue/no-mutating-props
    props.picks[props.game.id] = teamId
  }
}

// Keyboard handler for team rows
function handleTeamKeydown(teamId: number, event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    togglePick(teamId)
  }
}
</script>

<template>
  <UCard
    :ui="{
      root: 'relative bg-elevated overflow-visible rounded-lg game-card-gradient-border',
      body: 'p-3 sm:p-3'
    }"
    :style="{
      '--away-border-color': away.color,
      '--home-border-color': homeBorderColor
    }"
  >
    <!-- Badges (final, neutral site, conference game) - stacked, straddling top edge -->
    <div
      v-if="isLocked || game.neutralSite || game.conferenceGame"
      class="absolute -top-2.5 right-2 flex flex-row items-center gap-1 z-10"
    >
      <UBadge
        v-if="isLocked"
        color="neutral"
        variant="solid"
        label="Final"
        icon="lucide:lock"
      />
      <UPopover
        v-if="game.conferenceGame"
        mode="click"
      >
        <UBadge
          color="primary"
          variant="solid"
          label="Conference"
          class="cursor-pointer"
        />
        <template #content>
          <p class="text-sm p-2 max-w-48">
            This game counts toward conference standings.
          </p>
        </template>
      </UPopover>
      <UPopover
        v-if="game.neutralSite"
        mode="click"
      >
        <UBadge
          color="neutral"
          variant="solid"
          label="Neutral"
          class="cursor-pointer"
        />
        <template #content>
          <p class="text-sm p-2 max-w-48">
            Played at a neutral site — neither team is at home.
          </p>
        </template>
      </UPopover>
    </div>

    <!-- Away team row (clickable for picking, locked once the game is final) -->
    <div
      class="flex items-center gap-2 user-select-none rounded px-2 py-3 border-l-8 border-transparent transition-colors"
      :class="{
        'cursor-pointer hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50': !isLocked && pickedTeamId !== away.id
      }"
      :style="{
        ...(pickedTeamId === away.id ? {
          borderColor: away.color,
          backgroundColor: away.alternateColor,
          ...applyContrastFilter(awayContrast)
        } : {})
      }"
      :tabindex="isLocked ? undefined : 0"
      :aria-label="isLocked
        ? `${away.school}: final score ${awayPoints}`
        : (pickedTeamId === away.id
          ? `Clear pick: ${away.school}`
          : `Pick ${away.school} over ${home?.school}`)
      "
      :role="isLocked ? undefined : 'button'"
      @click="togglePick(away.id)"
      @keydown="handleTeamKeydown(away.id, $event)"
    >
      <!-- Checkmark icon or placeholder -->
      <div class="w-4 h-4 flex items-center justify-center shrink-0">
        <UIcon
          v-if="pickedTeamId === away.id"
          name="lucide:check"
          class="w-4 h-4"
          :style="{ color: awaySecondaryTextColor }"
        />
        <div
          v-else
          class="w-4 h-4"
        />
      </div>

      <!-- "@" slot: blank spacer here so the away row's logo/name lines up
           with the home row's, where this same-width slot holds the "@". -->
      <div class="w-3 h-4 shrink-0" />

      <!-- Team info -->
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <img
          :src="away.logo"
          class="size-8 shrink-0"
          :class="{
            'dark:brightness-0 dark:invert': away.logo === '/logos/placeholder.svg'
          }"
          alt=""
        >
        <span
          v-if="awayRank"
          class="shrink-0 text-xs font-semibold tabular-nums text-dimmed"
          :style="{
            color: pickedTeamId === away.id ? awaySecondaryTextColor : undefined
          }"
        >#{{ awayRank }}</span>
        <span class="inline-flex min-w-0 flex-1 items-baseline gap-2">
          <span
            class="min-w-0 truncate text-sm"
            :style="{
              color: pickedTeamId === away.id ? awaySecondaryTextColor : undefined
            }"
            :class="{
              'text-default': pickedTeamId !== away.id
            }"
            :title="away.school"
          >{{ away.school }}</span>
          <span
            v-if="awaySpreadLabel"
            class="shrink-0 text-xs tabular-nums text-dimmed"
            :style="{
              color: pickedTeamId === away.id ? awaySecondaryTextColor : undefined
            }"
          >{{ awaySpreadLabel }}</span>
        </span>
        <UBadge
          v-if="isLocked && awayPoints !== null"
          :color="awayPoints > (homePoints ?? -1) ? 'primary' : 'neutral'"
          :variant="awayPoints > (homePoints ?? -1) ? 'solid' : 'subtle'"
          size="sm"
          class="ml-auto shrink-0 tabular-nums font-semibold"
          :label="`${awayPoints}`"
        />
        <UBadge
          v-else-if="awayWinPercent !== undefined"
          color="neutral"
          variant="subtle"
          size="sm"
          class="ml-auto shrink-0 tabular-nums"
          :label="`${awayWinPercent}%`"
        />
      </div>
    </div>

    <!-- Home team row (clickable for picking, locked once the game is final) -->
    <div
      class="flex items-center gap-2 user-select-none rounded px-2 py-3 border-l-8 border-transparent transition-colors"
      :class="{
        'cursor-pointer hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50': !isLocked && pickedTeamId !== home?.id
      }"
      :style="{
        ...(pickedTeamId === home?.id ? {
          borderColor: home?.color,
          backgroundColor: home?.alternateColor,
          ...applyContrastFilter(homeContrast)
        } : {})
      }"
      :tabindex="isLocked ? undefined : 0"
      :aria-label="isLocked
        ? `${home?.school}: final score ${homePoints}`
        : (pickedTeamId === home?.id
          ? `Clear pick: ${home?.school}`
          : `Pick ${home?.school} over ${away.school}`)
      "
      :role="isLocked ? undefined : 'button'"
      @click="togglePick(home!.id)"
      @keydown="handleTeamKeydown(home!.id, $event)"
    >
      <!-- Checkmark icon or placeholder -->
      <div class="w-4 h-4 flex items-center justify-center shrink-0">
        <UIcon
          v-if="pickedTeamId === home?.id"
          name="lucide:check"
          class="w-4 h-4"
          :style="{ color: homeSecondaryTextColor }"
        />
        <div
          v-else
          class="w-4 h-4"
        />
      </div>

      <!-- "@" slot: same fixed width as the away row's blank spacer above,
           so both rows' logos/names start at the same x position instead of
           "@ " shifting the home team's name text over. -->
      <div
        class="w-3 h-4 shrink-0 flex items-center justify-center text-xs text-dimmed"
        :style="{
          color: pickedTeamId === home?.id ? homeSecondaryTextColor : undefined
        }"
        aria-hidden="true"
      >
        @
      </div>

      <!-- Team info -->
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <img
          :src="home?.logo"
          class="size-8 shrink-0"
          :class="{
            'dark:brightness-0 dark:invert': home?.logo === '/logos/placeholder.svg'
          }"
          alt=""
        >
        <span
          v-if="homeRank"
          class="shrink-0 text-xs font-semibold tabular-nums text-dimmed"
          :style="{
            color: pickedTeamId === home?.id ? homeSecondaryTextColor : undefined
          }"
        >#{{ homeRank }}</span>
        <span class="inline-flex min-w-0 flex-1 items-baseline gap-2">
          <span
            class="min-w-0 truncate text-sm"
            :style="{
              color: pickedTeamId === home?.id ? homeSecondaryTextColor : undefined
            }"
            :class="{
              'text-default': pickedTeamId !== home?.id
            }"
            :title="home?.school"
          >{{ home?.school }}</span>
          <span
            v-if="homeSpreadLabel"
            class="shrink-0 text-xs tabular-nums text-dimmed"
            :style="{
              color: pickedTeamId === home?.id ? homeSecondaryTextColor : undefined
            }"
          >{{ homeSpreadLabel }}</span>
        </span>
        <UBadge
          v-if="isLocked && homePoints !== null"
          :color="homePoints > (awayPoints ?? -1) ? 'primary' : 'neutral'"
          :variant="homePoints > (awayPoints ?? -1) ? 'solid' : 'subtle'"
          size="sm"
          class="ml-auto shrink-0 tabular-nums font-semibold"
          :label="`${homePoints}`"
        />
        <UBadge
          v-else-if="homeWinPercent !== undefined"
          color="neutral"
          variant="subtle"
          size="sm"
          class="ml-auto shrink-0 tabular-nums"
          :label="`${homeWinPercent}%`"
        />
      </div>
    </div>

    <!-- Details trigger: opens GameDetailsModal instead of an inline
         collapsible panel -- an inline expand grew every OTHER card in the
         same grid row to match (grid's default `align-items: stretch`)
         without showing anything in them, and a modal reads better on
         mobile besides. Hidden entirely when there's nothing to show. -->
    <div
      v-if="hasDetails"
      class="border-t border-default -mx-3 sm:-mx-3 mt-1 px-3"
    >
      <button
        type="button"
        class="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-dimmed hover:text-default transition-colors"
        @click="detailsOpen = true"
      >
        <span>Details</span>
        <UIcon
          name="lucide:circle-ellipsis"
          class="w-3 h-3"
        />
      </button>
    </div>
  </UCard>

  <GameDetailsModal
    v-if="hasDetails"
    :open="detailsOpen"
    :away="away"
    :home="home"
    :away-rank="awayRank"
    :home-rank="homeRank"
    :away-win-percent="awayWinPercent"
    :home-win-percent="homeWinPercent"
    :away-spread-label="awaySpreadLabel"
    :home-spread-label="homeSpreadLabel"
    :betting-line="bettingLine"
    :media="media"
    :venue="venue"
    :away-rating="awayRating"
    :home-rating="homeRating"
    :away-talent="awayTalent"
    :home-talent="homeTalent"
    @update:open="v => detailsOpen = v"
  />
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
