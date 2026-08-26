<script setup lang="ts">
import type { Team } from '#shared/types/schedule'
import type { GameMediaInfo } from '#shared/types/media'
import type { TeamRatingEntry } from '#shared/types/teamRatings'
import type { VenueInfo } from '#shared/types/venues'

/**
 * Self-contained game-detail view for `GameCard.vue`'s "Details" trigger.
 * Rendered as a modal rather than an inline collapsible section: the grid
 * `GameCard`s sit in stretches every card in a row to match the tallest
 * (`align-items: stretch`, the grid's default), so an inline expand made
 * every OTHER card in that row grow taller too without showing anything --
 * a modal sidesteps the grid entirely, and reads better on mobile than a
 * cramped in-card panel would anyway.
 *
 * Every value here is already display-ready (formatted labels, resolved
 * favorites) -- `GameCard.vue` computes them once for its own badges and
 * passes the same computeds through, so nothing is derived twice.
 */
const props = defineProps<{
  open: boolean
  away: Team
  home: Team | undefined
  awayRank?: number
  homeRank?: number
  awayWinPercent?: number
  homeWinPercent?: number
  awaySpreadLabel?: string
  homeSpreadLabel?: string
  media?: GameMediaInfo
  venue?: VenueInfo
  awayRating?: TeamRatingEntry
  homeRating?: TeamRatingEntry
  awayTalent?: number
  homeTalent?: number
}>()

const emit = defineEmits<{
  'update:open': [boolean]
}>()

function formatSp(rating: TeamRatingEntry | undefined): string {
  if (!rating || rating.spRating == null) return '—'
  return rating.spRanking != null ? `${rating.spRating.toFixed(1)} (#${rating.spRanking})` : rating.spRating.toFixed(1)
}
function formatFpi(rating: TeamRatingEntry | undefined): string {
  if (!rating || rating.fpi == null) return '—'
  return rating.fpiRanking != null ? `${rating.fpi.toFixed(1)} (#${rating.fpiRanking})` : rating.fpi.toFixed(1)
}
function formatElo(rating: TeamRatingEntry | undefined): string {
  return rating?.elo != null ? String(Math.round(rating.elo)) : '—'
}
function formatAts(rating: TeamRatingEntry | undefined): string {
  if (!rating || rating.atsWins == null || rating.atsLosses == null) return '—'
  return rating.atsPushes ? `${rating.atsWins}-${rating.atsLosses}-${rating.atsPushes}` : `${rating.atsWins}-${rating.atsLosses}`
}

// CFBD still populates `startTime` with a placeholder even when
// `isStartTimeTBD` is true -- that flag must be checked first, the string
// itself is not a reliable "no time yet" signal. No explicit `timeZone` in
// the formatter options: `Intl.DateTimeFormat` defaults to the viewer's own
// local time zone, which is what a kickoff time should show in.
const kickoffLabel = computed(() => {
  if (!props.media) return undefined
  if (props.media.isStartTimeTBD) return 'Time TBD'
  const date = new Date(props.media.startTime)
  if (Number.isNaN(date.getTime())) return undefined
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date)
})

// "Tallahassee, FL · 79,560 capacity" -- city/state and capacity are each
// independently nullable on CFBD's venue records, so every piece is joined
// only when present rather than assuming the whole triple is always there.
const venueLocationLabel = computed(() => {
  if (!props.venue) return undefined
  const cityState = [props.venue.city, props.venue.state].filter(Boolean).join(', ')
  const capacity = props.venue.capacity ? `${props.venue.capacity.toLocaleString()} capacity` : undefined
  return [cityState, capacity].filter(Boolean).join(' · ') || undefined
})

const hasSp = computed(() => props.awayRating?.spRating != null || props.homeRating?.spRating != null)
const hasFpi = computed(() => props.awayRating?.fpi != null || props.homeRating?.fpi != null)
const hasElo = computed(() => props.awayRating?.elo != null || props.homeRating?.elo != null)
const hasAts = computed(() => props.awayRating?.atsWins != null || props.homeRating?.atsWins != null)
const hasTalent = computed(() => props.awayTalent !== undefined || props.homeTalent !== undefined)
const hasRatingsTable = computed(() => hasSp.value || hasFpi.value || hasElo.value || hasAts.value || hasTalent.value)
const hasMeta = computed(() => !!props.media || !!props.venue)
</script>

