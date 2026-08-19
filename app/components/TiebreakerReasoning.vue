<script setup lang="ts">
// `computed`/`ref`/`useId` are imported explicitly from 'vue' (plus
// `nextTick`, needed for the focus-management contract below), so this
// component mounts in the plain vitest project the same way
// `StandingsSidebar.vue` does -- the project's vitest config registers no
// Nuxt auto-import plugin.
import { computed, nextTick, ref, useId, watch } from 'vue'
import type {
  RankGroup,
  StepOutcome,
  StepValue,
  TeamId,
  TiebreakerCycle,
  TiebreakerStepId
} from '#shared/domain/tiebreakers/types'

/**
 * Self-contained, props-in / events-out reasoning panel for one rank group
 * (TIE-05, TIE-06, D-15, D-16, D-17). Renders the panel `<div>` that sits
 * inside `StandingsTable`'s reasoning `<tr>`/`<td colspan="4">` -- it does
 * not own the row itself (Plan 07 supplies that wrapper), because a
 * component whose root is a `<tr>` cannot be mounted standalone in
 * happy-dom.
 *
 * Owns no store, no composable, no storage read/write. The one interactive
 * feature it carries -- the D-17 ordering terminus -- is entirely local
 * component state until every team is assigned, then commits once via the
 * `commit` emit. The consumer (Plan 07's `useManualTiebreakers`) decides
 * what to do with that ordering.
 */
const props = defineProps<{
  group: RankGroup
  schoolById: ReadonlyMap<TeamId, string>
  slateComplete: boolean
}>()

const emit = defineEmits<{
  commit: [order: TeamId[]]
}>()

function schoolName(id: TeamId): string {
  return props.schoolById.get(id) ?? `Team ${id}`
}

// Human-readable step labels. Rendered at normal case and transformed
// visually via the `uppercase` utility class where §7 calls for an eyebrow
// -- the DOM text itself stays sentence-cased so a lower-cased embedding
// ("at common opponents", §7.3's restart line) needs no second table.
const STEP_LABELS: Record<TiebreakerStepId, string> = {
  'head-to-head': 'Head-to-head',
  'common-opponents': 'Common opponents',
  'next-highest-placed-common-opponent': 'Next-highest-placed common opponent',
  'cumulative-opponent-win-pct': 'Cumulative opponent win percentage',
  'total-wins': 'Total wins'
}

function stepLabel(step: TiebreakerStepId): string {
  return STEP_LABELS[step]
}

/** `.800` rather than `0.800` -- 06-UI-SPEC.md §7.2's literal copy example. */
function formatWinPct(pct: number): string {
  return pct.toFixed(3).replace(/^0\./, '.')
}

/** One string per `StepValue` variant, no icon (§7.2's copy table, verbatim). */
function stepValueText(value: StepValue): string {
  switch (value.kind) {
    case 'record':
      return `${value.wins}-${value.losses} (${formatWinPct(value.winPct)})`
    case 'headToHead':
      switch (value.result) {
        case 'beat-all': return 'beat all others'
        case 'lost-to-all': return 'lost to all others'
        case 'mixed': return 'mixed'
        case 'no-common-games': return 'no shared games'
      }
      break
    case 'indeterminate':
      return 'not applicable'
  }
  return ''
}

const isManual = computed(() => props.group.resolvedBy === 'manual')

const manualOrderingSchools = computed(() => (props.group.manualOrdering ?? []).map(id => schoolName(id)))

/**
 * D-16: the last `StepOutcome` with `separated === true` in the last
 * `TiebreakerCycle` of this group's own trace -- never searched across
 * cycles, and never rendered for a manual group (§7.5 leads with the
 * decided-by-you heading instead; the manual case shows what the procedure
 * exhausted only via the full-procedure toggle).
 */
const decisiveStep = computed<StepOutcome | undefined>(() => {
  if (isManual.value) return undefined
  const lastCycle = props.group.trace.at(-1)
  if (!lastCycle) return undefined
  const separating = lastCycle.steps.filter(s => s.separated)
  return separating.at(-1)
})

const showFullProcedure = ref(false)
const procedureId = useId()

function toggleFullProcedure() {
  showFullProcedure.value = !showFullProcedure.value
}

interface RestartLine {
  key: string
  text: string
}

/**
 * Restart events are required TIE-05 content and must never be collapsed
 * away by any control other than "Show full procedure" itself (§7.3).
 * Removed entries sharing a reason and step are combined onto one line,
 * matching §7.3's mockup (`Duke, Miami seeded at common opponents.`);
 * entries with distinct reason/step pairs each get their own line so no
 * team's specific reason or step is ever lost in a merge.
 */
