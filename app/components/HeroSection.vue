<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  highlight?: string
  description?: string
}>(), {
  title: 'Pick Every College Football Game',
  highlight: 'College Football',
  description: 'Most bracket tools guess at standings. This one runs each conference\'s actual published tiebreaker rules, so your predicted championship matchups are the real ones.'
})

const titleParts = computed(() => props.title.split(new RegExp(`(${props.highlight})`, 'i')))
</script>

<template>
  <UPageHero
    :description="description"
    :ui="{
      title: 'mx-auto text-4xl sm:text-7xl',
      container: 'pt-24 sm:pt-32 lg:pt-0 pb-24 sm:pb-32 lg:pb-40',
      wrapper: 'lg:sticky lg:top-(--ui-header-height) lg:z-0 lg:pt-35'
    }"
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
          label="Pick the Season"
          trailing-icon="i-lucide-arrow-right"
          size="xl"
          to="/week/1"
        />
        <UButton
          label="View Teams"
          trailing-icon="i-lucide-shield"
          size="xl"
          variant="subtle"
          color="neutral"
          to="/teams"
        />
      </div>
    </template>

    <NuxtLink
      to="/week/1"
      class="group relative z-20 block aspect-video overflow-hidden rounded-2xl border-2 border-primary shadow-2xl shadow-primary/20"
      aria-label="Start picking the season"
    >
      <UColorModeImage
        light="/lightPicks.png"
        dark="/darkPicks.png"
        alt="A preview of the picks board"
        class="size-full object-cover"
      />

      <div class="absolute inset-0 flex items-center justify-center">
        <span class="flex size-16 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform duration-300 group-hover:scale-110">
          <UIcon
            name="i-lucide-play"
            class="size-8 text-black translate-x-0.5"
          />
        </span>
      </div>
    </NuxtLink>
  </UPageHero>
</template>
