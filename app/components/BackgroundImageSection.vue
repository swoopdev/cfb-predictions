<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  image?: string
  link?: string
  buttonLabel?: string
}>(), {
  image: '/photo-1491466424936-e304919aada7.avif',
  link: '/contact',
  buttonLabel: 'Learn More'
})

const wrapperRef = useTemplateRef('wrapperRef')
const progress = ref(0)

function updateProgress(): void {
  if (!wrapperRef.value) return

  const rect = wrapperRef.value.getBoundingClientRect()
  const scrollableDistance = rect.height - window.innerHeight

  // Below the `lg` breakpoint the wrapper isn't tall enough to scroll
  // through (the curtain effect is desktop-only), so there's nothing to
  // pin against — treat the section as fully revealed instead of dividing
  // by a near-zero/negative distance.
  if (scrollableDistance <= 0) {
    progress.value = 1
    return
  }

  const scrolled = -rect.top
  progress.value = Math.min(Math.max(scrolled / scrollableDistance, 0), 1)
}

onMounted(() => {
  window.addEventListener('scroll', updateProgress, { passive: true })
  updateProgress()
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateProgress)
})

const curtainProgress = computed(() => progress.value)
const contentProgress = computed(() => Math.min(Math.max((progress.value - 0.6) / 0.2, 0), 1))
</script>

<template>
  <div
    ref="wrapperRef"
    class="relative lg:h-[160vh] lg:mt-[-50vh] xl:mt-[-70vh]"
  >
    <div class="relative h-[70vh] w-full overflow-hidden sm:h-[80vh] lg:sticky lg:top-0 lg:h-screen">
      <img
        :src="image"
        alt=""
        class="absolute inset-0 h-full w-full object-cover"
        :style="{ transform: `scale(${1.1 - curtainProgress * 0.1})` }"
      >

      <div class="absolute inset-0 bg-black/30" />

      <div class="relative flex h-full w-full flex-col items-center justify-center gap-6 px-6">
        <h2
          class="max-w-3xl text-center text-4xl font-bold tracking-tight text-white sm:text-6xl"
          :style="{
            opacity: contentProgress,
            transform: `translateY(${(1 - contentProgress) * 2}rem)`
          }"
        >
          {{ title }}
        </h2>

        <UButton
          :to="link"
          :label="buttonLabel"
          trailing-icon="i-lucide-arrow-right"
          color="primary"
          variant="solid"
          size="xl"
          :style="{
            opacity: contentProgress,
            transform: `translateY(${(1 - contentProgress) * 2}rem)`
          }"
        />
      </div>

      <div
        class="pointer-events-none absolute inset-0 z-20 hidden bg-default lg:block"
        :style="{ transform: `translateY(${-curtainProgress * 100}%)` }"
      />
    </div>
  </div>
</template>
