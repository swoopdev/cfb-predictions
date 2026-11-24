<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import type { Game, Team } from '#shared/types/schedule'
import type { ConferenceId } from '#shared/domain/tiebreakers/types'
import type { PathCondition } from '#shared/domain/odds/paths'
import { MAX_EXACT_GAMES } from '#shared/domain/odds/paths'
import { homeWinProbability } from '#shared/domain/odds/winProbability'
import { useSeasonModelData } from '~/composables/useSeasonModelData'
import { useConferencePaths, useScenarioOdds, useScenarioState, useWinOut } from '~/composables/useScenarioOdds'
import { useStandings } from '~/composables/useStandings'
import { formatOdds } from '~/utils/oddsFormat'
import TeamPathPanel from './TeamPathPanel.vue'

/**
 * One Power Four conference's title race for one scenario: the race board
 * (every team's title-game / conference / playoff odds), the games still
 * able to change it with quick-pick buttons, and the Path panel for the
 * selected team. Mounted with `:key="scenarioId"` by the page, like every
 * other scenario-scoped view (RESEARCH.md Pitfall 1).
 */
const props = defineProps<{
  conference: ConferenceId
  scenarioId: string
  selectedTeamId?: number
}>()

const emit = defineEmits<{ select: [teamId: number] }>()

const seasonData = useSeasonModelData()
const { picks, scenario } = useScenarioState(props.scenarioId)
const { standings } = useStandings(props.scenarioId)
const conferenceRef = toRef(props, 'conference')
const { odds, teamOdds, computing, progress } = useScenarioOdds(seasonData, scenario)
const { paths, computing: pathsComputing } = useConferencePaths(seasonData, scenario, conferenceRef)

const teamsById = computed(() => new Map<number, Team>((seasonData.teams.data.value ?? []).map(t => [t.id, t])))
const rows = computed(() => standings.value?.[props.conference] ?? [])

const exactByTeam = computed(() => new Map(
  paths.value?.mode === 'exact' ? paths.value.teams.map(t => [t.teamId, t]) : []
))

const board = computed(() => rows.value
  .map((row) => {
    const exact = exactByTeam.value.get(row.id)
    const o = teamOdds.value.get(row.id)
    return {
      row,
      team: teamsById.value.get(row.id),
      status: exact?.status,
      titleGame: exact?.probability ?? o?.titleGame,
      exact: Boolean(exact),
      conferenceTitle: o?.conferenceTitle,
      playoff: o?.playoff
    }
  })
  .sort((a, b) => (b.titleGame ?? 0) - (a.titleGame ?? 0) || a.row.rank - b.row.rank))

const selectedId = computed<number | undefined>(() => {
  const ids = new Set(rows.value.map(r => r.id))
  if (props.selectedTeamId !== undefined && ids.has(props.selectedTeamId)) return props.selectedTeamId
  return board.value.find(b => b.status !== 'clinched' && b.status !== 'eliminated')?.row.id ?? board.value[0]?.row.id
})
const selectedTeam = computed(() => (selectedId.value === undefined ? undefined : teamsById.value.get(selectedId.value)))

// Win-out only matters before exact paths take over (they answer it outright).
const winOutTeam = computed(() => (paths.value?.mode === 'exact' ? undefined : selectedId.value))
const { winOut, computing: winOutComputing } = useWinOut(seasonData, scenario, winOutTeam)

const rankingStep = computed(() => (props.conference === 'SEC' ? 'scores' as const : 'metric' as const))

// ---- Games that can still change the race ---------------------------------

const gameById = computed(() => new Map<number, Game>((seasonData.games.data.value?.games ?? []).map(g => [g.id, g])))

interface RaceGame { game: Game, homeWinProbability: number }

const raceGames = computed<RaceGame[]>(() => {
  const model = seasonData.model.value
  if (!model) return []
  if (paths.value?.mode === 'exact') {
    return paths.value.games
      .map(o => ({ game: gameById.value.get(o.gameId)!, homeWinProbability: o.homeWinProbability }))
      .filter(r => r.game)
  }
  const ctx = model.contextByConference.get(props.conference)
  if (!ctx) return []
  return ctx.conferenceGames
    .filter(g => !g.completed)
    .map(g => ({ game: g, homeWinProbability: homeWinProbability(model.wp, g) }))
    .sort((a, b) => a.game.week - b.game.week || a.game.id - b.game.id)
})

const raceGamesByWeek = computed(() => {
  const weeks = new Map<number, RaceGame[]>()
  for (const r of raceGames.value) {
    const list = weeks.get(r.game.week) ?? []
    list.push(r)
    weeks.set(r.game.week, list)
  }
  return [...weeks.entries()].sort((a, b) => a[0] - b[0])
})

