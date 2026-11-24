<script setup lang="ts">
import { computed } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import { CONFERENCE_SLUGS } from '~/utils/oddsFormat'

const route = useRoute()
const router = useRouter()

// Sanitized straight from the URL: an unknown slug renders the picker, never a broken hub.
const conference = computed(() => CONFERENCE_SLUGS[String(route.params.id).toLowerCase()])

useSeoMeta({
  title: () => conference.value ? `${conference.value} Title Race` : 'Title Races',
  ogTitle: () => conference.value ? `${conference.value} Title Race | Saturday Central` : 'Title Races | Saturday Central',
  description: () => conference.value
    ? `Every way each ${conference.value} team can still reach the 2026 ${conference.value} Championship Game, with title-game and playoff odds for your scenario.`
    : 'Every way each Power Four team can still reach its 2026 conference championship game.',
  ogDescription: () => conference.value
    ? `Every way each ${conference.value} team can still reach the 2026 ${conference.value} Championship Game, with title-game and playoff odds for your scenario.`
    : 'Every way each Power Four team can still reach its 2026 conference championship game.'
})

const { scenarios, activeScenarioId } = useScenarios(2026)

const selectedTeamId = computed<number | undefined>(() => {
  const raw = Number(route.query.team)
  return Number.isInteger(raw) && raw > 0 ? raw : undefined
})

function selectTeam(teamId: number) {
  router.replace({ query: { ...route.query, team: String(teamId) } as LocationQueryRaw })
}

const tabs = Object.entries(CONFERENCE_SLUGS).map(([slug, name]) => ({ slug, name }))
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
    <OddsPageHeader
      :scenarios="scenarios"
      :model-value="activeScenarioId"
      @update:model-value="id => activeScenarioId = id"
    />

    <div class="mt-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-highlighted">
          {{ conference ? `${conference} title race` : 'Title races' }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          Who can still reach the championship game, how, and what it does to their playoff chances — for the scenario you've picked.
        </p>
      </div>
      <nav
        class="flex flex-wrap gap-1"
        aria-label="Conferences"
      >
        <UButton
          v-for="tab in tabs"
          :key="tab.slug"
          :to="`/conference/${tab.slug}`"
          size="sm"
          :color="tab.name === conference ? 'primary' : 'neutral'"
          :variant="tab.name === conference ? 'solid' : 'outline'"
        >
          {{ tab.name }}
        </UButton>
      </nav>
    </div>

    <div class="mt-6">
      <ConferenceHub
        v-if="conference"
        :key="`${activeScenarioId}-${conference}`"
        :conference="conference"
        :scenario-id="activeScenarioId"
        :selected-team-id="selectedTeamId"
        @select="selectTeam"
      />
      <p
        v-else
        class="py-12 text-center text-muted"
      >
        Pick a conference above.
      </p>
    </div>
  </div>
</template>
