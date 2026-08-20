<script setup lang="ts">
// `computed` is imported explicitly rather than relying on Nuxt's auto-import,
// so this component mounts under the plain vitest run (which registers no Nuxt
// auto-import plugin) — same pattern as StandingsTable.vue.
import { computed } from 'vue'
import type { Game } from '#shared/types/schedule'
import { usePickProgress } from '~/composables/usePickProgress'
import { usePicksStorage } from '~/composables/usePicksStorage'

interface Props {
  scenarioId: string
  weekNum: number
  season?: number
  games?: Game[]
}

const props = withDefaults(defineProps<Props>(), { season: 2026 })

const picks = usePicksStorage(props.scenarioId, props.season)
// WR-04: every current production caller is `PicksWorkspace.vue`, which
// always passes `props.games` (never `undefined`, even for an empty array),
// so the `usePickProgress` branch below is unreachable in the shipped app --
// it still stands up its own second `usePicksStorage`/`useGames` instance on
// every mount. Kept intentionally (not removed) as the fallback for a future
// caller that renders this badge without an already-filtered games array;
// `tests/components/PickProgressWeek.test.ts` mounts the component directly
// and exercises this exact branch in isolation, so it is not untested, only
// unreached via `PicksWorkspace.vue`.
const { progressForWeek } = usePickProgress(props.scenarioId, props.season)

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
  <div class="relative w-full h-5 bg-neutral-200 dark:bg-muted rounded overflow-hidden shrink-0">
    <!-- Fill background (animates width) -->
    <div
      class="absolute top-0 left-0 h-full bg-primary transition-all duration-300 ease-out"
      :style="{ width: `${percentage}%` }"
    />
    <!-- Centered label -->
    <div class="absolute inset-0 flex items-center justify-center">
      <span class="text-xs font-semibold text-default">
        {{ weekProgress.picked }}/{{ weekProgress.total }} picked
      </span>
    </div>
  </div>
</template>
