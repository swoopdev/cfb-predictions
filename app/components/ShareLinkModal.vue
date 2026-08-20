<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  open: boolean
  scenarioName: string
  shareUrl: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [boolean]
}>()

// D-13: on a successful clipboard write, the Copy Link button swaps to a
// "Copied!" confirmation state for ~2s then reverts -- mirrors GameCard.vue's
// checkmark-swap precedent. No error banner on failure; select-on-focus
// (handleFocus below) is the deliberate fallback instead.
const copied = ref(false)

async function handleCopyClick() {
  if (!navigator.clipboard) return
  try {
    await navigator.clipboard.writeText(props.shareUrl)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // clipboard write failed -- no error banner per D-13, selection-on-focus
    // below is the fallback
  }
}

function handleFocus(event: FocusEvent) {
  (event.target as HTMLInputElement).select()
}
</script>

<template>
  <UModal
    :open="props.open"
    :title="`Share &quot;${props.scenarioName}&quot;`"
    @update:open="v => emit('update:open', v)"
  >
    <template #body>
      <p class="text-sm">
        Anyone with this link can view these picks.
      </p>
      <UInput
        :model-value="props.shareUrl"
        readonly
        class="w-full mt-2"
        @focus="handleFocus"
      />
    </template>
    <template #footer>
      <UButton
        color="primary"
        variant="solid"
        :icon="copied ? 'lucide:check' : 'lucide:copy'"
        :label="copied ? 'Copied!' : 'Copy Link'"
        @click="handleCopyClick"
      />
    </template>
  </UModal>
</template>
