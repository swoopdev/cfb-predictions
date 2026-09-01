<script setup lang="ts">
const features = [
  {
    icon: 'i-lucide-swords',
    title: 'Every FBS game, one pick at a time',
    description: 'Work through the full 2026 schedule week by week and choose a winner for every matchup on the board.'
  },
  {
    icon: 'i-lucide-trophy',
    title: 'Standings that update instantly',
    description: 'Conference records, divisions, and championship pictures recompute the moment you make a pick — no refresh, no waiting.'
  },
  {
    icon: 'i-lucide-scale',
    title: 'Real tiebreaker rules',
    description: 'Each power conference\'s published tiebreaker procedure runs automatically to resolve who plays in the championship game.'
  },
  {
    icon: 'i-lucide-layers',
    title: 'Multiple scenarios',
    description: 'Keep several named what-if brackets side by side — upset-heavy, chalk, or anything in between — and switch between them anytime.'
  },
  {
    icon: 'i-lucide-share-2',
    title: 'Share with a link',
    description: 'Send a scenario to a friend with a single URL. No account, no sign-up — it\'s all encoded right in the link.'
  },
  {
    icon: 'i-lucide-shield-check',
    title: 'Runs entirely in your browser',
    description: 'Picks are saved to your device with localStorage. Nothing is sent to a server, and nothing disappears between visits.'
  }
]
</script>

<template>
  <div>
    <AppHeader />

    <Hero />

    <UPageSection
      id="how-it-works"
      title="How it works"
      description="Three steps between you and a fully predicted college football season."
    >
      <UPageGrid>
        <UPageCard
          v-for="(feature, index) in features"
          :key="index"
          :icon="feature.icon"
          :title="feature.title"
          :description="feature.description"
          spotlight
        />
      </UPageGrid>
    </UPageSection>

    <UPageSection
      id="standings"
      title="Built for the tiebreaker rabbit hole"
      description="If the standings math or the tiebreaker resolution is wrong, nothing else about a season predictor matters. That's the one thing this app is obsessive about getting right — division races, head-to-head, and each conference's own championship-game procedure, all recomputed correctly and instantly as you pick."
      orientation="horizontal"
      reverse
      :ui="{ container: 'lg:gap-16' }"
    >
      <UPageCard
        title="Live conference standings"
        description="Every pick flows straight through to records, divisions, and the championship game matchup — updated the instant you make it."
        icon="i-lucide-list-ordered"
        variant="subtle"
      />
    </UPageSection>

    <UPageSection
      id="scenarios"
      title="Play out more than one future"
      description="Save as many named scenarios as you want, come back to them later, and share any of them with a link. Everything lives in your browser — pick a winner, and watch the whole season fall into place."
      :links="[{
        label: 'Predict the Season',
        trailingIcon: 'i-lucide-arrow-right',
        to: '/week/1',
        size: 'xl'
      }]"
    />

    <AppFooter />
  </div>
</template>
