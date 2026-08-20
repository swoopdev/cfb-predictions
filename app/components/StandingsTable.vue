<script setup lang="ts">
// `computed`/`ref`/`useId` are imported explicitly from 'vue', and both
// ChampionshipCard and TiebreakerReasoning are imported relatively rather
// than through Nuxt's component auto-import, so this component mounts in a
// plain vitest run (the project's vitest config registers no Nuxt
// auto-import plugin — see GameCard.test.ts's note on why its component was
// left untestable).
import { computed, ref, useId } from 'vue'
import type { StandingsTeam } from '#shared/types/standings'
import type { ConferenceId, ConferenceRanking, RankGroup, TeamId } from '#shared/domain/tiebreakers/types'
import ChampionshipCard from './ChampionshipCard.vue'
import TiebreakerReasoning from './TiebreakerReasoning.vue'

/**
 * Renders ONE conference's standings (D-03: a real `<table>`, not cards —
 * the familiar sports format is what makes it scannable at a glance).
 *
 * Deliberately dumb: it takes an already-ranked, already-sorted
 * `StandingsTeam[]` and renders it. All ordering and rank assignment lives in
 * `computeStandings()`, so this component only ever reads a `RankGroup`'s
 * fields, never a display-layer tie predicate.
 *
 * **D-10/D-11 (reverses Phase 5's D-05/D-06).** Phase 5 declined a tie badge
 * on the rationale that a matching rank number plus matching W-L values were
 * sufficient indication. Phase 5's own verification measured that rationale
 * false on ~1% of tables: the ACC ties on alternate schedule lengths, so two
 * teams can share a rank with DIFFERENT records (`1 Boston College 6-2`
 * rendered above `1 Duke 7-2`). D-01 removed the shared rank that hid this;
 * D-10 makes it legible again with two markers, derived exclusively from the
 * `ranking` prop's `RankGroup`s — NEVER from comparing two rows' own
 * `confRecord` values, which would reimplement a tie predicate in the
 * display layer (the CR-01 defect Phase 5 spent a whole plan repairing, and
 * one that gets the ACC wrong by construction). Both markers are neutral-
 * palette only (D-11).
 *
 * `ranking` (Plan 06-04, TIE-07; extended Plan 06-07 for D-10/D-15):
 * threaded straight through to `ChampionshipCard` (via `championshipFor`,
 * never this component's own row order — D-12) and read directly here to
 * derive each row's rank-cell state and to mount the per-group reasoning
 * row (D-15).
 *
 * `slateComplete`/`commitOrdering` (Plan 06-07, Task 2): threaded straight
 * through to `TiebreakerReasoning` and its `commit` event, respectively.
 * This component computes nothing about completion and touches no storage
 * of its own — it only knows which conference it is (`conferenceName`, cast
 * to `ConferenceId` since every real caller passes one of the four P4
 * names) to pass along with a committed group's ordering.
 */
const props = withDefaults(defineProps<{
  standings: readonly StandingsTeam[]
  conferenceName: string
  ranking?: ConferenceRanking | undefined
  slateComplete?: boolean
  commitOrdering?: (conference: ConferenceId, group: RankGroup, orderedTeamIds: readonly TeamId[]) => void
  /**
   * Whether to render this component's own `<h3>` heading (this task).
   * Defaults `true` for standalone/unit-test usage. `StandingsSidebar` sets
   * this `false` when it mounts a `StandingsTable` inside a `UAccordion`
   * item -- the accordion trigger already renders the conference name as
   * its own clickable label, so a second heading here would just duplicate
   * it directly above the table.
   */
  showHeading?: boolean
}>(), {
  ranking: undefined,
  slateComplete: undefined,
  commitOrdering: undefined,
  showHeading: true
})

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

type MarkerKind = 'none' | 'a' | 'b'

/**
 * §6's three-state predicate, read exclusively off a `RankGroup` -- never
 * off two rows' `confRecord`. `'none'` covers BOTH the degraded path (no
 * `group` at all) and a genuinely uncontested rank (`contestedWith.length
 * <= 1`), which is exactly what §10's degraded row needs: with `ranking`
 * undefined every row's `group` is `undefined`, so every branch below falls
 * through to `'none'` structurally rather than via a second code path.
 */
