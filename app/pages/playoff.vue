<script setup lang="ts">
useSeoMeta({
  title: 'College Football Playoff Bracket',
  ogTitle: 'College Football Playoff Bracket | Saturday Central',
  description: 'The 2026 College Football Playoff bracket if the season ended today, and projected from your own picks — pick every game through the national championship.',
  ogDescription: 'The 2026 College Football Playoff bracket if the season ended today, and projected from your own picks — pick every game through the national championship.'
})

const { scenarios, activeScenarioId } = useScenarios(2026)
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
    <OddsPageHeader
      :scenarios="scenarios"
      :model-value="activeScenarioId"
      @update:model-value="id => activeScenarioId = id"
    />

    <div class="mt-6">
      <h1 class="text-2xl font-semibold text-highlighted">
        College Football Playoff
      </h1>
      <p class="mt-1 text-sm text-muted">
        12 teams: automatic bids for the four Power Four champions, the top Group of Six champion and Notre Dame if it's in the top 12, the rest at-large.
        Seeded straight by ranking; the top four get a bye and seeds 5–8 host first-round games.
      </p>
    </div>

    <div class="mt-6">
      <PlayoffView
        :key="activeScenarioId"
        :scenario-id="activeScenarioId"
      />
    </div>
  </div>
</template>
