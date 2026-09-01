<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

interface Props {
  title?: string
  description?: string
  button?: ButtonProps
  reverse?: boolean
}

withDefaults(defineProps<Props>(), {
  title: 'Lorem Ipsum Dolor Sit Amet',
  description: 'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  button: () => ({
    label: 'Learn More',
    color: 'primary',
    trailingIcon: 'i-lucide-arrow-right',
    to: '/get-started'
  }),
  reverse: false
})
</script>

<template>
  <UPageSection
    :title="title"
    :description="description"
    :links="button ? [button] : undefined"
    orientation="horizontal"
    :ui="{
      container: 'py-20 sm:py-20 lg:py-20',
      wrapper: reverse ? 'lg:order-last' : undefined
    }"
  >
    <slot />
  </UPageSection>
</template>
