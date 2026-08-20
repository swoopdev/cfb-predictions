<script setup lang="ts">
defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{ click: [] }>()

function handleActivate() {
  emit('click')
}
</script>

<template>
  <UCard
    :ui="{
      root: 'bg-transparent ring-1 ring-default transition-colors',
      body: 'p-3 sm:p-3 h-full flex items-center justify-center'
    }"
    class="cursor-pointer min-h-34 h-full"
    :class="disabled
      ? 'opacity-50 pointer-events-none'
      : 'hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50'
    "
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-disabled="disabled"
    aria-label="Advance to next week"
    @click="handleActivate"
    @keydown.enter="handleActivate"
    @keydown.space.prevent="handleActivate"
  >
    <span class="flex items-center gap-2 font-semibold text-sm text-default">
      Advance Week
      <UIcon
        name="i-lucide-chevron-right"
        class="w-4 h-4"
      />
    </span>
  </UCard>
</template>