<template>
  <UModal
    :open="props.open"
    :title="`${away.school} @ ${home?.school ?? 'TBD'}`"
    :ui="{ content: 'sm:max-w-md' }"
    @update:open="v => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-5">
        <!-- Matchup header: both teams side by side with logo, rank, spread,
             and win% -- a fuller-size restatement of the card's own two rows,
             now with room to breathe. -->
        <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div class="flex flex-col items-center gap-1.5 text-center">
            <img
              :src="away.logo"
              class="size-12"
              :class="{ 'dark:brightness-0 dark:invert': away.logo === '/logos/placeholder.svg' }"
              alt=""
            >
            <span class="text-sm font-medium leading-tight">
              <span
                v-if="awayRank"
                class="text-dimmed"
              >#{{ awayRank }} </span>{{ away.school }}
            </span>
            <span
              v-if="awaySpreadLabel || awayWinPercent !== undefined"
              class="flex items-center gap-1.5 text-xs text-dimmed"
            >
              <span v-if="awaySpreadLabel">{{ awaySpreadLabel }}</span>
              <UBadge
                v-if="awayWinPercent !== undefined"
                color="neutral"
                variant="subtle"
                size="sm"
                :label="`${awayWinPercent}%`"
              />
            </span>
          </div>

          <span class="text-xs font-medium text-dimmed">@</span>

          <div class="flex flex-col items-center gap-1.5 text-center">
            <img
              :src="home?.logo"
              class="size-12"
              :class="{ 'dark:brightness-0 dark:invert': home?.logo === '/logos/placeholder.svg' }"
              alt=""
            >
            <span class="text-sm font-medium leading-tight">
              <span
                v-if="homeRank"
                class="text-dimmed"
              >#{{ homeRank }} </span>{{ home?.school }}
            </span>
            <span
              v-if="homeSpreadLabel || homeWinPercent !== undefined"
              class="flex items-center gap-1.5 text-xs text-dimmed"
            >
              <span v-if="homeSpreadLabel">{{ homeSpreadLabel }}</span>
              <UBadge
                v-if="homeWinPercent !== undefined"
                color="neutral"
                variant="subtle"
                size="sm"
                :label="`${homeWinPercent}%`"
              />
            </span>
          </div>
        </div>

        <!-- Broadcast/venue meta -->
        <div
          v-if="hasMeta"
          class="flex flex-col gap-1.5 rounded-lg bg-elevated px-3 py-2.5 text-sm"
        >
          <div
            v-if="kickoffLabel"
            class="flex items-center gap-2"
          >
            <UIcon
              name="lucide:calendar-clock"
              class="size-4 shrink-0 text-dimmed"
            />
            <span>{{ kickoffLabel }}</span>
          </div>
          <div
            v-if="media"
            class="flex items-center gap-2"
          >
            <UIcon
              name="lucide:tv"
              class="size-4 shrink-0 text-dimmed"
            />
            <span>{{ media.outlet }}</span>
          </div>
          <div
            v-if="venue"
            class="flex items-start gap-2"
          >
            <UIcon
              name="lucide:map-pin"
              class="size-4 shrink-0 mt-0.5 text-dimmed"
            />
            <div class="min-w-0">
              <div class="truncate">
                {{ venue.name ?? 'Venue TBD' }}
              </div>
              <div
                v-if="venueLocationLabel"
                class="truncate text-xs text-dimmed"
              >
                {{ venueLocationLabel }}
              </div>
            </div>
          </div>
        </div>

        <!-- Power ratings comparison -->
        <div v-if="hasRatingsTable">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-dimmed">
            Power ratings
          </h3>
          <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 rounded-lg bg-elevated px-3 py-2.5 text-sm">
            <template v-if="hasSp">
              <span class="text-dimmed">SP+</span>
              <span class="text-right tabular-nums">{{ formatSp(awayRating) }}</span>
              <span class="text-right tabular-nums">{{ formatSp(homeRating) }}</span>
            </template>
            <template v-if="hasFpi">
              <span class="text-dimmed">FPI</span>
              <span class="text-right tabular-nums">{{ formatFpi(awayRating) }}</span>
              <span class="text-right tabular-nums">{{ formatFpi(homeRating) }}</span>
            </template>
            <template v-if="hasElo">
              <span class="text-dimmed">Elo</span>
              <span class="text-right tabular-nums">{{ formatElo(awayRating) }}</span>
              <span class="text-right tabular-nums">{{ formatElo(homeRating) }}</span>
            </template>
            <template v-if="hasAts">
              <span class="text-dimmed">ATS</span>
              <span class="text-right tabular-nums">{{ formatAts(awayRating) }}</span>
              <span class="text-right tabular-nums">{{ formatAts(homeRating) }}</span>
            </template>
            <template v-if="hasTalent">
              <span class="text-dimmed">Talent</span>
              <span class="text-right tabular-nums">{{ awayTalent?.toFixed(1) ?? '—' }}</span>
              <span class="text-right tabular-nums">{{ homeTalent?.toFixed(1) ?? '—' }}</span>
            </template>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