function markerKindFor(group: RankGroup | undefined): MarkerKind {
  if (!group) return 'none'
  if (group.teams.length > 1) return 'b'
  if (group.contestedWith.length > 1) return 'a'
  return 'none'
}

interface RowMeta {
  team: StandingsTeam
  group: RankGroup | undefined
  groupIndex: number | undefined
  groupKey: string | undefined
  markerKind: MarkerKind
  isGroupLastRow: boolean
}

/**
 * WR-02: a stable identity for a `RankGroup`, derived from its own
 * membership (sorted team ids) rather than its position in
 * `ranking.groups`. A pick that changes the conference's ranking can shift
 * which group occupies a given array index entirely -- `expandedGroups`
 * (disclosure state that survives the recompute, since it's component-local
 * `ref` state) must key off what a group actually IS, not where it
 * currently sits, or a previously-expanded index can silently start
 * pointing at an unrelated group after the recompute.
 */
function groupKeyFor(group: RankGroup): string {
  return [...group.teams].sort((a, b) => a - b).join('-')
}

/**
 * One entry per standings row, precomputed once per render rather than
 * inline in the template: which `RankGroup` (and its index in
 * `ranking.groups`) the row belongs to, its marker state, and whether it is
 * the LAST standings row belonging to that group -- `computeStandings`
 * always emits a group's rows contiguously, so a single forward pass is
 * enough to find each group's last row without re-scanning `standings` per
 * row.
 */
const rowMeta = computed<RowMeta[]>(() => {
  const groups = props.ranking?.groups
  const groupByTeam = new Map<TeamId, RankGroup>()
  const groupIndexByTeam = new Map<TeamId, number>()

  if (groups) {
    groups.forEach((group, index) => {
      for (const teamId of group.teams) {
        groupByTeam.set(teamId, group)
        groupIndexByTeam.set(teamId, index)
      }
    })
  }

  const lastRowTeamIdForGroup = new Map<number, TeamId>()
  for (const team of props.standings) {
    const index = groupIndexByTeam.get(team.id)
    if (index !== undefined) lastRowTeamIdForGroup.set(index, team.id)
  }

  return props.standings.map((team) => {
    const group = groupByTeam.get(team.id)
    const groupIndex = groupIndexByTeam.get(team.id)
    return {
      team,
      group,
      groupIndex,
      groupKey: group ? groupKeyFor(group) : undefined,
      markerKind: markerKindFor(group),
      isGroupLastRow: groupIndex !== undefined && lastRowTeamIdForGroup.get(groupIndex) === team.id
    }
  })
})

/**
 * §6.1: the chip/pill IS the disclosure trigger. Local, ephemeral,
 * per-session state -- keyed by `groupKeyFor` (WR-02: group membership
 * identity, never a raw `ranking.groups` array index, which a recompute can
 * silently reassign to an unrelated group) -- mirroring
 * `StandingsSidebar.vue`'s own collapse-state comment: this is a viewing
 * preference for the current session, not part of the user's scenario.
 */
const expandedGroups = ref<ReadonlySet<string>>(new Set())

function isExpanded(groupKey: string): boolean {
  return expandedGroups.value.has(groupKey)
}

function toggleGroup(groupKey: string): void {
  const next = new Set(expandedGroups.value)
  if (next.has(groupKey)) {
    next.delete(groupKey)
  } else {
    next.add(groupKey)
  }
  expandedGroups.value = next
}

function reasoningPanelId(groupKey: string): string {
  return `${headingId}-reasoning-${groupKey}`
}

/**
 * §13's three accessible names, differing by marker case -- marker
 * semantics reach assistive tech through the accessible name, not the
 * visual treatment (§12.1).
 */
