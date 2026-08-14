<script setup lang="ts">
// `useId` is imported explicitly from 'vue' rather than taken from Nuxt's
// auto-import, so this component mounts in a plain vitest run (the project's
// vitest config registers no Nuxt auto-import plugin — see GameCard.test.ts's
// note on why its component was left untestable).
import { useId } from 'vue'
import type { StandingsTeam } from '#shared/types/standings'

/**
 * Renders ONE conference's standings (D-03: a real `<table>`, not cards —
 * the familiar sports format is what makes it scannable at a glance).
 *
 * Deliberately dumb: it takes an already-ranked, already-sorted
 * `StandingsTeam[]` and renders it. All ordering and rank assignment lives in
 * `computeStandings()`, so Phase 6 can reuse this component against a
 * manually-resolved ranking with no changes here.
 *
 * Ties need no badge, icon, or tooltip (D-05/D-06) — matching rank numbers
 * next to matching W-L values are the indication.
 */
defineProps<{
  standings: StandingsTeam[]
  conferenceName: string
}>()

const headingId = useId()
</script>

<template>
  <section :aria-labelledby="headingId">
    <h3
      :id="headingId"
      class="text-xs font-semibold uppercase tracking-wide text-dimmed mb-2"
    >
      {{ conferenceName }}
    </h3>

    <p
      v-if="standings.length === 0"
      class="text-sm text-dimmed"
    >
      No teams to show for {{ conferenceName }}.
    </p>

    <table
      v-else
      class="w-full text-sm"
    >
      <caption class="sr-only">
        {{ conferenceName }} standings: rank, team, overall record, conference record
      </caption>
      <thead>
        <tr class="border-b border-default text-[10px] uppercase tracking-wide text-dimmed">
          <th
            scope="col"
            class="w-6 py-1.5 pr-2 text-left font-medium"
          >
            Rank
          </th>
          <th
            scope="col"
            class="py-1.5 pr-2 text-left font-medium"
          >
            Team
          </th>
          <!-- D-08/D-09: overall first, conference second, both spelled out
               so the two measurement axes can't be confused. -->
          <th
            scope="col"
            class="py-1.5 pr-2 text-right font-medium"
          >
            Overall Record
          </th>
          <th
            scope="col"
            class="py-1.5 text-right font-medium"
          >
            Conf Record
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr
          v-for="team in standings"
          :key="team.id"
        >
          <td class="py-1.5 pr-2 text-left tabular-nums text-muted">
            {{ team.rank }}
          </td>
          <th
            scope="row"
            class="py-1.5 pr-2 text-left font-normal text-highlighted"
          >
            {{ team.school }}
          </th>
          <td class="py-1.5 pr-2 text-right tabular-nums text-muted">
            {{ team.overallRecord.wins }}-{{ team.overallRecord.losses }}
          </td>
          <td class="py-1.5 text-right tabular-nums text-default">
            {{ team.confRecord.wins }}-{{ team.confRecord.losses }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
