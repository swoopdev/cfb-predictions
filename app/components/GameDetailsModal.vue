<script setup lang="ts">
import { useId } from 'vue'
import type { Team } from '#shared/types/schedule'
import type { GameMediaInfo } from '#shared/types/media'
import type { BettingLine } from '#shared/types/bettingLines'
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
  bettingLine?: BettingLine
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

// Win-probability donut geometry. Percentage labels used to sit ON the ring
// (positioned by angle/radius) and keep landing either too close to the
// stroke to read or clipped at the viewBox edge -- pulled out entirely into
// a plain legend row below the ring instead (logo + colored percentage per
// team), which sidesteps the whole problem. Each `<circle>` uses the full
// circumference as the "gap" half of `stroke-dasharray` (rather than
// `circumference - segmentLen`) so a segment never grows a second, unwanted
// arc when its own length exceeds half the circle. Both circles share
// `transform="rotate(-90 ...)"` so 0% starts at 12 o'clock; the home arc's
// negative `stroke-dashoffset` picks up exactly where the away arc's
// segment ends, going clockwise.
const donut = computed(() => {
  if (props.awayWinPercent === undefined || props.homeWinPercent === undefined) return undefined
  const center = 60
  const r = 48
  const circumference = 2 * Math.PI * r
  const awayLen = circumference * (props.awayWinPercent / 100)
  const homeLen = circumference - awayLen
  return { center, r, circumference, awayLen, homeLen }
})

// Unique per instance -- every GameCard on the week grid mounts its own
// (always-present, `v-if="hasDetails"`) GameDetailsModal, so a hardcoded
// gradient id would collide across every card's SVG in the same DOM.
const gradientUid = useId()
const awayGradientId = `win-donut-away-${gradientUid}`
const homeGradientId = `win-donut-home-${gradientUid}`

const hasSp = computed(() => props.awayRating?.spRating != null || props.homeRating?.spRating != null)
const hasFpi = computed(() => props.awayRating?.fpi != null || props.homeRating?.fpi != null)
const hasElo = computed(() => props.awayRating?.elo != null || props.homeRating?.elo != null)
const hasAts = computed(() => props.awayRating?.atsWins != null || props.homeRating?.atsWins != null)
const hasTalent = computed(() => props.awayTalent !== undefined || props.homeTalent !== undefined)
const hasRatingsTable = computed(() => hasSp.value || hasFpi.value || hasElo.value || hasAts.value || hasTalent.value)
const hasMeta = computed(() => !!props.media || !!props.venue)

function formatMoneyline(value: number | null | undefined): string {
  if (value == null) return '—'
  return value > 0 ? `+${value}` : `${value}`
}

// Same per-side spread-label shape as `awaySpreadLabel`/`homeSpreadLabel`
// (computed once in `GameCard.vue` for the current line) applied to the
// OPENING line instead, so the "Opened" row reads identically to the
// header's current-line labels.
function openSpreadLabelFor(side: 'home' | 'away'): string | undefined {
  const line = props.bettingLine
  if (!line || line.openFavored === null) return undefined
  if (line.openFavored === 'even') return 'Pick \'em'
  return line.openFavored === side ? `-${line.openSpread}` : `+${line.openSpread}`
}
const openAwayLabel = computed(() => openSpreadLabelFor('away'))
const openHomeLabel = computed(() => openSpreadLabelFor('home'))

// Only worth a row when the line actually moved -- an "Opened" row that
// just repeats the current spread is noise, not information.
const lineMoved = computed(() => {
  const line = props.bettingLine
  if (!line || line.openFavored === null) return false
  return line.openFavored !== line.favored || line.openSpread !== line.spread
})

