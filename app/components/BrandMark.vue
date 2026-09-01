<script setup lang="ts">
// Extracted from AppHeader.vue's `#left` slot so the same "Saturday
// Central" logo mark (favicon + script wordmark) can render consistently
// on pages that don't use the full AppHeader nav -- the picks page already
// has its own dense header (week nav, filters, fill/clear), and the teams
// pages have their own back-link header, so pulling in the whole AppHeader
// there would double up navigation rather than just add branding.
</script>

<template>
  <NuxtLink
    to="/"
    class="flex shrink-0 items-center gap-2"
  >
    <img
      src="/brand-mark.png"
      alt=""
      class="size-7"
    >
    <span class="font-script text-2xl leading-loose text-primary">Saturday Central</span>
  </NuxtLink>
</template>
