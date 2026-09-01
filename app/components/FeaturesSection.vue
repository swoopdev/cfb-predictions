<script setup lang="ts">
interface Feature {
  title: string
  description: string
  icon?: string
}

interface Props {
  title?: string
  description?: string
  items?: Feature[]
  centerLastRow?: boolean
}

withDefaults(defineProps<Props>(), {
  title: 'Lorem Ipsum Dolor Sit Amet',
  description: 'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  centerLastRow: false,
  items: () => [
    {
      title: 'Lorem Ipsum Dolor',
      description: 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam.',
      icon: 'i-lucide-map-pin'
    },
    {
      title: 'Ut Enim Ad Minim',
      description: 'Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute.',
      icon: 'i-lucide-phone'
    },
    {
      title: 'Duis Aute Irure',
      description: 'Dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
      icon: 'i-lucide-image'
    },
    {
      title: 'Excepteur Sint Occaecat',
      description: 'Cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
      icon: 'i-lucide-map'
    },
    {
      title: 'Sed Ut Perspiciatis',
      description: 'Unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem.',
      icon: 'i-lucide-target'
    },
    {
      title: 'Nemo Enim Ipsam',
      description: 'Voluptatem quia voluptas sit aspernatur aut odit aut fugit sed quia consequuntur magni.',
      icon: 'i-lucide-search'
    }
  ]
})
</script>

<template>
  <UPageSection
    :title="title"
    :description="description"
    :ui="{ container: 'py-20 sm:py-20 lg:py-20' }"
  >
    <div
      v-if="centerLastRow"
      class="flex flex-wrap justify-center gap-8"
    >
      <UPageCard
        v-for="(item, index) in items"
        :key="index"
        v-bind="item"

        class="w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.334rem)]"
      />
    </div>
    <UPageGrid v-else>
      <UPageCard
        v-for="(item, index) in items"
        :key="index"
        v-bind="item"
      />
    </UPageGrid>
  </UPageSection>
</template>
