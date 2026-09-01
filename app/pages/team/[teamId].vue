<script setup lang="ts">
import { computed } from 'vue'
import { useTeams } from '~/composables/useTeams'
import { useGames } from '~/composables/useGames'
import { useCoaches } from '~/composables/useCoaches'
import { useRecords } from '~/composables/useRecords'
import { useRecruiting } from '~/composables/useRecruiting'
import { useTeamRatings } from '~/composables/useTeamRatings'
import { useTeamStats } from '~/composables/useTeamStats'
import { usePlayerStats } from '~/composables/usePlayerStats'
import { computeTeamStatLeaders } from '~/utils/statLeaders'

const route = useRoute()
// Coerce once, same reasoning as week/[week].vue's `week` param (RESEARCH.md
// Pitfall 3: a string/number id comparison silently matches nothing).
const teamId = computed(() => Number(route.params.teamId))

const { data: teams, isPending: teamsPending, isError: teamsError } = useTeams()
const { data: games } = useGames()
const { data: coaches } = useCoaches()
const { data: records } = useRecords()
const { data: recruiting } = useRecruiting()
const { data: teamRatings } = useTeamRatings()
const { data: teamStats } = useTeamStats()
const { data: playerStats } = usePlayerStats()

const teamsById = computed(() => new Map((teams.value ?? []).map(t => [t.id, t])))
const team = computed(() => teamsById.value.get(teamId.value))

const coach = computed(() => coaches.value?.coaches.find(c => c.teamId === teamId.value))
const record = computed(() => records.value?.records.find(r => r.teamId === teamId.value))
const recruit = computed(() => recruiting.value?.recruiting.find(r => r.teamId === teamId.value))
const rating = computed(() => teamRatings.value?.ratings.find(r => r.teamId === teamId.value))
const stats = computed(() => teamStats.value?.teamStats.find(s => s.teamId === teamId.value)?.stats)
const leaders = computed(() => computeTeamStatLeaders(playerStats.value?.playerStats ?? [], teamId.value))

const schedule = computed(() => {
  return (games.value?.games ?? [])
    .filter(g => g.homeId === teamId.value || g.awayId === teamId.value)
    .sort((a, b) => a.week - b.week)
    .map((g) => {
      const isHome = g.homeId === teamId.value
      const opponentId = isHome ? g.awayId : g.homeId
      const opponentName = isHome ? g.awayTeam : g.homeTeam
      const opponent = teamsById.value.get(opponentId)
      const teamPoints = isHome ? g.homePoints : g.awayPoints
      const opponentPoints = isHome ? g.awayPoints : g.homePoints
      const result = g.completed && teamPoints !== null && opponentPoints !== null
        ? { win: teamPoints > opponentPoints, teamPoints, opponentPoints }
        : null
      return { game: g, isHome, opponentName, opponentLogo: opponent?.logo, result }
    })
})

// Key team-stats totals worth surfacing on the page -- CFBD's `statName`
// list isn't fixed/documented (see teamStats.ts), so this is a curated
// display subset rather than rendering every key that happens to be present.
const STAT_DISPLAY_ORDER: { key: string, label: string }[] = [
  { key: 'totalYards', label: 'Total yards' },
  { key: 'netPassingYards', label: 'Passing yards' },
  { key: 'rushingYards', label: 'Rushing yards' },
  { key: 'turnovers', label: 'Turnovers' },
  { key: 'sacks', label: 'Sacks' },
  { key: 'penaltyYards', label: 'Penalty yards' }
]
const displayStats = computed(() => {
  if (!stats.value) return []
  return STAT_DISPLAY_ORDER
    .filter(s => stats.value![s.key] !== undefined)
    .map(s => ({ label: s.label, value: stats.value![s.key] }))
})

