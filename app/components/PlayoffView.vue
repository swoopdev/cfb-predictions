<script setup lang="ts">
import { computed } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import type { Team } from '#shared/types/schedule'
import { currentBracketInputs, projectSeason } from '#shared/domain/odds/seasonModel'
import { ratingWinProbability } from '#shared/domain/odds/winProbability'
import { selectPlayoffField } from '#shared/domain/playoff/field'
import type { FieldEntry } from '#shared/domain/playoff/field'
import { resolveBracket, simulateBracketPicks } from '#shared/domain/playoff/bracket'
import type { BracketGameResult } from '#shared/domain/playoff/bracket'
import { POWER_FOUR } from '#shared/domain/playoff/formats'
import { useSeasonModelData } from '~/composables/useSeasonModelData'
import { useScenarioOdds, useScenarioState } from '~/composables/useScenarioOdds'
import { useBracketPicksStorage } from '~/composables/useBracketPicksStorage'
import type { BracketKind } from '~/composables/useBracketPicksStorage'
import { applyRankingOverride, useRankingOverrideStorage } from '~/composables/useRankingOverrideStorage'
import { conferenceSlug, formatOdds } from '~/utils/oddsFormat'
import PlayoffBracket from './PlayoffBracket.vue'
import RankingEditor from './RankingEditor.vue'

/**
 * The /playoff page body for one scenario (keyed by scenario id, like every
 * scenario-scoped view):
 * - Current: "if the season ended today" -- the latest CFP ranking, each
 *   conference's highest-ranked team standing in as its champion;
 * - Projected: the scenario played out (unpicked games to the favorite),
 *   ranked by the committee model anchored to the latest CFP ranking, with
 *   a drag-to-reorder override.
 * Both brackets are pickable through to a champion and saved per scenario.
 */
const props = defineProps<{ scenarioId: string }>()

const route = useRoute()
const router = useRouter()

const seasonData = useSeasonModelData()
const { scenario } = useScenarioState(props.scenarioId)
const bracketPicks = useBracketPicksStorage(props.scenarioId)
const override = useRankingOverrideStorage(props.scenarioId)
const { teamOdds, odds, computing, usingBaseline } = useScenarioOdds(seasonData, scenario)

const view = computed<BracketKind>({
  get: () => (route.query.view === 'projected' ? 'projected' : 'current'),
  set: v => router.replace({ query: { ...route.query, view: v === 'projected' ? 'projected' : undefined } as LocationQueryRaw })
})
const tabs = [
  { label: 'Current', value: 'current', icon: 'i-lucide-calendar' },
  { label: 'Projected', value: 'projected', icon: 'i-lucide-sparkles' }
]

const teamsById = computed(() => new Map<number, Team>((seasonData.teams.data.value ?? []).map(t => [t.id, t])))
const results = computed<BracketGameResult[]>(() => [...(seasonData.data.value?.postseasonGames ?? [])])

function recordsFrom(winners: ReadonlyMap<number, number>): Map<number, string> {
  const model = seasonData.model.value
  const tally = new Map<number, { w: number, l: number }>()
  if (!model) return new Map()
  const add = (id: number, won: boolean) => {
    const t = tally.get(id) ?? { w: 0, l: 0 }
    if (won) t.w++
    else t.l++
    tally.set(id, t)
  }
  for (const g of model.regularGames) {
    const w = winners.get(g.id)
    if (w === undefined) continue
    add(g.homeId, w === g.homeId)
    add(g.awayId, w === g.awayId)
  }
  return new Map([...tally.entries()].map(([id, t]) => [id, `${t.w}-${t.l}`]))
}

