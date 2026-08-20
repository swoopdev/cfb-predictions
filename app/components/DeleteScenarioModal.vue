<script setup lang="ts">
interface Props {
  open: boolean
  scenarioName: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [boolean]
  'confirm': []
}>()
</script>

<template>
  <UModal
    :open="props.open"
    :title="`Delete &quot;${props.scenarioName}&quot;?`"
    @update:open="v => emit('update:open', v)"
  >
    <template #body>
      <p class="text-sm">
        This permanently removes its picks, auto-fill history, and tiebreaker decisions. This can't be undone.
      </p>
    </template>
    <template #footer="{ close }">
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="close"
      />
      <UButton
        label="Delete scenario"
        color="error"
        @click="() => { emit('confirm'); close() }"
      />
    </template>
  </UModal>
</template>
