<script setup lang="ts">
// `ref`/`watch`/`nextTick` are imported explicitly rather than relying on
// Nuxt's auto-import, so this component mounts under the plain vitest run
// (which registers no Nuxt auto-import plugin) -- same convention as
// PickProgress.vue.
import { nextTick, ref, watch } from 'vue'
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

// Only ever one rename input exists at a time (see `editingId` above), so a
// single template ref is enough to focus it.
const renameInput = ref<HTMLInputElement | null>(null)

function startRename(item: ScenarioMeta) {
  editingId.value = item.id
  editValue.value = item.name
  // The input does not exist until the re-render that `editingId` triggers,
  // so focusing has to wait a tick. Selecting the existing text too means
  // typing replaces the old name outright, which is the common case when
  // renaming a freshly created "Scenario 2".
  void nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
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
// `startRename` keeps both paths' "set editingId + seed editValue + focus"
// logic in one place. Only fires when `pendingEditId` actually CHANGES, so it
// can't re-trigger on an unrelated re-render.
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
  <div class="flex min-w-0 items-center gap-2 py-3">
    <USelectMenu
      :items="props.scenarios"
      :model-value="props.modelValue"
      value-key="id"
      label-key="name"
      :ui="{
        base: 'min-w-0 w-full sm:w-64',
        content: 'w-max min-w-(--reka-combobox-trigger-width) max-w-[calc(100vw-2rem)]',
        // `items-start` is Nuxt UI's own item default (it exists for rows with
        // a description line underneath). These rows are a single line of text
        // between two icon columns, so they centre instead -- without this the
        // leading check and the action buttons sit high against the label.
        item: 'items-center gap-2 py-1.5 data-[state=checked]:before:bg-elevated data-[state=checked]:text-highlighted data-[state=checked]:font-medium',
        itemLeadingIcon: 'size-4',
        // Nuxt UI renders its own selected-state check through
        // `ComboboxItemIndicator`, AFTER the `#item-trailing` slot and outside
        // any slot this component can override -- so it lands at the far end
        // of the row, past the edit/duplicate/share/delete buttons. The
        // selected marker belongs at the FRONT of the row (see
        // `#item-leading`), so the built-in one is hidden rather than
        // duplicated.
        itemTrailingIcon: 'hidden'
      }"
      @update:model-value="v => emit('update:modelValue', v)"
    >
      <template #leading>
        <UIcon
          name="lucide:layers"
          class="size-4 shrink-0"
        />
      </template>

      <!-- Selected marker at the FRONT of the row. A marker renders for every
           row (a faint ring when unselected) rather than only the selected
           one, so every name starts on the same column instead of shifting
           when the selection moves. -->
      <template #item-leading="{ item }">
        <UIcon
          :name="item.id === props.modelValue ? 'lucide:circle-check' : 'lucide:circle'"
          class="size-4 shrink-0"
          :class="item.id === props.modelValue ? 'text-primary' : 'text-dimmed/40'"
        />
      </template>

      <template #item-label="{ item }">
        <input
          v-if="editingId === item.id"
          ref="renameInput"
          v-model="editValue"
          class="w-full min-w-0 bg-transparent text-sm leading-5 outline-none"
          :maxlength="MAX_SCENARIO_NAME_LENGTH"
          @click.stop
          @keydown.enter="commitRename(item.id)"
          @keydown.escape="cancelRename"
          @blur="commitRename(item.id)"
          @keydown.space.stop
          @keydown.down.stop
          @keydown.up.stop
        >
        <span
          v-else
          class="block min-w-0 truncate text-sm leading-5"
        >{{ item.name }}</span>
      </template>

      <template #item-trailing="{ item }">
        <span class="flex shrink-0 items-center gap-0.5">
          <UButton
            icon="lucide:pencil"
            size="xs"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'size-6 shrink-0 p-0 justify-center items-center' }"
            :aria-label="`Rename ${item.name}`"
            @click.stop="startRename(item)"
          />
          <UButton
            icon="lucide:copy"
            size="xs"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'size-6 shrink-0 p-0 justify-center items-center' }"
            :aria-label="`Duplicate ${item.name}`"
            @click.stop="emit('duplicate', item.id)"
          />
          <UButton
            icon="lucide:share-2"
            size="xs"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'size-6 shrink-0 p-0 justify-center items-center' }"
            :aria-label="`Share ${item.name}`"
            @click.stop="emit('share', item.id)"
          />
          <UButton
            icon="lucide:trash-2"
            size="xs"
            color="error"
            variant="ghost"
            :ui="{ base: 'size-6 shrink-0 p-0 justify-center items-center' }"
            :aria-label="`Delete ${item.name}`"
            :disabled="props.scenarios.length <= 1"
            :title="props.scenarios.length <= 1 ? 'At least one scenario is required' : undefined"
            @click.stop="emit('delete', item.id)"
          />
        </span>
      </template>
    </USelectMenu>

    <!-- Icon-only: the picker beside it already establishes that this row is
         about scenarios, so a "+ New Scenario" label rendered next to the plus
         glyph read as "+ + New Scenario". The name still reaches assistive
         tech through `aria-label`. -->
    <UButton
      icon="lucide:plus"
      color="primary"
      variant="ghost"
      :ui="{ base: 'size-8 shrink-0 p-0 justify-center items-center' }"
      aria-label="New Scenario"
      title="New Scenario"
      @click="emit('create')"
    />
  </div>
</template>
