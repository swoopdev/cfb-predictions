<script lang="ts">
// D-01's fixed literal ordering — "All" first, then the 4 power conferences
// in this order (SEC, Big Ten, Big 12, ACC), then the remaining 7
// alphabetically. NOT a full alphabetical sort of all 12 entries.
export const CONFERENCE_ITEMS = [
  'All',
  'SEC',
  'Big Ten',
  'Big 12',
  'ACC',
  'American Athletic',
  'Conference USA',
  'FBS Independents',
  'Mid-American',
  'Mountain West',
  'Pac-12',
  'Sun Belt'
]

// The 11 real conferences (excludes the "All" sentinel) — exported for
// sanitizeConfParam's known-value allowlist (Security Domain V5) so the
// list is declared once, not duplicated between the filter UI and the
// sanitizer.
export const KNOWN_CONFERENCES = CONFERENCE_ITEMS.slice(1)
</script>

<script setup lang="ts">
const conf = defineModel<string | undefined>()

// USelect needs a concrete selected item at all times; "All" is the
// in-component sentinel for "no conference filter" (conf === undefined).
const selected = computed<string>({
  get: () => conf.value ?? 'All',
  set: (value) => {
    conf.value = value === 'All' ? undefined : value
  }
})
</script>

<template>
  <USelect
    v-model="selected"
    :items="CONFERENCE_ITEMS"
    placeholder="All conferences"
  />
</template>
