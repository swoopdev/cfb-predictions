<script setup lang="ts">
import { usePickProgress } from '~/composables/usePickProgress'

interface Props {
  season?: number
}

const props = withDefaults(defineProps<Props>(), { season: 2026 })

const { progressOverall } = usePickProgress(props.season)
</script>

<template>
  <div class="text-sm text-slate-700 dark:text-slate-300">
    {{ progressOverall.picked }}/{{ progressOverall.total }} picked
  </div>
</template>