/** `picks` minus the given game ids (a fresh object, so storage sees the write). */
function picksWithout(ids: readonly number[]): Record<number, number> {
  const drop = new Set(ids)
  return Object.fromEntries(Object.entries(picks.value).filter(([id]) => !drop.has(Number(id))))
}

function togglePick(game: Game, teamId: number) {
  picks.value = picks.value[game.id] === teamId
    ? picksWithout([game.id])
    : { ...picks.value, [game.id]: teamId }
}

function applyPath(conditions: PathCondition[]) {
  const next = { ...picks.value }
  for (const c of conditions) next[c.gameId] = c.winnerId
  picks.value = next
}

const raceGameIds = computed(() => raceGames.value.map(r => r.game.id))
const pickedRaceGames = computed(() => raceGameIds.value.filter(id => id in picks.value).length)
function clearRacePicks() {
  picks.value = picksWithout(raceGameIds.value)
}

const showAllGames = ref(false)
const GAME_LIMIT = 16

const school = (id: number) => teamsById.value.get(id)?.school ?? 'FCS opponent'
const logo = (id: number) => teamsById.value.get(id)?.logo ?? '/logos/placeholder.svg'

const proxyShare = computed(() => odds.value?.proxyShare[props.conference] ?? 0)

const clinched = computed(() => board.value.filter(b => b.status === 'clinched'))
</script>

