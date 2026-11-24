<script setup lang="ts">
import type { ScenarioMeta } from '#shared/types/scenarios'

/**
 * Shared top bar for the title-race and playoff pages: brand, section
 * links, the scenario these pages are reading (switching it here switches
 * the active scenario everywhere, the same pointer the picks page uses),
 * and the color-mode toggle.
 */
const props = defineProps<{
  scenarios: ScenarioMeta[]
  modelValue: string
}>()

const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const route = useRoute()

const links = [
  { label: 'Pick games', to: '/week/1', icon: 'i-lucide-calendar-check', match: '/week' },
  { label: 'Title races', to: '/conference/sec', icon: 'i-lucide-trophy', match: '/conference' },
  { label: 'Playoff', to: '/playoff', icon: 'i-lucide-git-fork', match: '/playoff' }
]
</script>

<template>
  <div class="flex flex-col gap-3 border-b border-default pb-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center justify-between gap-4">
      <BrandMark />
      <UColorModeButton class="sm:hidden" />
    </div>
    <nav
      class="flex flex-wrap items-center gap-1"
      aria-label="Sections"
    >
      <UButton
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        :icon="link.icon"
        size="sm"
        :color="route.path.startsWith(link.match) ? 'primary' : 'neutral'"
        :variant="route.path.startsWith(link.match) ? 'soft' : 'ghost'"
      >
        {{ link.label }}
      </UButton>
    </nav>
    <div class="flex items-center gap-2">
      <USelectMenu
        :items="props.scenarios"
        :model-value="props.modelValue"
        value-key="id"
        label-key="name"
        :search-input="false"
        icon="i-lucide-layers"
        size="sm"
        class="w-full sm:w-52"
        aria-label="Scenario"
        @update:model-value="(v: string) => emit('update:modelValue', v)"
      />
      <UColorModeButton class="hidden sm:inline-flex" />
    </div>
  </div>
</template>
