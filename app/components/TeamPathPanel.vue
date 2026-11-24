<script setup lang="ts">
import { computed } from 'vue'
import type { Team } from '#shared/types/schedule'
import type { GameLeverage, TeamOdds, WinOutOdds } from '#shared/domain/odds/simulate'
import type { ConferencePaths, PathCondition, TeamTitleGamePaths } from '#shared/domain/odds/paths'
import { formatDelta, formatOdds, groupPaths } from '~/utils/oddsFormat'
import type { PathGroup } from '~/utils/oddsFormat'

/**
 * "How does this team get there?" for one team, tiered by how much of the
 * season is left:
 * - late season (the conference's open games are few enough to enumerate
 *   exactly): clinched / eliminated / alive, then plain-English paths
 *   grouped by the team's own results, each with an "Apply" button that
 *   writes those results into the scenario as picks;
 * - early season: simulated odds, whether winning out is enough, and the
 *   other games worth rooting for.
 *
 * Presentational: every number comes in through props (`useScenarioOdds`,
 * `useConferencePaths`, `useWinOut`), and applying a path is an emit, so
 * the conference hub and the team page share it.
 */
const props = withDefaults(defineProps<{
  team: Team
  teamsById: Map<number, Team>
  /** Power Four teams have a title-game race; everyone else gets playoff odds only. */
  hasTitleRace: boolean
  odds?: TeamOdds
  oddsComputing?: boolean
  titleLeverage?: readonly GameLeverage[]
  playoffLeverage?: readonly GameLeverage[]
  paths?: ConferencePaths
  pathsComputing?: boolean
  winOut?: WinOutOdds
  winOutComputing?: boolean
  /** The conference's final tiebreaker step is a ranking metric (everyone but the SEC). */
  rankingStep?: 'metric' | 'scores'
  canApply?: boolean
}>(), {
  odds: undefined,
  oddsComputing: false,
  titleLeverage: () => [],
  playoffLeverage: () => [],
  paths: undefined,
  pathsComputing: false,
  winOut: undefined,
  winOutComputing: false,
  rankingStep: 'metric',
  canApply: true
})

const emit = defineEmits<{ apply: [conditions: PathCondition[]] }>()

const school = (id: number) => props.teamsById.get(id)?.school ?? 'FCS opponent'
const logo = (id: number) => props.teamsById.get(id)?.logo ?? '/logos/placeholder.svg'

const exact = computed<TeamTitleGamePaths | undefined>(() =>
  props.paths?.mode === 'exact' ? props.paths.teams.find(t => t.teamId === props.team.id) : undefined
)

const titleGameProbability = computed(() => exact.value?.probability ?? props.odds?.titleGame)

const groups = computed(() => (exact.value ? groupPaths(props.team.id, exact.value.paths) : []))
const metricGroups = computed(() => (exact.value ? groupPaths(props.team.id, exact.value.metricPaths) : []))

function sentence(conditions: readonly PathCondition[]): string {
  return conditions.map(c => `${school(c.winnerId)} beats ${school(c.loserId)}`).join(' and ')
}

function groupHeading(group: PathGroup): string {
  const head = group.own.length === 0
    ? `No matter how ${props.team.school}'s own games go`
    : `If ${sentence(group.own)}`
  if (group.options.length === 0) return `${head}, ${props.team.school} is in.`
  return group.options.length === 1 ? `${head}, plus:` : `${head}, plus any one of:`
}

const statusLine = computed(() => {
  if (!props.hasTitleRace) return null
  const e = exact.value
  if (e?.status === 'clinched') return { tone: 'success' as const, text: `Clinched a spot in the ${props.team.conference} Championship Game.` }
  if (e?.status === 'eliminated') return { tone: 'error' as const, text: 'Eliminated from the title-game race.' }
  if (e) {
    return e.controlsDestiny
      ? { tone: 'primary' as const, text: 'Controls its own destiny: win out and it\'s in.' }
      : { tone: 'warning' as const, text: 'Needs help, even by winning out.' }
  }
  const w = props.winOut
  if (!w) return null
  if (w.gamesForced === 0) return null
  return w.titleGame >= 0.995
    ? { tone: 'primary' as const, text: 'Controls its own destiny: win out and it\'s in.' }
    : { tone: 'warning' as const, text: `Needs help: even winning out, it's in the title game ${formatOdds(w.titleGame)} of the time.` }
})

interface RootRow { key: number, winnerId: number, loserId: number, delta: number }