const current = computed(() => {
  const model = seasonData.model.value
  if (!model) return undefined
  const inputs = currentBracketInputs(model)
  const field = selectPlayoffField(model.format, inputs.order, inputs.championCandidates)
  const fieldIds = new Set(field.map(e => e.teamId))
  const slots = resolveBracket(model.format, field, bracketPicks.value.current, results.value)
  const realWinners = new Map<number, number>()
  for (const g of model.regularGames) {
    if (g.completed && g.homePoints != null && g.awayPoints != null && g.homePoints !== g.awayPoints) {
      realWinners.set(g.id, g.homePoints > g.awayPoints ? g.homeId : g.awayId)
    }
  }
  return {
    inputs,
    field,
    slots,
    firstOut: inputs.order.filter(id => !fieldIds.has(id)).slice(0, 4),
    records: recordsFrom(realWinners)
  }
})

const projected = computed(() => {
  const model = seasonData.model.value
  if (!model) return undefined
  const draw = projectSeason(model, scenario.value)
  const order = applyRankingOverride(draw.committee.order, override.value)
  const field = selectPlayoffField(model.format, order, draw.championCandidates)
  const fieldIds = new Set(field.map(e => e.teamId))
  const slots = resolveBracket(model.format, field, bracketPicks.value.projected, results.value)
  const titleWinners = new Map(draw.winners)
  const records = recordsFrom(titleWinners)
  // Title game results count toward the displayed record too.
  for (const r of draw.titleGameResults) {
    for (const [id, won] of [[r.winnerId, true], [r.loserId, false]] as const) {
      const [w, l] = (records.get(id) ?? '0-0').split('-').map(Number) as [number, number]
      records.set(id, won ? `${w + 1}-${l}` : `${w}-${l + 1}`)
    }
  }
  const champions = POWER_FOUR.map(conference => ({ conference, teamId: draw.championCandidates.get(conference)?.[0] }))
  return {
    draw,
    order,
    field,
    slots,
    firstOut: order.filter(id => !fieldIds.has(id)).slice(0, 4),
    records,
    champions
  }
})

const active = computed(() => (view.value === 'projected' ? projected.value : current.value))

function pick(slotId: string, teamId: number | null) {
  const kind = view.value
  const rest = Object.fromEntries(Object.entries(bracketPicks.value[kind]).filter(([slot]) => slot !== slotId))
  bracketPicks.value = { ...bracketPicks.value, [kind]: teamId === null ? rest : { ...rest, [slotId]: teamId } }
}

function simTheRest() {
  const model = seasonData.model.value
  const data = active.value
  if (!model || !data) return
  const kind = view.value
  const next = simulateBracketPicks(
    model.format,
    data.field,
    bracketPicks.value[kind],
    results.value,
    (top, bottom, topHosts) => ratingWinProbability(model.wp, top, bottom, topHosts)
  )
  bracketPicks.value = { ...bracketPicks.value, [kind]: next }
}

function clearBracket() {
  bracketPicks.value = { ...bracketPicks.value, [view.value]: {} }
}

const hasBracketPicks = computed(() => Object.keys(bracketPicks.value[view.value]).length > 0)

const editorOrder = computed(() => projected.value?.order.slice(0, 25) ?? [])
const seedByTeam = computed(() => new Map((active.value?.field ?? []).map(e => [e.teamId, e.seed])))
const autoBidByTeam = computed(() => new Map((active.value?.field ?? []).filter(e => e.autoBid).map(e => [e.teamId, e.autoBid!])))

function setOverride(order: number[]) {
  override.value = order
}

const oddsRows = computed(() => [...(odds.value?.teams ?? [])]
  .filter(t => t.playoff >= 0.005)
  .sort((a, b) => b.playoff - a.playoff || b.nationalTitle - a.nationalTitle)
  .slice(0, 20))

const team = (id: number | undefined) => (id === undefined ? undefined : teamsById.value.get(id))

function fieldLabel(entry: FieldEntry): string {
  if (!entry.autoBid) return 'At-large'
  // Before a conference's title game is final, the Current bracket's
  // "champion" is just its highest-ranked team -- say so.
  const conference = team(entry.teamId)?.conference
  const titleGame = conference ? seasonData.model.value?.titleGames.get(conference) : undefined
  if (view.value === 'current' && entry.autoBid === `${conference} champion` && !titleGame?.completed) {
    return `Top-ranked ${conference} team`
  }
  return entry.autoBid
}

