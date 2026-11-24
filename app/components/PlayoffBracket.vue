<script setup lang="ts">
import { computed } from 'vue'
import type { Team } from '#shared/types/schedule'
import type { BracketRound, BracketSlotDef, PlayoffFormat } from '#shared/domain/playoff/formats'
import type { ResolvedSlot } from '#shared/domain/playoff/bracket'
import { bracketChampion } from '#shared/domain/playoff/bracket'

/**
 * A pickable CFP bracket. Columns are rounds; within a column, games are
 * ordered the way the tree feeds them (depth-first from the final), so each
 * game sits level with the games that feed it. Clicking a team advances it;
 * clicking it again clears the pick. Real, final results lock their slot.
 */
const props = withDefaults(defineProps<{
  format: PlayoffFormat
  slots: readonly ResolvedSlot[]
  teamsById: Map<number, Team>
  editable?: boolean
}>(), { editable: true })

const emit = defineEmits<{ pick: [slotId: string, teamId: number | null] }>()

const byId = computed(() => new Map(props.slots.map(s => [s.def.id, s])))

/** Slot ids per round, in tree order. */
const columns = computed(() => {
  const defs = new Map(props.format.slots.map(d => [d.id, d]))
  const order = new Map<BracketRound, string[]>()
  const visit = (def: BracketSlotDef) => {
    const list = order.get(def.round) ?? []
    list.push(def.id)
    order.set(def.round, list)
    for (const source of [def.top, def.bottom]) {
      if ('winnerOf' in source) {
        const child = defs.get(source.winnerOf)
        if (child) visit(child)
      }
    }
  }
  const final = props.format.slots.find(d => d.round === 'final')
  if (final) visit(final)
  return props.format.rounds.map(r => ({ round: r, ids: order.get(r.id) ?? [] }))
})

const champion = computed(() => {
  const id = bracketChampion(props.slots)
  return id === null ? undefined : props.teamsById.get(id)
})

const team = (id: number | null) => (id === null ? undefined : props.teamsById.get(id))

function canPick(slot: ResolvedSlot) {
  return props.editable && slot.winnerSource !== 'result' && slot.top !== null && slot.bottom !== null
}

function choose(slot: ResolvedSlot, teamId: number | null) {
  if (!canPick(slot) || teamId === null) return
  emit('pick', slot.def.id, slot.winner === teamId ? null : teamId)
}

function sides(slot: ResolvedSlot) {
  return [
    { id: slot.top, seed: slot.topSeed, score: slot.score?.top, label: slot.def.topHosts ? 'home' : '' },
    { id: slot.bottom, seed: slot.bottomSeed, score: slot.score?.bottom, label: '' }
  ]
}
</script>

<template>
  <div class="overflow-x-auto pb-2">
    <div class="grid min-w-[880px] grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,0.8fr)] gap-4">
      <div
        v-for="col in columns"
        :key="col.round.id"
        class="flex flex-col"
      >
        <div class="mb-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-toned">
            {{ col.round.label }}
          </div>
          <div class="text-[11px] text-muted">
            {{ col.round.dates }}
          </div>
        </div>
        <div class="flex flex-1 flex-col justify-around gap-3">
          <div
            v-for="id in col.ids"
            :key="id"
            class="overflow-hidden rounded-md border border-default bg-default"
          >
            <template v-if="byId.get(id)">
              <button
                v-for="(side, si) in sides(byId.get(id)!)"
                :key="si"
                type="button"
                class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors"
                :class="[
                  si === 0 ? 'border-b border-default' : '',
                  canPick(byId.get(id)!) ? 'hover:bg-elevated/70 focus-visible:outline-2 focus-visible:outline-primary' : 'cursor-default',
                  byId.get(id)!.winner !== null && byId.get(id)!.winner === side.id ? 'bg-elevated font-semibold text-highlighted' : '',
                  byId.get(id)!.winner !== null && byId.get(id)!.winner !== side.id ? 'text-dimmed' : ''
                ]"
                :style="byId.get(id)!.winner !== null && byId.get(id)!.winner === side.id ? { boxShadow: `inset 3px 0 0 ${team(side.id)?.color ?? 'currentColor'}` } : undefined"
                :disabled="!canPick(byId.get(id)!)"
                :aria-pressed="byId.get(id)!.winner === side.id"
                @click="choose(byId.get(id)!, side.id)"
              >
                <span class="w-4 shrink-0 text-right text-xs tabular-nums text-muted">{{ side.seed ?? '' }}</span>
                <template v-if="side.id !== null">
                  <img
                    :src="team(side.id)?.logo ?? '/logos/placeholder.svg'"
                    alt=""
                    class="size-5 shrink-0 object-contain"
                  >
                  <span class="min-w-0 flex-1 truncate">{{ team(side.id)?.school ?? 'TBD' }}</span>
                </template>
                <span
                  v-else
                  class="flex-1 text-xs italic text-muted"
                >TBD</span>
                <span
                  v-if="side.score !== undefined"
                  class="shrink-0 tabular-nums"
                >{{ side.score }}</span>
                <UIcon
                  v-else-if="byId.get(id)!.winnerSource === 'result' && byId.get(id)!.winner === side.id"
                  name="i-lucide-check"
                  class="size-4 shrink-0"
                />
              </button>
            </template>
          </div>
        </div>
      </div>

      <div class="flex flex-col">
        <div class="mb-3 text-xs font-semibold uppercase tracking-wide text-toned">
          Champion
        </div>
        <div class="flex flex-1 items-center">
          <div
            v-if="champion"
            class="w-full rounded-lg border-2 p-3 text-center"
            :style="{ borderColor: champion.color }"
          >
            <img
              :src="champion.logo"
              alt=""
              class="mx-auto size-12 object-contain"
            >
            <div class="mt-2 font-semibold text-highlighted">
              {{ champion.school }}
            </div>
            <UIcon
              name="i-lucide-trophy"
              class="mt-1 size-5 text-amber-500 dark:text-amber-400"
            />
          </div>
          <p
            v-else
            class="w-full rounded-lg border border-dashed border-default p-3 text-center text-xs text-muted"
          >
            Pick each game to crown a champion.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
