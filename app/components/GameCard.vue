<script setup lang="ts">
import type { Game, Team } from '#shared/types/schedule'
import { validateTeamContrast, applyContrastFilter } from '~/utils/teamContrast'

const props = defineProps<{
  game: Game
  teamsById: Map<number, Team>
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
  color: '#000000', // Fallback for FCS teams
  mascot: null,
  abbreviation: null,
  conference: 'FCS',
  classification: null,
  alternateColor: '#000000'
} as Team)

// Pick state computations
const pickedTeamId = computed(() => props.picks[props.game.id])

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

// Toggle pick: sets or clears the pick for this game
function togglePick(teamId: number) {
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
      root: 'bg-slate-500',
      body: 'p-3 sm:p-3'
    }"
  >
    <!-- Away team row (clickable for picking) -->
    <div
      class="flex items-center gap-2 cursor-pointer user-select-none rounded px-2 py-2 transition-colors"
      :class="{
        'border-l-8': pickedTeamId === away.id,
        'hover:bg-gray-200': pickedTeamId !== away.id
      }"
      :style="{
        ...(pickedTeamId === away.id ? {
          borderColor: away.color,
          backgroundColor: away.alternateColor,
          ...applyContrastFilter(awayContrast)
        } : {})
      }"
      :tabindex="0"
      :aria-label="pickedTeamId === away.id
        ? `Clear pick: ${away.school}`
        : `Pick ${away.school} over ${home?.school}`
      "
      role="button"
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

      <!-- Team info -->
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <img
          :src="away.logo"
          class="size-8 shrink-0"
          alt=""
        >
        <span
          class="truncate text-sm"
          :style="{
            color: pickedTeamId === away.id ? awaySecondaryTextColor : undefined
          }"
          :class="{
            'text-black': pickedTeamId !== away.id
          }"
          :title="away.school"
        >{{ away.school }}</span>
      </div>
    </div>

    <!-- @ separator -->
    <div class="text-center text-dimmed text-sm py-2 px-2">
      @
    </div>

    <!-- Home team row (clickable for picking) -->
    <div
      class="flex items-center gap-2 cursor-pointer user-select-none rounded px-2 py-2 transition-colors"
      :class="{
        'border-l-8': pickedTeamId === home?.id,
        'hover:bg-gray-200': pickedTeamId !== home?.id
      }"
      :style="{
        ...(pickedTeamId === home?.id ? {
          borderColor: home?.color,
          backgroundColor: home?.alternateColor,
          ...applyContrastFilter(homeContrast)
        } : {})
      }"
      :tabindex="0"
      :aria-label="pickedTeamId === home?.id
        ? `Clear pick: ${home?.school}`
        : `Pick ${home?.school} over ${away.school}`
      "
      role="button"
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

      <!-- Team info -->
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <img
          :src="home?.logo"
          class="size-8 shrink-0"
          alt=""
        >
        <span
          class="truncate text-sm"
          :style="{
            color: pickedTeamId === home?.id ? homeSecondaryTextColor : undefined
          }"
          :class="{
            'text-black': pickedTeamId !== home?.id
          }"
          :title="home?.school"
        >{{ home?.school }}</span>
      </div>
    </div>

    <!-- Badges section (neutral site, conference game) -->
    <div
      v-if="game.neutralSite || game.conferenceGame"
      class="flex gap-1 mt-2"
    >
      <UBadge
        v-if="game.neutralSite"
        color="neutral"
        variant="subtle"
        label="Neutral site"
      />
      <UBadge
        v-if="game.conferenceGame"
        color="primary"
        variant="subtle"
        label="Conference game"
      />
    </div>
  </UCard>
</template>
