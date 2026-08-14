<script setup lang="ts">
import type { Ref } from 'vue'
import type { Game, Team } from '#shared/types/schedule'
import { validateTeamContrast, applyContrastFilter } from '~/utils/teamContrast'

const props = defineProps<{
  game: Game
  teamsById: Map<number, Team>
  picks: Record<number, number>
}>()

// Detect light/dark mode for contrast validation
const colorMode = useColorMode()
const isDark = computed(() => colorMode.preference === 'dark' || (colorMode.preference === 'system' && colorMode.value === 'dark'))

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
const isPicked = computed(() => props.game.id in props.picks)
const pickedTeamId = computed(() => props.picks[props.game.id])
const pickedTeam = computed(() => {
  if (!isPicked.value) return null
  return pickedTeamId.value === props.game.homeId ? home.value : away.value
})

// Contrast validation for team colors
const homeContrast = computed(() =>
  validateTeamContrast(home.value?.color ?? '#000000', isDark.value ? 'dark' : 'light')
)
const awayContrast = computed(() =>
  validateTeamContrast(away.value?.color ?? '#000000', isDark.value ? 'dark' : 'light')
)

// Toggle pick: sets or clears the pick for this game
function togglePick(teamId: number) {
  if (pickedTeamId.value === teamId) {
    // Clear the pick
    delete props.picks[props.game.id]
  } else {
    // Set the pick to this team
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
    :ui="{ body: 'p-3 sm:p-3' }"
    :class="{
      'bg-white dark:bg-slate-900': isPicked
    }"
  >
    <!-- Away team row (clickable for picking) -->
    <div
      class="flex items-center gap-2 cursor-pointer user-select-none hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 py-1 transition-colors"
      :class="{
        'border-l-4': pickedTeamId === away.id
      }"
      :style="{
        ...(pickedTeamId === away.id ? {
          borderColor: away.color,
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
          class="w-4 h-4 text-green-600"
        />
        <div v-else class="w-4 h-4" />
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
          :title="away.school"
        >{{ away.school }}</span>
      </div>
    </div>

    <!-- @ separator -->
    <div class="text-center text-dimmed text-sm py-1">
      @
    </div>

    <!-- Home team row (clickable for picking) -->
    <div
      class="flex items-center gap-2 cursor-pointer user-select-none hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 py-1 transition-colors"
      :class="{
        'border-l-4': pickedTeamId === home?.id
      }"
      :style="{
        ...(pickedTeamId === home?.id ? {
          borderColor: home?.color,
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
          class="w-4 h-4 text-green-600"
        />
        <div v-else class="w-4 h-4" />
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
