<script setup lang="ts">
// D-02: searchable combobox (type-ahead) over all 138 teams — D-11's
// numeric CFBD team id is the v-model value (value-key="id"), matching
// teams.json's id field directly.
const teamId = defineModel<number | undefined>()
const { data: teams } = useTeams()
</script>

<template>
  <UInputMenu
    v-model="teamId"
    :items="teams ?? []"
    value-key="id"
    label-key="school"
    placeholder="Search teams…"
  >
    <template #empty>
      No teams found
    </template>
  </UInputMenu>
</template>