const hasMoneyline = computed(() => props.bettingLine?.homeMoneyline != null || props.bettingLine?.awayMoneyline != null)
const hasSpread = computed(() => !!props.awaySpreadLabel || !!props.homeSpreadLabel)
const hasOddsSection = computed(() => hasSpread.value || hasMoneyline.value || lineMoved.value)
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
          </div>
        </div>

        <!-- Win probability donut: two-color ring split by each team's
             pregame win chance. Percentages live in the legend row below
             the ring, not on it -- text positioned ON a thin ring kept
             landing too close to the stroke to read cleanly or clipping at
             the edge, and a legend with each team's own logo next to its
             number is unambiguous regardless of ring size. Only rendered
             when a probability exists for this game at all. -->
        <div v-if="donut">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-dimmed">
            Win probability
          </h3>
          <div class="flex flex-col items-center gap-3 rounded-lg bg-elevated px-3 py-4">
            <svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
            >
              <defs>
                <linearGradient
                  :id="awayGradientId"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    :stop-color="away.color"
                  />
                  <stop
                    offset="100%"
                    :stop-color="away.alternateColor"
                  />
                </linearGradient>
                <linearGradient
                  :id="homeGradientId"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    :stop-color="home?.color ?? '#6b7280'"
                  />
                  <stop
                    offset="100%"
                    :stop-color="home?.alternateColor ?? '#6b7280'"
                  />
                </linearGradient>
              </defs>
              <circle
                :cx="donut.center"
                :cy="donut.center"
                :r="donut.r"
                fill="none"
                stroke="currentColor"
                class="text-default/10"
                stroke-width="14"
              />
              <circle
                :cx="donut.center"
                :cy="donut.center"
                :r="donut.r"
                fill="none"
                :stroke="`url(#${awayGradientId})`"
                stroke-width="14"
                :stroke-dasharray="`${donut.awayLen} ${donut.circumference}`"
                stroke-dashoffset="0"
                :transform="`rotate(-90 ${donut.center} ${donut.center})`"
              />
              <circle
                :cx="donut.center"
                :cy="donut.center"
                :r="donut.r"
                fill="none"
                :stroke="`url(#${homeGradientId})`"
                stroke-width="14"
                :stroke-dasharray="`${donut.homeLen} ${donut.circumference}`"
                :stroke-dashoffset="-donut.awayLen"
                :transform="`rotate(-90 ${donut.center} ${donut.center})`"
              />
            </svg>
            <div class="flex items-center gap-5">
              <div class="flex items-center gap-1.5">
                <img
                  :src="away.logo"
                  class="size-4"
                  :class="{ 'dark:brightness-0 dark:invert': away.logo === '/logos/placeholder.svg' }"
                  alt=""
                >
                <span class="text-sm font-bold tabular-nums text-default">{{ awayWinPercent }}%</span>
              </div>
              <div class="flex items-center gap-1.5">
                <img
                  :src="home?.logo"
                  class="size-4"
                  :class="{ 'dark:brightness-0 dark:invert': home?.logo === '/logos/placeholder.svg' }"
                  alt=""
                >
                <span class="text-sm font-bold tabular-nums text-default">{{ homeWinPercent }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Odds: current spread, moneyline (win outright), and
             opening-line movement, all in one comparison table. -->
        <div v-if="hasOddsSection">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-dimmed">
            Odds
          </h3>
          <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 rounded-lg bg-elevated px-3 py-2.5 text-sm">
            <template v-if="hasSpread">
              <span class="text-dimmed">Spread</span>
              <span class="text-right tabular-nums">{{ awaySpreadLabel ?? '—' }}</span>
              <span class="text-right tabular-nums">{{ homeSpreadLabel ?? '—' }}</span>
            </template>
            <template v-if="hasMoneyline">
              <span class="text-dimmed">Moneyline</span>
              <span class="text-right tabular-nums">{{ formatMoneyline(bettingLine?.awayMoneyline) }}</span>
              <span class="text-right tabular-nums">{{ formatMoneyline(bettingLine?.homeMoneyline) }}</span>
            </template>
            <template v-if="lineMoved">
              <span class="text-dimmed">Opened</span>
              <span class="text-right tabular-nums">{{ openAwayLabel ?? '—' }}</span>
              <span class="text-right tabular-nums">{{ openHomeLabel ?? '—' }}</span>
            </template>
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
