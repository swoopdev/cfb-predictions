<script setup lang="ts">
import { usePickProgress } from '~/composables/usePickProgress'

interface Props {
  weekNum: number
  season?: number
}

const props = withDefaults(defineProps<Props>(), { season: 2026 })

const { progressForWeek } = usePickProgress(props.season)
const weekProgress = progressForWeek(props.weekNum)
</script>

<template>
  <div class="text-sm text-slate-700 dark:text-slate-300">
    {{ weekProgress.picked }}/{{ weekProgress.total }} picked
  </div>
</template>
