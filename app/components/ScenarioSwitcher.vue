<script setup lang="ts">
// `ref`/`watch` are imported explicitly rather than relying on Nuxt's
// auto-import, so this component mounts under the plain vitest run (which
// registers no Nuxt auto-import plugin) -- same convention as
// PickProgress.vue.
import { ref, watch } from 'vue'
import type { ScenarioMeta } from '#shared/types/scenarios'

// WR-01: mirrors `useScenarios.ts`'s `MAX_SCENARIO_NAME_LENGTH` -- kept as a
// separate constant (not imported) since this is the UI-side input cap, and
// the composable's copy is the untrusted-storage-boundary cap; the two are
// allowed to drift only if a future UI wants a tighter typing limit than the
// storage ceiling, which is not the case today.
const MAX_SCENARIO_NAME_LENGTH = 60

interface Props {
  scenarios: ScenarioMeta[]
  modelValue: string
  /**
   * WR-02: id of a just-created/just-duplicated scenario that should
   * immediately enter inline rename edit state (07-CONTEXT.md D-11,
   * 07-UI-SPEC.md's duplicate-affordance row). `null`/`undefined` means no
   * row is pending auto-edit. The page sets this right after `create`/
   * `duplicate` resolves; this component never clears it back -- a stale
   * value simply never re-fires the watcher below since it only reacts to
   * CHANGES, and a fresh id from a subsequent create/duplicate always
   * differs (crypto.randomUUID()).
   */
  pendingEditId?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [id: string]
  'rename': [id: string, name: string]
  'duplicate': [id: string]
  'share': [id: string]
  'delete': [id: string]
  'create': []
}>()

// Which row (by scenario id) is currently showing its inline rename input,
// `null` when no row is being edited -- a single ref is enough since only
// one row can be in edit state at a time.
const editingId = ref<string | null>(null)
const editValue = ref('')

function startRename(item: ScenarioMeta) {
  editingId.value = item.id
  editValue.value = item.name
}

function commitRename(id: string) {
  // Guards a stray blur firing right after Enter has already committed and
  // reset editingId -- without this a rename can double-emit.
  if (editingId.value !== id) return
  // WR-01: an empty/whitespace-only commit is dropped entirely (no emit) --
  // leaves the row showing its pre-edit name rather than persisting a blank
  // label. `useScenarios.ts`'s `renameScenario` also guards defensively, but
  // rejecting here means the emit never fires for an obviously-invalid value.
  const trimmed = editValue.value.trim()
  if (trimmed.length > 0) emit('rename', id, trimmed.slice(0, MAX_SCENARIO_NAME_LENGTH))
  editingId.value = null
}

function cancelRename() {
  editingId.value = null
}

// WR-02: entering edit mode for a freshly-created/duplicated row happens
// here rather than in `startRename` (which stays the pencil-icon's own
// handler) -- `pendingEditId` is a distinct trigger path, and reusing
// `startRename` keeps both paths' "set editingId + seed editValue" logic in
// one place. Only fires when `pendingEditId` actually CHANGES, so it can't
// re-trigger on an unrelated re-render.
watch(
  () => props.pendingEditId,
  (id) => {
    if (!id) return
    const item = props.scenarios.find(s => s.id === id)
    if (item) startRename(item)
  }
)
</script>

<template>
  <div class="flex min-w-0 items-center gap-2">
    <USelectMenu
      :items="props.scenarios"
      :model-value="props.modelValue"
      value-key="id"
      label-key="name"
      :ui="{
        base: 'min-w-0 w-44 sm:w-56',
        content: 'w-max min-w-(--reka-combobox-trigger-width) max-w-[calc(100vw-2rem)]',
        item: 'gap-2'
      }"
      @update:model-value="v => emit('update:modelValue', v)"
    >
      <template #leading>
        <UIcon name="lucide:layers" />
      </template>

      <template #item-label="{ item }">
        <input
          v-if="editingId === item.id"
          v-model="editValue"
          class="w-full min-w-0 bg-transparent text-sm outline-none"
          :maxlength="MAX_SCENARIO_NAME_LENGTH"
          @click.stop
          @keydown.enter="commitRename(item.id)"
          @keydown.escape="cancelRename"
          @blur="commitRename(item.id)"
        >
        <span
          v-else
          class="block min-w-0 truncate pr-2"
        >{{ item.name }}</span>
      </template>

      <template #item-trailing="{ item }">
        <span class="flex shrink-0 items-center gap-0.5">
          <UButton
            icon="lucide:pencil"
            size="xs"
            color="neutral"
            variant="ghost"
            class="size-6 shrink-0"
            :aria-label="`Rename ${item.name}`"
            @click.stop="startRename(item)"
          />
          <UButton
            icon="lucide:copy"
            size="xs"
            color="neutral"
            variant="ghost"
            class="size-6 shrink-0"
            :aria-label="`Duplicate ${item.name}`"
            @click.stop="emit('duplicate', item.id)"
          />
          <UButton
            icon="lucide:share-2"
            size="xs"
            color="neutral"
            variant="ghost"
            class="size-6 shrink-0"
            :aria-label="`Share ${item.name}`"
            @click.stop="emit('share', item.id)"
          />
          <UButton
            icon="lucide:trash-2"
            size="xs"
            color="error"
            variant="ghost"
            class="size-6 shrink-0"
            :aria-label="`Delete ${item.name}`"
            :disabled="props.scenarios.length <= 1"
            :title="props.scenarios.length <= 1 ? 'At least one scenario is required' : undefined"
            @click.stop="emit('delete', item.id)"
          />
        </span>
      </template>
    </USelectMenu>

    <UButton
      icon="lucide:plus"
      color="primary"
      variant="ghost"
      class="shrink-0"
      aria-label="+ New Scenario"
      @click="emit('create')"
    >
      <!-- Label text is the Copywriting Contract's exact string; it is only
           visually collapsed to the icon on narrow viewports, where the
           header stacks and horizontal room is scarce. -->
      <span class="hidden sm:inline">+ New Scenario</span>
    </UButton>
  </div>
</template>
