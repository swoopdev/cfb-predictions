<script setup lang="ts">
// `ref`/`watch` are imported explicitly rather than relying on Nuxt's
// auto-import, so this component mounts under the plain vitest run (which
// registers no Nuxt auto-import plugin) -- same convention as
// PickProgress.vue.
import { computed, ref, watch } from 'vue'
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

// The segment starts collapsed: picking games is the page's job, and
// managing scenarios is an occasional detour. Collapsed still names the
// active scenario, so the user never has to expand it just to confirm which
// set of picks is on screen.
const expanded = ref(false)

const activeName = computed(() =>
  props.scenarios.find(s => s.id === props.modelValue)?.name ?? ''
)

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
    if (!item) return
    // The rename input lives inside the collapsible segment, so a
    // create/duplicate that lands "immediately editable inline" must force
    // the segment open -- otherwise the edit state would be set on a row
    // the user cannot see.
    expanded.value = true
    startRename(item)
  }
)
</script>

<template>
  <div class="min-w-0">
    <!-- Collapsed summary line: on mobile this is all the segment costs,
         and it still names the active scenario so the user never has to
         expand it just to see which picks they are looking at. -->
    <button
      type="button"
      class="flex w-full min-w-0 items-center gap-2 py-2 text-left text-sm text-muted hover:text-default"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <UIcon
        name="lucide:chevron-right"
        class="size-4 shrink-0 transition-transform"
        :class="expanded ? 'rotate-90' : ''"
      />
      <span class="shrink-0 font-medium">Scenarios</span>
      <span
        v-if="!expanded"
        class="min-w-0 truncate text-dimmed"
      >· {{ activeName }}</span>
    </button>

    <div
      v-if="expanded"
      class="flex min-w-0 items-center gap-2 pb-3"
    >
      <USelectMenu
        :items="props.scenarios"
        :model-value="props.modelValue"
        value-key="id"
        label-key="name"
        :ui="{
          base: 'min-w-0 flex-1 sm:flex-none sm:w-64',
          content: 'w-max min-w-(--reka-combobox-trigger-width) max-w-[calc(100vw-2rem)]',
          item: 'gap-2 data-[state=checked]:before:bg-elevated data-[state=checked]:text-highlighted data-[state=checked]:font-medium'
        }"
        @update:model-value="v => emit('update:modelValue', v)"
      >
        <template #leading>
          <UIcon name="lucide:layers" />
        </template>

        <!-- Selected marker at the FRONT of the row, not beside the row
             actions -- Nuxt UI's own default check renders in
             `#item-trailing`, which this component overrides with the
             rename/duplicate/share/delete buttons. A fixed-width slot keeps
             every name left-aligned on the same column whether or not the
             row is the selected one. -->
        <template #item-leading="{ item }">
          <UIcon
            :name="item.id === props.modelValue ? 'lucide:check' : 'lucide:circle'"
            class="size-4 shrink-0"
            :class="item.id === props.modelValue ? 'text-primary' : 'text-dimmed/30'"
          />
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

      <!-- Icon-only: the enclosing "Scenarios" segment already supplies the
           noun, so a "+ New Scenario" label would read as "+ + New
           Scenario" next to the plus glyph. The name still reaches assistive
           tech through `aria-label`. -->
      <UButton
        icon="lucide:plus"
        color="primary"
        variant="ghost"
        class="shrink-0"
        aria-label="New Scenario"
        title="New Scenario"
        @click="emit('create')"
      />
    </div>
  </div>
</template>
