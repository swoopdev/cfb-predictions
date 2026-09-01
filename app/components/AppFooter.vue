<script setup lang="ts">
const columns = [{
  label: 'Predictor',
  children: [{
    label: 'Start Predicting',
    to: '/week/1'
  }, {
    label: 'Weekly Schedule',
    to: '/week/1'
  }, {
    label: 'Team Pages',
    to: '/teams'
  }]
}, {
  label: 'How It Works',
  children: [{
    label: 'Conference Standings',
    to: '/#standings'
  }, {
    label: 'Tiebreaker Rules',
    to: '/#standings'
  }, {
    label: 'Scenarios & Sharing',
    to: '/#scenarios'
  }]
}]

const socialLinks = [
  { icon: 'i-simple-icons-x', label: 'X' }
]
</script>

<template>
  <USeparator class="h-px" />

  <UFooter :ui="{ top: 'border-b border-default' }">
    <template #top>
      <UContainer>
        <UFooterColumns :columns="columns" />
      </UContainer>
    </template>

    <template #left>
      <div class="space-y-2">
        <p class="text-sm font-medium">
          Saturday Central
        </p>
        <p class="text-muted text-sm">
          Pick every FBS game. Watch standings and tiebreakers settle themselves.
        </p>
        <p class="text-muted text-xs">
          © {{ new Date().getFullYear() }} Saturday Central. All rights reserved.
        </p>

        <div class="flex items-center gap-1 pt-1">
          <UButton
            v-for="social in socialLinks"
            :key="social.label"
            :icon="social.icon"
            :aria-label="social.label"
            to="#"
            color="neutral"
            variant="ghost"
            size="sm"
          />
        </div>
      </div>
    </template>

    <template #right>
      <UButton
        to="/week/1"
        color="primary"
        variant="subtle"
        size="lg"
        label="Predict the Season"
      />
    </template>
  </UFooter>
</template>
