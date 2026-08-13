<script setup lang="ts">
import { WEEKS, isWeekBoundary, getAdjacentWeek } from '~/utils/schedule'

// D-13: Prev/Next buttons plus a week-picker dropdown for direct jumps.
// This component is a dumb control — it never calls router.push itself.
// The page owns navigation (buildWeekQuery -> router.push), matching the
// ConferenceFilter/TeamFilter pattern of page-level query/route ownership.
const props = defineProps<{ week: number }>()
const emit = defineEmits<{ navigate: [week: number] }>()

const boundary = computed(() => isWeekBoundary(props.week))

// Post-D-15: week 14 was removed from `WEEKS` entirely, so Prev/Next must
// jump to the nearest NAVIGABLE neighbor (getAdjacentWeek) rather than
// stepping by ±1, which would land on the now-unreachable week 14.
function goPrev() {
  emit('navigate', getAdjacentWeek(props.week, 'prev'))
}
function goNext() {
  emit('navigate', getAdjacentWeek(props.week, 'next'))
}

// USelect item objects give both the closed trigger and each open dropdown
// row a visible "Week N" label (object items with a `label`/`value` shape
// use USelect's default `label-key`/`value-key`, so no extra props needed
// beyond passing them explicitly for clarity).
const weekItems = computed(() => WEEKS.map(w => ({ label: `Week ${w}`, value: w })))

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
      @click="goPrev"
    />
    <USelect
      v-model="picked"
      :items="weekItems"
      value-key="value"
      label-key="label"
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
      @click="goNext"
    />
  </div>
</template>
