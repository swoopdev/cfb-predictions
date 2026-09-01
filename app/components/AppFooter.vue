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
    label: 'Championship Week',
    to: '/week/14'
  }]
}, {
  label: 'Conferences',
  children: [{
    label: 'SEC',
    to: '/week/1?conf=SEC'
  }, {
    label: 'Big Ten',
    to: '/week/1?conf=Big%20Ten'
  }, {
    label: 'Big 12',
    to: '/week/1?conf=Big%2012'
  }, {
    label: 'ACC',
    to: '/week/1?conf=ACC'
  }]
}, {
  label: 'Site',
  children: [{
    label: 'Home',
    to: '/'
  }, {
    label: 'Team Pages',
    to: '/teams'
  }]
}]
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