const loadState = computed<'loading' | 'error' | 'ready'>(() => {
  if (teamsError.value) return 'error'
  if (teamsPending.value) return 'loading'
  return 'ready'
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
    <UButton
      to="/teams"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      size="sm"
      class="mb-4"
    >
      All teams
    </UButton>

    <div
      v-if="loadState === 'loading'"
      class="text-center text-dimmed py-12"
    >
      Loading…
    </div>
    <div
      v-else-if="loadState === 'error' || !team"
      class="text-center text-dimmed py-12"
    >
      Couldn't find that team.
    </div>

    <template v-else>
      <!-- Header -->
      <div
        class="mb-6 flex flex-col items-center gap-3 rounded-lg border-t-4 bg-elevated p-6 text-center sm:flex-row sm:text-left"
        :style="{ borderColor: team.color }"
      >
        <img
          :src="team.logo"
          class="size-16 shrink-0"
          :class="{ 'dark:brightness-0 dark:invert': team.logo === '/logos/placeholder.svg' }"
          alt=""
        >
        <div class="min-w-0">
          <h1 class="text-xl font-semibold">
            {{ team.school }}
            <span
              v-if="team.mascot"
              class="text-dimmed font-normal"
            >{{ team.mascot }}</span>
          </h1>
          <p class="text-sm text-dimmed">
            {{ team.conference }}
            <template v-if="coach">
              · {{ coach.firstName }} {{ coach.lastName }}
            </template>
          </p>
        </div>
      </div>

      <!-- Record + coach + recruiting -->
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-lg border border-default bg-elevated p-3 text-center">
          <div class="text-xs text-dimmed">
            Record
          </div>
          <div class="text-lg font-semibold tabular-nums">
            {{ record ? `${record.total.wins}-${record.total.losses}${record.total.ties ? `-${record.total.ties}` : ''}` : '—' }}
          </div>
        </div>
        <div class="rounded-lg border border-default bg-elevated p-3 text-center">
          <div class="text-xs text-dimmed">
            Conference
          </div>
          <div class="text-lg font-semibold tabular-nums">
            {{ record ? `${record.conferenceGames.wins}-${record.conferenceGames.losses}` : '—' }}
          </div>
        </div>
        <div class="rounded-lg border border-default bg-elevated p-3 text-center">
          <div class="text-xs text-dimmed">
            SP+ rank
          </div>
          <div class="text-lg font-semibold tabular-nums">
            {{ rating?.spRanking ? `#${rating.spRanking}` : '—' }}
          </div>
        </div>
        <div class="rounded-lg border border-default bg-elevated p-3 text-center">
          <div class="text-xs text-dimmed">
            Recruiting
          </div>
          <div class="text-lg font-semibold tabular-nums">
            {{ recruit ? `#${recruit.rank}` : '—' }}
          </div>
        </div>
      </div>

      <!-- Coach career -->
      <div
        v-if="coach"
        class="mb-6 rounded-lg border border-default bg-elevated p-4"
      >
        <h2 class="mb-2 text-sm font-semibold text-dimmed uppercase tracking-wide">
          Head coach
        </h2>
        <p class="text-sm">
          {{ coach.firstName }} {{ coach.lastName }}
        </p>
        <p class="text-xs text-dimmed">
          Career: {{ coach.careerRecord.wins }}-{{ coach.careerRecord.losses }}{{ coach.careerRecord.ties ? `-${coach.careerRecord.ties}` : '' }}
          ({{ coach.careerRecord.firstYear }}–{{ coach.careerRecord.lastYear }})
        </p>
      </div>

      <!-- SP+ breakdown -->
      <div
        v-if="rating?.spOffense || rating?.spDefense"
        class="mb-6 rounded-lg border border-default bg-elevated p-4"
      >
        <h2 class="mb-3 text-sm font-semibold text-dimmed uppercase tracking-wide">
          SP+ breakdown
        </h2>
        <div class="grid grid-cols-2 gap-4">
          <div v-if="rating.spOffense">
            <div class="text-xs text-dimmed">
              Offense
            </div>
            <div class="text-lg font-semibold tabular-nums">
              {{ rating.spOffense.rating.toFixed(1) }}
              <span
                v-if="rating.spOffense.ranking"
                class="text-xs text-dimmed font-normal"
              >#{{ rating.spOffense.ranking }}</span>
            </div>
          </div>
          <div v-if="rating.spDefense">
            <div class="text-xs text-dimmed">
              Defense
            </div>
            <div class="text-lg font-semibold tabular-nums">
              {{ rating.spDefense.rating.toFixed(1) }}
              <span
                v-if="rating.spDefense.ranking"
                class="text-xs text-dimmed font-normal"
              >#{{ rating.spDefense.ranking }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Team stats -->
      <div
        v-if="displayStats.length > 0"
        class="mb-6 rounded-lg border border-default bg-elevated p-4"
      >
        <h2 class="mb-3 text-sm font-semibold text-dimmed uppercase tracking-wide">
          Season stats
        </h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div
            v-for="s in displayStats"
            :key="s.label"
          >
            <div class="text-xs text-dimmed">
              {{ s.label }}
            </div>
            <div class="text-base font-semibold tabular-nums">
              {{ s.value }}
            </div>
          </div>
        </div>
      </div>

      <!-- Stat leaders -->
      <div
        v-if="leaders.passing.length || leaders.rushing.length || leaders.receiving.length"
        class="mb-6 rounded-lg border border-default bg-elevated p-4"
      >
        <h2 class="mb-3 text-sm font-semibold text-dimmed uppercase tracking-wide">
          Stat leaders
        </h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div v-if="leaders.passing.length">
            <div class="mb-1 text-xs text-dimmed">
              Passing yards
            </div>
            <ul class="space-y-1">
              <li
                v-for="l in leaders.passing"
                :key="l.playerId"
                class="text-sm flex justify-between gap-2"
              >
                <span class="truncate">{{ l.player }}<span
                  v-if="l.jersey"
                  class="text-dimmed"
                > #{{ l.jersey }}</span></span>
                <span class="tabular-nums shrink-0">{{ l.value }}</span>
              </li>
            </ul>
          </div>
          <div v-if="leaders.rushing.length">
            <div class="mb-1 text-xs text-dimmed">
              Rushing yards
            </div>
            <ul class="space-y-1">
              <li
                v-for="l in leaders.rushing"
                :key="l.playerId"
                class="text-sm flex justify-between gap-2"
              >
                <span class="truncate">{{ l.player }}<span
                  v-if="l.jersey"
                  class="text-dimmed"
                > #{{ l.jersey }}</span></span>
                <span class="tabular-nums shrink-0">{{ l.value }}</span>
              </li>
            </ul>
          </div>
          <div v-if="leaders.receiving.length">
            <div class="mb-1 text-xs text-dimmed">
              Receiving yards
            </div>
            <ul class="space-y-1">
              <li
                v-for="l in leaders.receiving"
                :key="l.playerId"
                class="text-sm flex justify-between gap-2"
              >
                <span class="truncate">{{ l.player }}<span
                  v-if="l.jersey"
                  class="text-dimmed"
                > #{{ l.jersey }}</span></span>
                <span class="tabular-nums shrink-0">{{ l.value }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Schedule -->
      <div class="rounded-lg border border-default bg-elevated p-4">
        <h2 class="mb-3 text-sm font-semibold text-dimmed uppercase tracking-wide">
          Schedule
        </h2>
        <ul class="divide-y divide-default">
          <li
            v-for="row in schedule"
            :key="row.game.id"
            class="flex items-center gap-3 py-2"
          >
            <span class="w-6 shrink-0 text-xs text-dimmed tabular-nums">{{ row.game.week }}</span>
            <img
              v-if="row.opponentLogo"
              :src="row.opponentLogo"
              class="size-6 shrink-0"
              :class="{ 'dark:brightness-0 dark:invert': row.opponentLogo === '/logos/placeholder.svg' }"
              alt=""
            >
            <span class="min-w-0 flex-1 truncate text-sm">
              <span class="text-dimmed">{{ row.isHome ? 'vs' : '@' }}</span> {{ row.opponentName }}
            </span>
            <span
              v-if="row.result"
              class="shrink-0 text-sm font-semibold tabular-nums"
              :class="row.result.win ? 'text-success' : 'text-error'"
            >
              {{ row.result.win ? 'W' : 'L' }} {{ row.result.teamPoints }}-{{ row.result.opponentPoints }}
            </span>
            <span
              v-else
              class="shrink-0 text-xs text-dimmed"
            >Upcoming</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
