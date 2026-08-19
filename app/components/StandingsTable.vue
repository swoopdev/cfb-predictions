<script setup lang="ts">
// `computed`/`useId` are imported explicitly from 'vue', and ChampionshipCard
// is imported relatively rather than through Nuxt's component auto-import, so
// this component mounts in a plain vitest run (the project's vitest config
// registers no Nuxt auto-import plugin — see GameCard.test.ts's note on why
// its component was left untestable).
import { computed, useId } from 'vue'
import type { StandingsTeam } from '#shared/types/standings'
import type { ConferenceRanking } from '#shared/domain/tiebreakers/types'
import ChampionshipCard from './ChampionshipCard.vue'

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
 *
 * `ranking` (Plan 06-04, TIE-07): the ONLY new prop this component gains.
 * Threaded straight through to `ChampionshipCard`, which reads the
 * championship matchup off it via `championshipFor` -- never off this
 * component's own row order (D-12). Also the prop Plan 07's rank markers
 * read from, so its shape and threading are settled here.
 */
const props = defineProps<{
  standings: readonly StandingsTeam[]
  conferenceName: string
  ranking?: ConferenceRanking | undefined
}>()

const headingId = useId()

/**
 * §5.1/Task 3: built from the SAME `standings` rows already passed in --
 * every row already carries `id` and `school`, so `ChampionshipCard` needs
 * no separate teams data source. An empty `standings` array (not-yet-loaded
 * or a genuinely empty conference) yields an empty map, which is exactly the
 * signal `ChampionshipCard`'s loading state reads (see that component's
 * `state` computed).
 */
const schoolById = computed<ReadonlyMap<number, string>>(
  () => new Map(props.standings.map(team => [team.id, team.school]))
)

/**
 * §10 empty-state predicate: true when any row has at least one picked
 * conference game. A picked conference game always produces exactly one win
 * and one loss for its two participants, so summing `confRecord` per row is
 * equivalent to counting picked conference games directly, without pulling
 * the games slate into this component.
 */
const hasPickedConferenceGames = computed<boolean>(() =>
  props.standings.some(team => team.confRecord.wins + team.confRecord.losses > 0)
)
</script>

<template>
  <section :aria-labelledby="headingId">
    <!-- `text-toned`, not `text-dimmed`: with four conferences stacked in the
         sidebar this heading is the primary wayfinding element, not a
         de-emphasised label. -->
    <h3
      :id="headingId"
      class="text-xs font-semibold uppercase tracking-wide text-toned mb-2"
    >
      {{ conferenceName }}
    </h3>

    <!-- Task 3/§5.1: rendered between the heading and the table, inside this
         SAME `<section>` -- placing it in `StandingsSidebar` instead would
         put it above the heading and break the `aria-labelledby` grouping.
         Guarded by the same zero-teams check as the table itself: no card
         (and no table) when a conference genuinely has no rows. -->
    <ChampionshipCard
      v-if="standings.length > 0"
      :ranking="ranking"
      :school-by-id="schoolById"
      :has-picked-conference-games="hasPickedConferenceGames"
    />

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
      <!-- `text-xs` + `text-muted` rather than a 10px dimmed label: CLAUDE.md
           requires contrast to hold up at small sizes in BOTH themes, and
           dimmed-on-default at 10px is the first thing to fail that in light
           mode. `w-8` on the rank column fits the two-digit ranks that an
           18-team Big Ten produces without the column reflowing. -->
      <thead>
        <tr class="border-b border-default text-xs uppercase tracking-wide text-muted">
          <th
            scope="col"
            class="w-8 py-1.5 pr-2 text-left font-medium"
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
          class="hover:bg-elevated/60 transition-colors"
        >
          <!-- The rank column carries the entire tie signal (D-05/D-06: no
               badge, no icon, no tooltip), so it is left-aligned, tabular and
               at full text weight — three teams sharing a `2` have to be
               obvious in a single downward glance, which a dimmed
               right-aligned number is not. -->
          <td class="py-1.5 pr-2 text-left tabular-nums font-medium text-default">
            {{ team.rank }}
          </td>
          <!-- No `truncate`/`nowrap`: at the sidebar's 320px the longest P4
               school ("Mississippi State") fits, and if a narrower viewport
               forces it, wrapping is the correct failure — a clipped team
               name is not. -->
          <th
            scope="row"
            class="py-1.5 pr-2 text-left font-normal text-highlighted"
          >
            {{ team.school }}
          </th>
          <td class="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap text-muted">
            {{ team.overallRecord.wins }}-{{ team.overallRecord.losses }}
          </td>
          <td class="py-1.5 text-right tabular-nums whitespace-nowrap text-default">
            {{ team.confRecord.wins }}-{{ team.confRecord.losses }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