function chipAccessibleName(row: RowMeta): string {
  const group = row.group!
  const rank = row.team.rank
  if (row.markerKind === 'b') {
    const others = group.teams.length - 1
    return `Rank ${rank}, tied with ${others} other team${others === 1 ? '' : 's'}. Show reasoning.`
  }
  const provenance = group.resolvedBy === 'manual' ? 'decided by your choice' : 'decided by tiebreaker'
  return `Rank ${rank}, ${provenance}. Show reasoning.`
}

const MARKER_A_CLASS = 'inline-flex min-w-6 justify-center rounded px-1 bg-accented text-default text-sm font-semibold tabular-nums'
const MARKER_B_CLASS = 'inline-flex min-w-6 justify-center rounded-full px-1 bg-muted text-toned ring ring-default text-sm font-semibold tabular-nums'

function markerClass(kind: MarkerKind): string {
  return kind === 'b' ? MARKER_B_CLASS : MARKER_A_CLASS
}

function handleReasoningCommit(group: RankGroup, order: TeamId[]): void {
  props.commitOrdering?.(props.conferenceName as ConferenceId, group, order)
}
</script>

<template>
  <section :aria-labelledby="showHeading ? headingId : undefined">
    <!-- `text-toned`, not `text-dimmed`: with four conferences stacked in the
         sidebar this heading is the primary wayfinding element, not a
         de-emphasised label. Omitted entirely when this table mounts inside
         a `UAccordion` item (`showHeading: false`) -- the accordion's own
         trigger already renders the conference name as a clickable label,
         so a second heading here would duplicate it. -->
    <h3
      v-if="showHeading"
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
      :slate-complete="slateComplete ?? false"
      :conference-name="(conferenceName as ConferenceId)"
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
            class="w-8 py-1.5 px-2 text-center font-medium"
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
        <template
          v-for="row in rowMeta"
          :key="row.team.id"
        >
          <!-- §6: the rank cell carries the entire tie signal now -- three
               states, all derived from `row.group`/`row.markerKind`, never
               from comparing this row's `confRecord` against a neighbour's.
               The row itself no longer carries any tie-related styling --
               tied and uncontested rows share the same transition/hover
               treatment; the shared rank number and its marker are the
               sole row-level signal. -->
          <tr class="transition-colors hover:bg-elevated/60">
            <td class="py-1.5 px-2 text-center tabular-nums font-medium text-default">
              <button
                v-if="row.markerKind !== 'none'"
                type="button"
                :class="[markerClass(row.markerKind), 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary']"
                :aria-expanded="isExpanded(row.groupKey!)"
                :aria-controls="reasoningPanelId(row.groupKey!)"
                :aria-label="chipAccessibleName(row)"
                @click="toggleGroup(row.groupKey!)"
              >
                {{ row.team.rank }}
              </button>
              <template v-else>
                {{ row.team.rank }}
              </template>
            </td>
            <!-- No `truncate`/`nowrap`: at the sidebar's 320px the longest P4
                 school ("Mississippi State") fits, and if a narrower viewport
                 forces it, wrapping is the correct failure — a clipped team
                 name is not. -->
            <th
              scope="row"
              class="py-1.5 pr-2 text-left font-normal text-highlighted"
            >
              {{ row.team.school }}
            </th>
            <td class="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap text-muted">
              {{ row.team.overallRecord.wins }}-{{ row.team.overallRecord.losses }}
            </td>
            <td class="py-1.5 text-right tabular-nums whitespace-nowrap text-default">
              {{ row.team.confRecord.wins }}-{{ row.team.confRecord.losses }}
            </td>
          </tr>

          <!-- §7.1: mounted immediately after the group's LAST row, inside
               this SAME `<tbody>`. Absent from the DOM entirely when
               collapsed -- not hidden, not display:none (§12.4). -->
          <tr v-if="row.group && row.groupKey !== undefined && row.isGroupLastRow && isExpanded(row.groupKey)">
            <td
              :id="reasoningPanelId(row.groupKey)"
              colspan="4"
              class="p-0"
            >
              <TiebreakerReasoning
                :group="row.group"
                :school-by-id="schoolById"
                :slate-complete="slateComplete ?? false"
                @commit="order => handleReasoningCommit(row.group!, order)"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </section>
</template>