function rootRows(rows: readonly GameLeverage[], limit: number): RootRow[] {
  return rows.slice(0, limit).map(r => ({
    key: r.gameId,
    winnerId: r.delta >= 0 ? r.homeId : r.awayId,
    loserId: r.delta >= 0 ? r.awayId : r.homeId,
    delta: Math.abs(r.delta)
  }))
}

const othersOnly = (rows: readonly GameLeverage[]) => rows.filter(r => r.homeId !== props.team.id && r.awayId !== props.team.id)
const titleRoot = computed(() => rootRows(othersOnly(props.titleLeverage), 5))
const playoffRoot = computed(() => rootRows(othersOnly(props.playoffLeverage), 5))

const tiles = computed(() => {
  const o = props.odds
  const list: { label: string, value: string, hint?: string }[] = []
  if (props.hasTitleRace) {
    list.push({ label: 'Title game', value: formatOdds(titleGameProbability.value, Boolean(exact.value)), hint: exact.value ? 'exact' : undefined })
    list.push({ label: 'Win conference', value: formatOdds(o?.conferenceTitle) })
  }
  list.push({ label: 'Make playoff', value: formatOdds(o?.playoff) })
  list.push({ label: 'First-round bye', value: formatOdds(o?.bye) })
  list.push({ label: 'Win it all', value: formatOdds(o?.nationalTitle) })
  return list
})

const STATUS_CLASS: Record<'success' | 'error' | 'primary' | 'warning', string> = {
  success: 'border-success/40 bg-success/10 text-success',
  error: 'border-error/40 bg-error/10 text-error',
  primary: 'border-primary/40 bg-primary/10 text-highlighted',
  warning: 'border-warning/40 bg-warning/10 text-highlighted'
}
</script>

