<script lang="ts">
export interface ConferenceItem {
  label: string
  value: string
}

// D-01's fixed literal ordering — "All" first, then the 4 power conferences
// in this order (SEC, Big Ten, Big 12, ACC), then the remaining 7
// alphabetically. NOT a full alphabetical sort of all 12 entries.
//
// UAT round 2: the "All" entry's `value` stays the literal sentinel `'All'`
// (KNOWN_CONFERENCES/sanitizeConfParam/URL query values all key off that
// exact string) — only its `label` was renamed to "All conferences" for
// display. Every other item's `label` intentionally equals its `value`.
export const CONFERENCE_ITEMS: ConferenceItem[] = [
  { label: 'All conferences', value: 'All' },
  { label: 'SEC', value: 'SEC' },
  { label: 'Big Ten', value: 'Big Ten' },
  { label: 'Big 12', value: 'Big 12' },
  { label: 'ACC', value: 'ACC' },
  { label: 'American Athletic', value: 'American Athletic' },
  { label: 'Conference USA', value: 'Conference USA' },
  { label: 'FBS Independents', value: 'FBS Independents' },
  { label: 'Mid-American', value: 'Mid-American' },
  { label: 'Mountain West', value: 'Mountain West' },
  { label: 'Pac-12', value: 'Pac-12' },
  { label: 'Sun Belt', value: 'Sun Belt' }
]

// The 11 real conference VALUES (excludes the "All" sentinel) — exported for
// sanitizeConfParam's known-value allowlist (Security Domain V5) so the
// list is declared once, not duplicated between the filter UI and the
// sanitizer. Stays a plain string[] (unaffected by the label/value split
// above) since it's compared directly against the raw `?conf=` query value.
export const KNOWN_CONFERENCES = CONFERENCE_ITEMS.slice(1).map(item => item.value)
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
    value-key="value"
    label-key="label"
    placeholder="All conferences"
    class="w-56 sm:w-64"
    :ui="{ content: 'min-w-[16rem]' }"
  />
</template>