function restartLinesFor(c: TiebreakerCycle): RestartLine[] {
  if (c.outcome !== 'restart' || c.removed.length === 0) return []
  const byGroup = new Map<string, { reason: string, atStep: TiebreakerStepId, names: string[] }>()
  for (const removed of c.removed) {
    const key = `${removed.reason}|${removed.atStep}`
    const existing = byGroup.get(key)
    if (existing) {
      existing.names.push(schoolName(removed.teamId))
    } else {
      byGroup.set(key, { reason: removed.reason, atStep: removed.atStep, names: [schoolName(removed.teamId)] })
    }
  }
  return [...byGroup.entries()].map(([key, entry]) => ({
    key,
    text: `→ Restarted. ${entry.names.join(', ')} ${entry.reason} at ${stepLabel(entry.atStep).toLowerCase()}.`
  }))
}

const showTerminalReason = computed(() => props.group.resolvedBy === 'unresolved' && props.group.terminalReason !== undefined)

// --- D-17 ordering terminus (model B: order the whole group in one interaction) ---

const showOrderingControl = computed(() => props.group.teams.length > 1 && props.slateComplete)

const assignedIds = ref<TeamId[]>([])

/**
 * CR-02: `StandingsTable.vue` keys this component's `v-for` by the group's
 * LAST ROW's team id, not by group membership -- if a later pick changes
 * which teams are tied at this rank slot while that same team happens to
 * remain the group's last row, Vue reuses this component instance instead
 * of remounting it, and `assignedIds` would otherwise keep pointing at
 * teams no longer in the live group (stale "ranked" list, a false
 * "all ranked" announcement, and a commit whose ids don't set-equal the
 * live group -- silently no-op'd by `commitOrdering`'s guard, but with no
 * feedback to the user stuck looking at a dead control). Reset local
 * ordering state whenever the group's own membership actually changes.
 */
watch(
  () => props.group.teams,
  (next, prev) => {
    if (!prev || next.length !== prev.length || next.some((id, i) => id !== prev[i])) {
      assignedIds.value = []
    }
  }
)

const assignedTeams = computed(() =>
  assignedIds.value.map((id, index) => ({ id, school: schoolName(id), position: index + 1 }))
)

const unassignedTeams = computed(() =>
  props.group.teams
    .filter(id => !assignedIds.value.includes(id))
    .map(id => ({ id, school: schoolName(id) }))
    .sort((a, b) => a.school.localeCompare(b.school))
)

function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

const nextOrdinal = computed(() => ordinal(assignedIds.value.length + 1))

const isComplete = computed(
  () => props.group.teams.length > 0 && assignedIds.value.length === props.group.teams.length
)

/**
 * Contract detail (b): the progress element carries the status role and its
 * visible text is the ranked-of-total count (§8.2); this computed supplies
 * the visually-hidden per-assignment / all-ranked announcement sentence
 * that shares the same `role="status"` region (§12.3's live-region rule).
 */
const announcement = computed(() => {
  if (assignedIds.value.length === 0) return ''
  if (isComplete.value) return `All ${props.group.teams.length} teams ranked.`
  const lastId = assignedIds.value.at(-1)!
  const remaining = props.group.teams.length - assignedIds.value.length
  return `${schoolName(lastId)} ranked ${assignedIds.value.length}. ${remaining} teams remaining.`
})

const terminusId = useId()

// Template refs. Bound inside a v-for, `unassignedButtonRefs` is
// automatically populated as an array in DOM order by Vue -- no manual
// function-ref bookkeeping needed.
const unassignedButtonRefs = ref<HTMLButtonElement[]>([])
const undoButtonRef = ref<HTMLButtonElement | null>(null)
const startOverButtonRef = ref<HTMLButtonElement | null>(null)

/**
 * §12.3: the single most important accessibility detail in the phase. The
 * activated button leaves the unassigned list on every assignment, so
 * focus would otherwise be lost to `<body>` and keyboard users would be
 * stranded.
 */
function assignTeam(teamId: TeamId) {
  assignedIds.value = [...assignedIds.value, teamId]
  const complete = assignedIds.value.length === props.group.teams.length
  if (complete) {
    emit('commit', [...assignedIds.value])
  }
  void nextTick(() => {
    if (complete) {
      startOverButtonRef.value?.focus()
    } else {
      unassignedButtonRefs.value[0]?.focus()
    }
  })
}

function undoLast() {
  if (assignedIds.value.length === 0) return
  assignedIds.value = assignedIds.value.slice(0, -1)
  void nextTick(() => {
    if (assignedIds.value.length > 0) {
      undoButtonRef.value?.focus()
    } else {
      unassignedButtonRefs.value[0]?.focus()
    }
  })
}

function startOver() {
  if (assignedIds.value.length === 0) return
  assignedIds.value = []
  void nextTick(() => {
    unassignedButtonRefs.value[0]?.focus()
  })
}
</script>

