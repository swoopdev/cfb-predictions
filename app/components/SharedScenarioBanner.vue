<script setup lang="ts">
import { computed } from 'vue'

/**
 * The three-variant share-link preview banner (SHARE-02/03/04, D-05/D-08/
 * D-11). Renders above `PicksWorkspace` whenever `useSharedPreview`'s
 * `bannerVariant` is not `'none'` -- unconditionally, per T-08-10: a share
 * link can never render without this banner alongside it.
 */
interface Props {
  variant: 'default' | 'mismatch' | 'malformed'
  appliedCount?: number
  totalCount?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'save-copy': []
  'dismiss': []
}>()

const COPY = {
  default: {
    icon: 'lucide:info',
    color: 'info',
    description: 'These picks aren\'t saved to your device yet.'
  },
  mismatch: {
    icon: 'lucide:triangle-alert',
    color: 'warning',
    description: 'This link was created for a different schedule version.'
  },
  malformed: {
    icon: 'lucide:circle-x',
    color: 'error',
    description: 'The share link is invalid or corrupted. Your own picks are unaffected.'
  }
} as const

const title = computed(() => {
  if (props.variant === 'mismatch') return `${props.appliedCount} of ${props.totalCount} picks applied`
  if (props.variant === 'malformed') return 'This link couldn\'t be read'
  return 'You\'re viewing a shared scenario'
})

const actions = computed(() => {
  if (props.variant === 'malformed') return undefined
  return [{ label: 'Save a copy', color: COPY[props.variant].color, onClick: () => emit('save-copy') }]
})
</script>

<template>
  <UAlert
    :title="title"
    :description="COPY[props.variant].description"
    :color="COPY[props.variant].color"
    :icon="COPY[props.variant].icon"
    :actions="actions"
    close
    @update:open="v => { if (!v) emit('dismiss') }"
  />
</template>
