<script setup lang="ts">
import { P4_CONFERENCES } from '#shared/domain/standings'

// The homepage's title IS the brand statement — opt out of the site-wide
// "| Saturday Central" suffix (app.vue's titleTemplate) rather than pushing
// an already-long title past what search results display in full.
useHead({ titleTemplate: title => title ?? null })

useSeoMeta({
  title: 'Predict Every Game. Get Real Standings and Tiebreakers.',
  ogTitle: 'Predict Every Game. Get Real Standings and Tiebreakers.',
  description: 'Most bracket tools guess at standings. This one runs each conference\'s actual published tiebreaker rules, so your predicted championship matchups are the real ones.',
  ogDescription: 'Most bracket tools guess at standings. This one runs each conference\'s actual published tiebreaker rules, so your predicted championship matchups are the real ones.'
})

const { data: teams } = useTeams()

const CONFERENCE_DESCRIPTIONS: Record<string, string> = {
  'SEC': 'No divisions, no easy weeks — every team chases one conference table, and the depth of the league means an upset can come from almost anywhere on the schedule.',
  'Big Ten': 'A coast-to-coast footprint and some of the sport\'s oldest rivalries, now spread across a single conference table instead of East and West divisions.',
  'Big 12': 'No divisions, no play-in game — every team chases one conference table, so a single upset in October can reshuffle the whole championship picture.',
  'ACC': 'A wide-open mix of blue-blood programs and rising ones, stretched coast to coast, chasing one conference table with no divisions to sort them into.'
}

const conferenceSections = computed(() => P4_CONFERENCES.map(conference => ({
  conference,
  description: CONFERENCE_DESCRIPTIONS[conference] ?? 'Pick every matchup, and the conference standings, tiebreakers, and championship game matchup fall into place automatically.',
  href: `/week/1?conf=${encodeURIComponent(conference)}`,
  logos: (teams.value ?? [])
    .filter(team => team.conference === conference && team.classification === 'fbs')
})))

const features = [
  {
    icon: 'i-lucide-swords',
    title: 'Every FBS Game',
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

    <HeroSection />

    <FeaturesSection
      title="How it works"
      description="Everything you need to call your own version of the 2026 season, from kickoff week to the conference championships."
      :items="features"
      class="relative z-20"
    />

    <TextImageSection
      v-for="(section, index) in conferenceSections"
      :key="section.conference"
      :title="`Predict Every ${section.conference} Game`"
      :description="section.description"
      :reverse="index % 2 === 1"
      :button="{
        label: `Pick the ${section.conference}`,
        color: 'primary',
        trailingIcon: 'i-lucide-arrow-right',
        to: section.href
      }"
      class="relative z-20"
    >
      <NuxtLink
        :to="section.href"
        class="grid grid-cols-4 place-items-center gap-4 rounded-2xl border border-default bg-elevated/50 p-8 sm:grid-cols-5"
        :aria-label="`Predict ${section.conference} games`"
      >
        <img
          v-for="team in section.logos"
          :key="team.id"
          :src="team.logo"
          :alt="team.school"
          class="size-10 object-contain sm:size-12"
        >
      </NuxtLink>
    </TextImageSection>

    <BackgroundImageSection
      title="Every Saturday"
      image="/G6A5995.jpg"
      link="/week/1"
      button-label="Pick the Games"
    />

    <AppFooter />
  </div>
</template>
