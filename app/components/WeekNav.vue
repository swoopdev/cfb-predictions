<script setup lang="ts">
import { WEEKS, isWeekBoundary } from '~/utils/schedule'

// D-13: Prev/Next buttons plus a week-picker dropdown for direct jumps.
// This component is a dumb control — it never calls router.push itself.
// The page owns navigation (buildWeekQuery -> router.push), matching the
// ConferenceFilter/TeamFilter pattern of page-level query/route ownership.
const props = defineProps<{ week: number }>()
const emit = defineEmits<{ navigate: [week: number] }>()

const boundary = computed(() => isWeekBoundary(props.week))

// USelect needs a concrete v-model; reads the current week, writes emit a
// navigate event rather than mutating state directly.
const picked = computed<number>({
  get: () => props.week,
  set: value => emit('navigate', value)
})
</script>

<template>
  <div class="flex items-center gap-2">
    <UButton
      icon="i-lucide-chevron-left"
      size="lg"
      square
      color="neutral"
      variant="outline"
      aria-label="Previous week"
      :disabled="boundary.prevDisabled"
      @click="emit('navigate', week - 1)"
    />
    <USelect
      v-model="picked"
      :items="WEEKS"
      placeholder="Jump to week…"
    />
    <UButton
      icon="i-lucide-chevron-right"
      size="lg"
      square
      color="neutral"
      variant="outline"
      aria-label="Next week"
      :disabled="boundary.nextDisabled"
      @click="emit('navigate', week + 1)"
    />
  </div>
</template>