<template>
  <div class="space-y-6">
    <div
      v-if="!seasonData.ready.value"
      class="space-y-3"
    >
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>

    <template v-else>
      <!-- Mode banner: exact enumeration vs simulation -->
      <div class="rounded-lg border border-default bg-elevated/40 p-4 text-sm">
        <template v-if="paths?.mode === 'exact'">
          <p class="font-medium text-highlighted">
            <UIcon
              name="i-lucide-list-checks"
              class="mr-1 inline size-4 align-text-bottom"
            />
            Exact paths: {{ paths.games.length }} game{{ paths.games.length === 1 ? '' : 's' }} can still change this race.
          </p>
          <p class="mt-1 text-muted">
            Every one of the {{ paths.combinations.toLocaleString() }} possible outcomes was run through the {{ conference }} tiebreakers.
            Percentages weight each outcome by the betting line or SP+.
          </p>
        </template>
        <template v-else-if="paths?.mode === 'too-many'">
          <p class="font-medium text-highlighted">
            <UIcon
              name="i-lucide-dices"
              class="mr-1 inline size-4 align-text-bottom"
            />
            Simulated: {{ paths.openGames }} games can still change this race.
          </p>
          <p class="mt-1 text-muted">
            That's too many to list every path, so odds come from {{ (odds?.sims ?? 0).toLocaleString() }} simulated seasons.
            Pick games until {{ MAX_EXACT_GAMES }} or fewer are left and exact paths appear.
          </p>
        </template>
        <p
          v-else
          class="text-muted"
        >
          Working out the race…
        </p>
        <p
          v-if="clinched.length > 0"
          class="mt-2 text-highlighted"
        >
          Clinched: {{ clinched.map(c => c.row.school).join(' and ') }}.
          <NuxtLink
            v-if="clinched.length === 2"
            to="/week/14"
            class="underline underline-offset-2"
          >
            Pick the title game
          </NuxtLink>
        </p>
        <p
          v-if="proxyShare >= 0.01"
          class="mt-2 text-xs text-muted"
        >
          In {{ formatOdds(proxyShare) }} of simulated seasons, a title-game spot came down to the final
          {{ conference === 'SEC' ? 'scoring-margin' : 'ranking-metric' }} tiebreaker, estimated here from SP+.
        </p>
        <UProgress
          v-if="computing"
          :model-value="Math.round(progress * 100)"
          size="xs"
          class="mt-3"
        />
      </div>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <!-- Race board -->
        <section aria-label="Title race">
          <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-toned">
            Title race
          </h2>
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
                    Conf
                  </th>
                  <th
                    scope="col"
                    class="px-2 py-2 text-right font-medium"
                  >
                    Title game
                  </th>
                  <th
                    scope="col"
                    class="hidden px-2 py-2 text-right font-medium sm:table-cell"
                  >
                    Champ
                  </th>
                  <th
                    scope="col"
                    class="py-2 pl-2 pr-3 text-right font-medium"
                  >
                    Playoff
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="entry in board"
                  :key="entry.row.id"
                  class="cursor-pointer transition-colors hover:bg-elevated/60"
                  :class="{ 'bg-elevated': entry.row.id === selectedId }"
                  :aria-selected="entry.row.id === selectedId"
                  @click="emit('select', entry.row.id)"
                >
                  <th
                    scope="row"
                    class="py-2 pl-3 pr-2 text-left font-normal"
                  >
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-primary"
                      @click.stop="emit('select', entry.row.id)"
                    >
                      <span
                        class="h-6 w-1 shrink-0 rounded-full"
                        :style="{ backgroundColor: entry.row.id === selectedId ? entry.team?.color : 'transparent' }"
                      />
                      <img
                        :src="logo(entry.row.id)"
                        alt=""
                        class="size-5 shrink-0 object-contain"
                      >
                      <span class="text-highlighted">{{ entry.row.school }}</span>
                      <UBadge
                        v-if="entry.status === 'clinched'"
                        color="success"
                        variant="subtle"
                        size="sm"
                      >
                        Clinched
                      </UBadge>
                      <UBadge
                        v-else-if="entry.status === 'eliminated'"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                      >
                        Out
                      </UBadge>
                    </button>
                  </th>
                  <td class="px-2 py-2 text-right tabular-nums text-default">
                    {{ entry.row.confRecord.wins }}-{{ entry.row.confRecord.losses }}
                  </td>
                  <td class="px-2 py-2 text-right tabular-nums font-semibold text-highlighted">
                    {{ formatOdds(entry.titleGame, entry.exact) }}
                  </td>
                  <td class="hidden px-2 py-2 text-right tabular-nums text-default sm:table-cell">
                    {{ formatOdds(entry.conferenceTitle) }}
                  </td>
                  <td class="py-2 pl-2 pr-3 text-right tabular-nums text-default">
                    {{ formatOdds(entry.playoff) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Path panel -->
        <TeamPathPanel
          v-if="selectedTeam"
          :team="selectedTeam"
          :teams-by-id="teamsById"
          :has-title-race="true"
          :odds="teamOdds.get(selectedTeam.id)"
          :odds-computing="computing"
          :title-leverage="odds?.titleGameLeverage[selectedTeam.id] ?? []"
          :playoff-leverage="odds?.playoffLeverage[selectedTeam.id] ?? []"
          :paths="paths"
          :paths-computing="pathsComputing"
          :win-out="winOut"
          :win-out-computing="winOutComputing"
          :ranking-step="rankingStep"
          @apply="applyPath"
        />
      </div>

      <!-- Games that can still change the race -->
      <section
        v-if="raceGames.length > 0"
        aria-label="Games that decide the race"
      >
        <div class="mb-2 flex items-center justify-between gap-3">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-toned">
            {{ paths?.mode === 'exact' ? 'Games that decide the race' : 'Remaining conference games' }}
          </h2>
          <UButton
            v-if="pickedRaceGames > 0"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="clearRacePicks"
          >
            Clear these picks
          </UButton>
        </div>
        <div class="space-y-4">
          <template
            v-for="([week, list], wi) in raceGamesByWeek"
            :key="week"
          >
            <div v-if="showAllGames || raceGamesByWeek.slice(0, wi).reduce((n, [, l]) => n + l.length, 0) < GAME_LIMIT">
              <h3 class="mb-1.5 text-xs text-muted">
                Week {{ week }}
              </h3>
              <div
                class="grid gap-2"
                style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));"
              >
                <div
                  v-for="r in list"
                  :key="r.game.id"
                  class="flex items-stretch overflow-hidden rounded-md border border-default text-sm"
                >
                  <button
                    v-for="side in [{ id: r.game.awayId, p: 1 - r.homeWinProbability, at: '' }, { id: r.game.homeId, p: r.homeWinProbability, at: r.game.neutralSite ? 'vs ' : '@ ' }]"
                    :key="side.id"
                    type="button"
                    class="flex flex-1 items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-elevated/70 focus-visible:outline-2 focus-visible:outline-primary"
                    :class="picks[r.game.id] === side.id ? 'bg-elevated font-semibold text-highlighted' : picks[r.game.id] !== undefined ? 'text-dimmed' : 'text-default'"
                    :style="picks[r.game.id] === side.id ? { boxShadow: `inset 3px 0 0 ${teamsById.get(side.id)?.color ?? 'currentColor'}` } : undefined"
                    :aria-pressed="picks[r.game.id] === side.id"
                    @click="togglePick(r.game, side.id)"
                  >
                    <span
                      v-if="side.at"
                      class="text-xs text-muted"
                    >{{ side.at }}</span>
                    <img
                      :src="logo(side.id)"
                      alt=""
                      class="size-5 shrink-0 object-contain"
                    >
                    <span class="min-w-0 flex-1 truncate">{{ school(side.id) }}</span>
                    <span class="shrink-0 text-xs tabular-nums text-muted">{{ formatOdds(side.p) }}</span>
                  </button>
                </div>
              </div>
            </div>
          </template>
          <UButton
            v-if="!showAllGames && raceGames.length > GAME_LIMIT"
            size="sm"
            color="neutral"
            variant="outline"
            @click="showAllGames = true"
          >
            Show all {{ raceGames.length }} games
          </UButton>
        </div>
      </section>
    </template>
  </div>
</template>
