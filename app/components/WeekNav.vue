<script setup lang="ts">
import { WEEKS, isWeekBoundary, getAdjacentWeek } from '~/utils/schedule'

// D-13: Prev/Next buttons plus a week-picker dropdown for direct jumps.
// This component is a dumb control — it never calls router.push itself.
// The page owns navigation (buildWeekQuery -> router.push), matching the
// ConferenceFilter/TeamFilter pattern of page-level query/route ownership.
const props = defineProps<{ week: number }>()
const emit = defineEmits<{ navigate: [week: number] }>()

const boundary = computed(() => isWeekBoundary(props.week))

// Steps to the nearest NAVIGABLE neighbor in `WEEKS` (getAdjacentWeek)
// rather than by ±1, so this stays correct if `WEEKS` ever has another gap.
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
//
// WR-02: defensive fallback for any week not in `WEEKS` (e.g. a direct deep
// link to an out-of-range week). Without a matching item, USelect has
// nothing to bind `picked` to and the trigger renders as unselected.
// Synthesize a transient item so the picker always has something to
// display.
const weekItems = computed(() => {
  const items = WEEKS.map(w => ({ label: `Week ${w}`, value: w }))
  if (!WEEKS.includes(props.week)) {
    items.push({ label: `Week ${props.week}`, value: props.week })
    items.sort((a, b) => a.value - b.value)
  }
  return items
})

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
      class="w-32"
      :ui="{ content: 'min-w-[8rem]' }"
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
