<script setup lang="ts">
import type { Team } from '#shared/types/schedule'

const { data: teams } = useTeams()

function shuffle(input: Team[]): Team[] {
  const result = [...input]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

const logos = computed(() => {
  const fbsTeams = (teams.value ?? []).filter(
    team => team.classification === 'fbs' && team.school !== 'BYU'
  )
  return shuffle(fbsTeams)
})
</script>

<template>
  <div
    v-if="logos.length"
    class="w-full overflow-hidden py-8 border-y border-default [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]"
  >
    <div class="marquee-track flex w-max animate-marquee gap-12">
      <div
        v-for="pass in 2"
        :key="pass"
        class="flex shrink-0 items-center gap-12"
        :aria-hidden="pass === 2"
      >
        <NuxtLink
          v-for="team in logos"
          :key="team.id"
          :to="`/team/${team.id}`"
          class="shrink-0"
        >
          <img
            :src="team.logo"
            :alt="team.school"
            loading="lazy"
            class="h-10 w-10 object-contain"
          >
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

.animate-marquee {
  animation: marquee 140s linear infinite;
}

.marquee-track:hover {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .animate-marquee {
    animation: none;
  }
}
</style>
