<script setup lang="ts">
import type { Game } from '#shared/types/schedule'
import { usePickProgress } from '~/composables/usePickProgress'
import { usePicksStorage } from '~/composables/usePicksStorage'

interface Props {
  weekNum: number
  season?: number
  games?: Game[]
}

const props = withDefaults(defineProps<Props>(), { season: 2026 })

const picks = usePicksStorage(props.season)
const { progressForWeek } = usePickProgress(props.season)

// If games are provided (filtered), calculate progress from those; otherwise use composable
const weekProgress = computed(() => {
  if (props.games !== undefined) {
    // Use provided games (already filtered by conference/team)
    const total = props.games.length
    const picked = props.games.filter(g => g.id in picks.value).length
    return { picked, total }
  }
  // Fallback to unfiltered week progress from composable
  return progressForWeek(props.weekNum).value
})

const percentage = computed(() => {
  if (weekProgress.value.total === 0) return 0
  return (weekProgress.value.picked / weekProgress.value.total) * 100
})
</script>

<template>
  <div class="relative w-full h-5 bg-muted rounded overflow-hidden shrink-0">
    <!-- Fill background (animates width) -->
    <div
      class="absolute top-0 left-0 h-full bg-primary transition-all duration-300 ease-out"
      :style="{ width: `${percentage}%` }"
    />
    <!-- Centered label -->
    <div class="absolute inset-0 flex items-center justify-center">
      <span class="text-xs font-semibold text-white">
        {{ weekProgress.picked }}/{{ weekProgress.total }} picked
      </span>
    </div>
  </div>
</template>
