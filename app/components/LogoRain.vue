<script setup lang="ts">
import type { Team } from '#shared/types/schedule'

interface Drop {
  key: string
  team: Team
  left: number
  size: number
  delay: number
  opacity: number
}

const { data: teams } = useTeams()

const DROP_COUNT = 14
const FALL_DURATION = 30

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

const drops = ref<Drop[]>([])

watch(teams, (value) => {
  if (!value || drops.value.length) return

  const fbsTeams = value.filter(team => team.classification === 'fbs' && team.school !== 'BYU')
  if (!fbsTeams.length) return

  const columnWidth = 100 / DROP_COUNT

  drops.value = Array.from({ length: DROP_COUNT }, (_, index) => ({
    key: `${index}-${Date.now()}`,
    team: fbsTeams[Math.floor(Math.random() * fbsTeams.length)]!,
    left: randomBetween(index * columnWidth, (index + 1) * columnWidth),
    size: randomBetween(32, 56),
    delay: randomBetween(-FALL_DURATION, 0),
    opacity: randomBetween(0.35, 0.6)
  }))
}, { immediate: true })
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(circle_at_center,transparent_0%,transparent_30%,black_70%)]"
    aria-hidden="true"
  >
    <img
      v-for="drop in drops"
      :key="drop.key"
      :src="drop.team.logo"
      :alt="drop.team.school"
      class="animate-fall absolute top-0 object-contain"
      :style="{
        'left': `${drop.left}%`,
        'width': `${drop.size}px`,
        'height': `${drop.size}px`,
        '--drop-opacity': drop.opacity,
        'animationDuration': `${FALL_DURATION}s`,
        'animationDelay': `${drop.delay}s`
      }"
    >
  </div>
</template>

<style scoped>
@keyframes fall {
  0% {
    transform: translateY(-10%);
    opacity: 0;
  }
  10% {
    opacity: var(--drop-opacity);
  }
  90% {
    opacity: var(--drop-opacity);
  }
  100% {
    transform: translateY(110vh);
    opacity: 0;
  }
}

.animate-fall {
  animation-name: fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .animate-fall {
    animation: none;
    display: none;
  }
}
</style>
