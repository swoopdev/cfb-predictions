<script setup lang="ts">
// D-02: searchable multi-select over all 138 teams — D-11's numeric CFBD
// team id is the v-model value (value-key="id"), matching teams.json's id
// field directly. Multi-select (checkboxes) so several teams' games can be
// filtered in at once (e.g. Utah + Arizona), matching ConferenceFilter's
// multi-select pattern and styling.
const teamIds = defineModel<number[]>({ default: () => [] })
const { data: teams } = useTeams()

const label = computed(() => {
  if (teamIds.value.length === 0) return 'All teams'
  if (teamIds.value.length === 1) {
    return teams.value?.find(t => t.id === teamIds.value[0])?.school ?? 'All teams'
  }
  return `${teamIds.value.length} teams`
})
</script>

<template>
  <USelectMenu
    v-model="teamIds"
    multiple
    :items="teams ?? []"
    value-key="id"
    label-key="school"
    :placeholder="label"
    :search-input="{ placeholder: 'Search teams…' }"
    class="w-[45vw] max-w-44 sm:w-56 lg:w-64"
    :ui="{ content: 'min-w-[16rem]' }"
  >
    <template #default>
      {{ label }}
    </template>
    <template #content-top>
      <UButton
        label="Clear"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        block
        :disabled="teamIds.length === 0"
        class="justify-start"
        @click="teamIds = []"
      />
    </template>
    <template #item-leading="{ item }">
      <UCheckbox
        :model-value="teamIds.includes(item.id)"
        tabindex="-1"
        class="pointer-events-none"
      />
    </template>
    <template #empty>
      No teams found
    </template>
  </USelectMenu>
</template>
