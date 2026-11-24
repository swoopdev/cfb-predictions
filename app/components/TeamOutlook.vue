<script setup lang="ts">
import { computed, toRef } from 'vue'
import type { Team } from '#shared/types/schedule'
import type { ConferenceId } from '#shared/domain/tiebreakers/types'
import type { PathCondition } from '#shared/domain/odds/paths'
import { POWER_FOUR } from '#shared/domain/playoff/formats'
import { useSeasonModelData } from '~/composables/useSeasonModelData'
import { useConferencePaths, useScenarioOdds, useScenarioState, useWinOut } from '~/composables/useScenarioOdds'
import { conferenceSlug } from '~/utils/oddsFormat'
import TeamPathPanel from './TeamPathPanel.vue'

/**
 * The team page's "how do they get there" section for the active scenario:
 * the same Path panel the conference hub shows, for one team. Keyed by
 * scenario id by its parent (RESEARCH.md Pitfall 1).
 */
const props = defineProps<{
  team: Team
  scenarioId: string
  scenarioName?: string
}>()

const seasonData = useSeasonModelData()
const { picks, scenario } = useScenarioState(props.scenarioId)
const { odds, teamOdds, computing } = useScenarioOdds(seasonData, scenario)

const isPowerFour = computed(() => (POWER_FOUR as readonly string[]).includes(props.team.conference))
const conference = computed<ConferenceId | undefined>(() => (isPowerFour.value ? props.team.conference as ConferenceId : undefined))
const { paths, computing: pathsComputing } = useConferencePaths(seasonData, scenario, conference)

const teamId = toRef(() => props.team.id)
const winOutTeam = computed(() => (paths.value?.mode === 'exact' ? undefined : teamId.value))
const { winOut, computing: winOutComputing } = useWinOut(seasonData, scenario, winOutTeam)

const teamsById = computed(() => new Map<number, Team>((seasonData.teams.data.value ?? []).map(t => [t.id, t])))

function applyPath(conditions: PathCondition[]) {
  const next = { ...picks.value }
  for (const c of conditions) next[c.gameId] = c.winnerId
  picks.value = next
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-dimmed">
        Title & playoff outlook
      </h2>
      <span class="text-xs text-muted">
        For {{ scenarioName ?? 'your scenario' }} ·
        <NuxtLink
          v-if="conference"
          :to="`/conference/${conferenceSlug(conference)}?team=${team.id}`"
          class="underline-offset-2 hover:underline"
        >whole {{ conference }} race</NuxtLink>
        <template v-if="conference">
          ·
        </template>
        <NuxtLink
          to="/playoff?view=projected"
          class="underline-offset-2 hover:underline"
        >projected bracket</NuxtLink>
      </span>
    </div>
    <USkeleton
      v-if="!seasonData.ready.value"
      class="h-40 w-full"
    />
    <TeamPathPanel
      v-else
      :team="team"
      :teams-by-id="teamsById"
      :has-title-race="isPowerFour"
      :odds="teamOdds.get(team.id)"
      :odds-computing="computing"
      :title-leverage="odds?.titleGameLeverage[team.id] ?? []"
      :playoff-leverage="odds?.playoffLeverage[team.id] ?? []"
      :paths="paths"
      :paths-computing="pathsComputing"
      :win-out="winOut"
      :win-out-computing="winOutComputing"
      :ranking-step="conference === 'SEC' ? 'scores' : 'metric'"
      @apply="applyPath"
    />
  </div>
</template>
