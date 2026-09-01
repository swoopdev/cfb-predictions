<script setup>
useHead({
  titleTemplate: title => title ? `${title} | Saturday Central` : 'Saturday Central — College Football Predictions',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.png', type: 'image/png' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

// Site-wide fallback — every page (index.vue included) sets its own
// useSeoMeta title/description that overrides this, so search results and
// social shares are never identical across pages (the pre-SEO-pass state).
const description = 'Predict every FBS college football game, get real conference standings and tiebreakers, and share your scenario with a link.'

useSeoMeta({
  description,
  ogDescription: description,
  ogSiteName: 'Saturday Central',
  ogType: 'website',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
