<script setup lang="ts">
import { ref } from 'vue'
import type { Team } from '#shared/types/schedule'

/**
 * The projected top 25, reorderable: drag a row, or use its up/down
 * buttons (keyboard and touch friendly). Emits the full new order; the
 * parent stores it as the scenario's ranking override.
 */
const props = defineProps<{
  order: readonly number[]
  teamsById: Map<number, Team>
  /** Seed per team in the resulting field, for the "in the field" marker. */
  seedByTeam: Map<number, number>
  autoBidByTeam: Map<number, string>
  /** Record per team, under the scenario. */
  recordByTeam?: Map<number, string>
  modified: boolean
}>()

const emit = defineEmits<{ update: [order: number[]], reset: [] }>()

const dragIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)

function move(from: number, to: number) {
  if (to < 0 || to >= props.order.length || from === to) return
  const next = [...props.order]
  const [id] = next.splice(from, 1)
  next.splice(to, 0, id!)
  emit('update', next)
}

function onDrop(index: number) {
  if (dragIndex.value !== null) move(dragIndex.value, index)
  dragIndex.value = null
  overIndex.value = null
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between gap-3">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-toned">
        Projected ranking
      </h3>
      <UButton
        v-if="modified"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-rotate-ccw"
        @click="emit('reset')"
      >
        Reset to model
      </UButton>
    </div>
    <ol class="divide-y divide-default overflow-hidden rounded-lg border border-default">
      <li
        v-for="(id, i) in order"
        :key="id"
        draggable="true"
        class="flex items-center gap-2 bg-default px-2 py-1.5 text-sm"
        :class="{
          'opacity-50': dragIndex === i,
          'ring-2 ring-inset ring-primary': overIndex === i && dragIndex !== i
        }"
        @dragstart="dragIndex = i"
        @dragover.prevent="overIndex = i"
        @dragleave="overIndex = overIndex === i ? null : overIndex"
        @drop.prevent="onDrop(i)"
        @dragend="dragIndex = null; overIndex = null"
      >
        <UIcon
          name="i-lucide-grip-vertical"
          class="size-4 shrink-0 cursor-grab text-muted"
        />
        <span class="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{{ i + 1 }}</span>
        <img
          :src="teamsById.get(id)?.logo ?? '/logos/placeholder.svg'"
          alt=""
          class="size-5 shrink-0 object-contain"
        >
        <span class="min-w-0 flex-1 truncate text-highlighted">
          {{ teamsById.get(id)?.school ?? id }}
          <span
            v-if="recordByTeam?.get(id)"
            class="text-xs text-muted"
          >{{ recordByTeam.get(id) }}</span>
        </span>
        <UBadge
          v-if="seedByTeam.has(id)"
          :color="autoBidByTeam.has(id) ? 'primary' : 'neutral'"
          variant="subtle"
          size="sm"
          :title="autoBidByTeam.get(id)"
        >
          Seed {{ seedByTeam.get(id) }}{{ autoBidByTeam.has(id) ? ' · auto' : '' }}
        </UBadge>
        <div class="flex shrink-0">
          <UButton
            icon="i-lucide-chevron-up"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="i === 0"
            :aria-label="`Move ${teamsById.get(id)?.school ?? 'team'} up`"
            @click="move(i, i - 1)"
          />
          <UButton
            icon="i-lucide-chevron-down"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="i === order.length - 1"
            :aria-label="`Move ${teamsById.get(id)?.school ?? 'team'} down`"
            @click="move(i, i + 1)"
          />
        </div>
      </li>
    </ol>
  </div>
</template>