<template>
  <section
    class="rounded-lg border border-default bg-elevated/40 border-l-4"
    :style="{ borderLeftColor: team.color }"
    :aria-label="`${team.school} outlook`"
  >
    <header class="flex items-center gap-3 border-b border-default p-4">
      <img
        :src="team.logo"
        alt=""
        class="size-10 shrink-0 object-contain"
        :class="{ 'dark:brightness-0 dark:invert': team.logo === '/logos/placeholder.svg' }"
      >
      <div class="min-w-0 flex-1">
        <h2 class="text-lg font-semibold text-highlighted">
          {{ team.school }}
        </h2>
        <p class="text-xs text-muted">
          {{ team.conference }}
        </p>
      </div>
      <UIcon
        v-if="oddsComputing"
        name="i-lucide-loader-circle"
        class="size-4 animate-spin text-muted"
        aria-label="Updating odds"
      />
      <NuxtLink
        :to="`/team/${team.id}`"
        class="text-xs text-muted hover:text-highlighted underline-offset-2 hover:underline"
      >
        Team page
      </NuxtLink>
    </header>

    <div class="space-y-5 p-4">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div
          v-for="tile in tiles"
          :key="tile.label"
          class="rounded-md border border-default bg-default p-2 text-center"
        >
          <div class="text-[11px] uppercase tracking-wide text-muted">
            {{ tile.label }}
          </div>
          <div class="text-lg font-semibold tabular-nums text-highlighted">
            {{ tile.value }}
          </div>
        </div>
      </div>

      <p
        v-if="statusLine"
        class="rounded-md border px-3 py-2 text-sm font-medium"
        :class="STATUS_CLASS[statusLine.tone]"
      >
        {{ statusLine.text }}
      </p>

      <!-- Late season: exact paths -->
      <div
        v-if="hasTitleRace && exact && exact.status === 'alive'"
        class="space-y-3"
      >
        <h3 class="text-xs font-semibold uppercase tracking-wide text-toned">
          How {{ team.school }} makes the title game
        </h3>
        <p
          v-if="groups.length === 0"
          class="text-sm text-muted"
        >
          No result set guarantees a spot outright — it comes down to the ranking-based tiebreaker below.
        </p>
        <div
          v-for="(group, gi) in groups"
          :key="gi"
          class="rounded-md border border-default bg-default p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <p class="text-sm font-medium text-highlighted">
              {{ groupHeading(group) }}
            </p>
            <UButton
              v-if="group.options.length === 0 && canApply"
              size="xs"
              color="neutral"
              variant="outline"
              @click="emit('apply', group.own)"
            >
              Apply
            </UButton>
          </div>
          <ul
            v-if="group.options.length > 0"
            class="mt-2 space-y-1.5"
          >
            <li
              v-for="(option, oi) in group.options"
              :key="oi"
              class="flex items-start justify-between gap-3 text-sm"
            >
              <span class="text-default">{{ sentence(option) }}</span>
              <UButton
                v-if="canApply"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="emit('apply', [...group.own, ...option])"
              >
                Apply
              </UButton>
            </li>
          </ul>
        </div>
        <p
          v-if="exact.morePaths > 0"
          class="text-xs text-muted"
        >
          …and {{ exact.morePaths }} more, less likely combination{{ exact.morePaths === 1 ? '' : 's' }}. Pick a few games to narrow it down.
        </p>

        <div
          v-if="metricGroups.length > 0"
          class="rounded-md border border-dashed border-default p-3"
        >
          <p class="text-sm font-medium text-highlighted">
            Could also get in on the final tiebreaker if:
          </p>
          <ul class="mt-2 space-y-1.5">
            <li
              v-for="(group, gi) in metricGroups"
              :key="gi"
              class="text-sm text-default"
            >
              <template v-if="group.options.length === 0">
                {{ sentence(group.own) || 'Nothing else changes' }}
              </template>
              <template v-else>
                {{ group.own.length ? `${sentence(group.own)}, plus ` : '' }}{{ group.options.map(sentence).join(' — or — ') }}
              </template>
            </li>
          </ul>
          <p class="mt-2 text-xs text-muted">
            <template v-if="rankingStep === 'metric'">
              Those ties are settled by a ranking metric that isn't published in advance; the odds above estimate it from SP+.
            </template>
            <template v-else>
              The SEC settles those ties on scoring margins, which a winner pick can't express; the odds above estimate it from SP+.
            </template>
          </p>
        </div>
      </div>

      <p
        v-else-if="hasTitleRace && pathsComputing && !exact"
        class="text-sm text-muted"
      >
        Working out every path…
      </p>

      <!-- Early season: win-out summary -->
      <div
        v-if="!exact && winOut && winOut.gamesForced > 0"
        class="rounded-md border border-default bg-default p-3 text-sm"
      >
        <p class="font-medium text-highlighted">
          If {{ team.school }} wins its last {{ winOut.gamesForced }} game{{ winOut.gamesForced === 1 ? '' : 's' }}:
        </p>
        <p class="mt-1 text-default">
          <template v-if="hasTitleRace">
            Title game {{ formatOdds(winOut.titleGame) }} ·
          </template>
          Playoff {{ formatOdds(winOut.playoff) }} · Bye {{ formatOdds(winOut.bye) }}
        </p>
      </div>
      <p
        v-else-if="!exact && winOutComputing"
        class="text-sm text-muted"
      >
        Simulating a win-out…
      </p>

      <div
        v-if="(hasTitleRace && titleRoot.length > 0) || playoffRoot.length > 0"
        class="grid gap-4 sm:grid-cols-2"
      >
        <div v-if="hasTitleRace && titleRoot.length > 0">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-toned">
            Root for · title game
          </h3>
          <ul class="space-y-1.5">
            <li
              v-for="row in titleRoot"
              :key="row.key"
              class="flex items-center gap-2 text-sm"
            >
              <img
                :src="logo(row.winnerId)"
                alt=""
                class="size-5 shrink-0 object-contain"
              >
              <span class="min-w-0 flex-1 truncate">
                <span class="text-highlighted">{{ school(row.winnerId) }}</span>
                <span class="text-muted"> over {{ school(row.loserId) }}</span>
              </span>
              <span class="shrink-0 tabular-nums text-xs text-muted">{{ formatDelta(row.delta) }} pts</span>
            </li>
          </ul>
        </div>
        <div v-if="playoffRoot.length > 0">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-toned">
            Root for · playoff
          </h3>
          <ul class="space-y-1.5">
            <li
              v-for="row in playoffRoot"
              :key="row.key"
              class="flex items-center gap-2 text-sm"
            >
              <img
                :src="logo(row.winnerId)"
                alt=""
                class="size-5 shrink-0 object-contain"
              >
              <span class="min-w-0 flex-1 truncate">
                <span class="text-highlighted">{{ school(row.winnerId) }}</span>
                <span class="text-muted"> over {{ school(row.loserId) }}</span>
              </span>
              <span class="shrink-0 tabular-nums text-xs text-muted">{{ formatDelta(row.delta) }} pts</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