<template>
  <div class="bg-muted rounded-md p-3 my-1 text-left">
    <template v-if="isManual">
      <p class="text-xs font-semibold uppercase tracking-wide text-muted">
        Decided by you
      </p>
      <p class="text-sm text-default mb-2">
        You ranked these teams in this order. It applies while this conference's slate is complete and its picks are unchanged.
      </p>
      <ol class="text-sm text-default mb-2">
        <li
          v-for="(school, index) in manualOrderingSchools"
          :key="index"
        >
          {{ school }}
        </li>
      </ol>
    </template>

    <template v-if="showFullProcedure">
      <div
        v-for="(traceCycle, cycleIndex) in group.trace"
        :key="cycleIndex"
        class="mb-2"
      >
        <p class="text-xs font-semibold uppercase tracking-wide text-muted">
          Cycle {{ cycleIndex + 1 }} · Tied: {{ traceCycle.tiedTeams.map(schoolName).join(', ') }}
        </p>
        <div
          v-for="(step, stepIndex) in traceCycle.steps"
          :key="stepIndex"
          class="mb-1"
        >
          <p class="text-sm text-default">
            {{ stepLabel(step.step) }}
          </p>
          <p
            v-if="!step.separated"
            class="text-sm text-dimmed"
          >
            no separation
          </p>
          <dl
            v-else
            class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1"
          >
            <template
              v-for="entry in step.values"
              :key="entry.teamId"
            >
              <dt class="text-sm font-semibold text-highlighted">
                {{ schoolName(entry.teamId) }}
              </dt>
              <dd
                class="text-sm"
                :class="entry.value.kind === 'indeterminate' ? 'text-dimmed' : 'text-default'"
              >
                {{ stepValueText(entry.value) }}
              </dd>
            </template>
          </dl>
        </div>
        <p
          v-for="line in restartLinesFor(traceCycle)"
          :key="line.key"
          class="text-sm text-toned"
        >
          {{ line.text }}
        </p>
      </div>
    </template>

    <template v-if="decisiveStep">
      <p class="text-xs font-semibold uppercase tracking-wide text-muted">
        Decided at · {{ stepLabel(decisiveStep.step) }}
      </p>
      <dl class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 mb-2">
        <template
          v-for="entry in decisiveStep.values"
          :key="entry.teamId"
        >
          <dt class="text-sm font-semibold text-highlighted">
            {{ schoolName(entry.teamId) }}
          </dt>
          <dd
            class="text-sm"
            :class="entry.value.kind === 'indeterminate' ? 'text-dimmed' : 'text-default'"
          >
            {{ stepValueText(entry.value) }}
          </dd>
        </template>
      </dl>
    </template>

    <button
      v-if="group.trace.length > 0"
      type="button"
      class="text-sm text-toned underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :aria-expanded="showFullProcedure"
      :aria-controls="procedureId"
      @click="toggleFullProcedure"
    >
      {{ showFullProcedure ? 'Hide full procedure' : 'Show full procedure' }}
    </button>

    <template v-if="showTerminalReason">
      <p class="text-sm text-default mt-2">
        No further step applies.
      </p>
      <p class="text-xs text-muted italic">
        "{{ group.terminalReason!.ruleCitation }}"
      </p>
      <p class="text-xs text-dimmed">
        — {{ group.terminalReason!.sourceName }}
      </p>
    </template>

    <div
      v-if="showOrderingControl"
      role="group"
      :aria-labelledby="terminusId"
      class="mt-3"
    >
      <p
        :id="terminusId"
        class="text-sm font-semibold text-highlighted"
      >
        Nothing separates these — you choose.
      </p>
      <p class="text-xs text-muted mb-2">
        Click each team in the order they finish.
      </p>

      <ul class="space-y-1">
        <li
          v-for="team in assignedTeams"
          :key="team.id"
          class="flex items-center gap-2"
        >
          <span class="inline-flex min-w-6 justify-center rounded-full px-1 bg-inverted text-inverted text-sm font-semibold tabular-nums">
            {{ team.position }}
            <span class="sr-only">Position {{ team.position }}</span>
          </span>
          <span class="text-sm text-default">{{ team.school }}</span>
        </li>
        <li
          v-for="team in unassignedTeams"
          :key="team.id"
        >
          <button
            ref="unassignedButtonRefs"
            type="button"
            class="w-full text-left text-sm px-2 py-1.5 rounded bg-elevated hover:bg-accented transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :aria-label="`Rank ${team.school} ${nextOrdinal}`"
            @click="assignTeam(team.id)"
          >
            {{ team.school }}
          </button>
        </li>
      </ul>

      <div
        role="status"
        class="text-xs text-muted mt-2"
      >
        Ranked {{ assignedIds.length }} of {{ group.teams.length }}.
        <span class="sr-only">{{ announcement }}</span>
      </div>

      <div class="flex gap-3 mt-1">
        <button
          ref="undoButtonRef"
          type="button"
          class="text-sm text-toned underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :disabled="assignedIds.length === 0"
          @click="undoLast"
        >
          Undo last
        </button>
        <button
          ref="startOverButtonRef"
          type="button"
          class="text-sm text-toned underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :disabled="assignedIds.length === 0"
          @click="startOver"
        >
          Start over
        </button>
      </div>
    </div>
  </div>
</template>
