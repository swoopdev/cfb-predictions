<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

const props = withDefaults(defineProps<{
  title?: string
  highlight?: string
  description?: string
  links?: ButtonProps[]
}>(), {
  title: 'Predict every Saturday of the season',
  highlight: 'every Saturday',
  description: 'Pick the winner of every FBS game. Standings, tiebreakers, and championship matchups recompute instantly as you go.',
  links: () => [
    {
      label: 'Predict the Season',
      trailingIcon: 'i-lucide-arrow-right',
      to: '/week/1'
    }
  ]
})

const titleParts = computed(() => props.title.split(new RegExp(`(${props.highlight})`, 'i')))
</script>

<template>
  <UPageHero
    :description="description"
    :ui="{ title: 'max-w-5xl mx-auto text-4xl sm:text-7xl' }"
  >
    <template #title>
      <template
        v-for="(part, index) in titleParts"
        :key="index"
      >
        <span
          v-if="part.toLowerCase() === highlight.toLowerCase()"
          class="text-primary"
        >{{ part }}</span><template v-else>
          {{ part }}
        </template>
      </template>
    </template>

    <template #footer>
      <div class="flex flex-wrap items-center justify-center gap-3">
        <UButton
          v-for="(link, index) in links"
          :key="index"
          size="xl"
          v-bind="link"
        />
      </div>
    </template>
  </UPageHero>
</template>