const anchorLabel = computed(() => {
  const model = seasonData.model.value
  if (!model) return ''
  if (model.anchor.source === 'cfp') return `the CFP committee's week ${model.anchor.week} ranking`
  if (model.anchor.source === 'ap') return `the AP poll (no committee ranking yet)`
  return 'SP+ (no rankings published yet)'
})
</script>

<template>
  <div class="space-y-6">
    <UTabs
      v-model="view"
      :items="tabs"
      :content="false"
      class="w-full sm:w-80"
    />

    <div
      v-if="!seasonData.ready.value || !active"
      class="space-y-3"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-96 w-full" />
    </div>

    <template v-else>
      <div class="rounded-lg border border-default bg-elevated/40 p-4 text-sm">
        <template v-if="view === 'current'">
          <p class="font-medium text-highlighted">
            If the season ended today
          </p>
          <p class="mt-1 text-muted">
            Seeded straight from {{ anchorLabel }}. Each Power Four conference's highest-ranked team stands in as its champion
            (or its real champion, once the title game is played), plus the highest-ranked Group of Six team and Notre Dame if it's in the top 12.
            Pick the games to play it out.
          </p>
        </template>
        <template v-else>
          <p class="font-medium text-highlighted">
            Your scenario, played out
          </p>
          <p class="mt-1 text-muted">
            Every game you've picked counts; every game you haven't goes to the favorite. Title games use your championship picks.
            Teams are ranked by a committee-style model that starts from {{ anchorLabel }} and moves teams for every result after it.
            Drag the ranking to overrule it.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton
              v-for="c in projected?.champions ?? []"
              :key="c.conference"
              :to="`/conference/${conferenceSlug(c.conference)}`"
              size="xs"
              color="neutral"
              variant="outline"
            >
              <img
                v-if="team(c.teamId)"
                :src="team(c.teamId)!.logo"
                alt=""
                class="size-4 object-contain"
              >
              {{ c.conference }}: {{ team(c.teamId)?.school ?? 'TBD' }}
            </UButton>
          </div>
        </template>
      </div>

      <section aria-label="Bracket">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-toned">
            {{ view === 'current' ? 'Current bracket' : 'Projected bracket' }}
          </h2>
          <div class="flex gap-2">
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-lucide-dices"
              @click="simTheRest"
            >
              Sim the rest
            </UButton>
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              :disabled="!hasBracketPicks"
              @click="clearBracket"
            >
              Clear picks
            </UButton>
          </div>
        </div>
        <PlayoffBracket
          :format="seasonData.model.value!.format"
          :slots="active.slots"
          :teams-by-id="teamsById"
          @pick="pick"
        />
      </section>

      <div class="grid gap-6 lg:grid-cols-2">
        <section aria-label="Field">
          <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-toned">
            The field
          </h2>
          <ol class="divide-y divide-default overflow-hidden rounded-lg border border-default">
            <li
              v-for="entry in active.field"
              :key="entry.teamId"
              class="flex items-center gap-2 px-3 py-1.5 text-sm"
            >
              <span class="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-muted">{{ entry.seed }}</span>
              <img
                :src="team(entry.teamId)?.logo ?? '/logos/placeholder.svg'"
                alt=""
                class="size-5 shrink-0 object-contain"
              >
              <NuxtLink
                :to="`/team/${entry.teamId}`"
                class="min-w-0 flex-1 truncate text-highlighted hover:underline"
              >
                {{ team(entry.teamId)?.school ?? entry.teamId }}
              </NuxtLink>
              <span class="text-xs tabular-nums text-muted">{{ active.records.get(entry.teamId) ?? '' }}</span>
              <span class="hidden w-40 truncate text-right text-xs text-muted sm:inline">
                #{{ entry.rank }} · {{ fieldLabel(entry) }}
              </span>
            </li>
          </ol>
          <p
            v-if="active.firstOut.length > 0"
            class="mt-2 text-xs text-muted"
          >
            First out: {{ active.firstOut.map(id => team(id)?.school ?? id).join(', ') }}
          </p>
        </section>

        <RankingEditor
          v-if="view === 'projected'"
          :order="editorOrder"
          :teams-by-id="teamsById"
          :seed-by-team="seedByTeam"
          :auto-bid-by-team="autoBidByTeam"
          :record-by-team="projected?.records"
          :modified="override.length > 0"
          @update="setOverride"
          @reset="override = []"
        />

        <section
          v-else
          aria-label="Current ranking"
        >
          <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-toned">
            {{ seasonData.model.value!.anchor.source === 'cfp' ? 'CFP ranking' : 'Ranking' }}
          </h2>
          <ol class="divide-y divide-default overflow-hidden rounded-lg border border-default">
            <li
              v-for="(id, i) in current!.inputs.order.slice(0, 25)"
              :key="id"
              class="flex items-center gap-2 px-3 py-1.5 text-sm"
            >
              <span class="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{{ i + 1 }}</span>
              <img
                :src="team(id)?.logo ?? '/logos/placeholder.svg'"
                alt=""
                class="size-5 shrink-0 object-contain"
              >
              <span class="min-w-0 flex-1 truncate text-highlighted">{{ team(id)?.school ?? id }}</span>
              <span class="text-xs tabular-nums text-muted">{{ current!.records.get(id) ?? '' }}</span>
              <UBadge
                v-if="seedByTeam.has(id)"
                :color="autoBidByTeam.has(id) ? 'primary' : 'neutral'"
                variant="subtle"
                size="sm"
              >
                Seed {{ seedByTeam.get(id) }}
              </UBadge>
            </li>
          </ol>
        </section>
      </div>

      <section aria-label="Playoff odds">
        <div class="mb-2 flex items-center gap-2">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-toned">
            Playoff odds · your scenario
          </h2>
          <UIcon
            v-if="computing"
            name="i-lucide-loader-circle"
            class="size-4 animate-spin text-muted"
          />
          <span class="text-xs text-muted">
            {{ (odds?.sims ?? 0).toLocaleString() }} simulated seasons{{ usingBaseline ? ' · updated daily' : '' }}
          </span>
        </div>
        <div class="overflow-x-auto rounded-lg border border-default">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-xs uppercase tracking-wide text-muted">
                <th
                  scope="col"
                  class="py-2 pl-3 pr-2 text-left font-medium"
                >
                  Team
                </th>
                <th
                  scope="col"
                  class="px-2 py-2 text-right font-medium"
                >
                  Playoff
                </th>
                <th
                  scope="col"
                  class="px-2 py-2 text-right font-medium"
                >
                  Bye
                </th>
                <th
                  scope="col"
                  class="px-2 py-2 text-right font-medium"
                >
                  Conf champ
                </th>
                <th
                  scope="col"
                  class="py-2 pl-2 pr-3 text-right font-medium"
                >
                  Title
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="row in oddsRows"
                :key="row.teamId"
              >
                <th
                  scope="row"
                  class="py-1.5 pl-3 pr-2 text-left font-normal"
                >
                  <NuxtLink
                    :to="`/team/${row.teamId}`"
                    class="flex items-center gap-2 hover:underline"
                  >
                    <img
                      :src="team(row.teamId)?.logo ?? '/logos/placeholder.svg'"
                      alt=""
                      class="size-5 shrink-0 object-contain"
                    >
                    <span class="text-highlighted">{{ team(row.teamId)?.school ?? row.teamId }}</span>
                  </NuxtLink>
                </th>
                <td class="px-2 py-1.5 text-right font-semibold tabular-nums text-highlighted">
                  {{ formatOdds(row.playoff) }}
                </td>
                <td class="px-2 py-1.5 text-right tabular-nums">
                  {{ formatOdds(row.bye) }}
                </td>
                <td class="px-2 py-1.5 text-right tabular-nums">
                  {{ formatOdds(teamOdds.get(row.teamId)?.conferenceTitle) }}
                </td>
                <td class="py-1.5 pl-2 pr-3 text-right tabular-nums">
                  {{ formatOdds(row.nationalTitle) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
