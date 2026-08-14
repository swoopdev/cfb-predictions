<script setup lang="ts">
import { usePickProgress } from '~/composables/usePickProgress'

interface Props {
  season?: number
}

const props = withDefaults(defineProps<Props>(), { season: 2026 })

const { progressOverall } = usePickProgress(props.season)

const percentage = computed(() => {
  if (progressOverall.value.total === 0) return 0
  return (progressOverall.value.picked / progressOverall.value.total) * 100
})
</script>

<template>
  <div class="relative w-full h-6 bg-muted rounded overflow-hidden">
    <!-- Fill background (animates width) -->
    <div
      class="absolute top-0 left-0 h-full bg-primary transition-all duration-300 ease-out"
      :style="{ width: `${percentage}%` }"
    />
    <!-- Centered label -->
    <div class="absolute inset-0 flex items-center justify-center">
      <span class="text-xs font-semibold text-white">
        {{ progressOverall.picked }}/{{ progressOverall.total }} picked
      </span>
    </div>
  </div>
</template>
