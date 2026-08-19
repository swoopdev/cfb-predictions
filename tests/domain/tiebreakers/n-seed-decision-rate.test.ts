/**
 * @vitest-environment node
 */

/**
 * TIE-08 / 06-RESEARCH.md "The Measurement": the manual-resolution UX
 * (D-06/D-17, Plan 06-05/06-06) is designed around per-conference decision
 * rates measured against the committed 2026 slate. This suite commits that
 * measurement as a re-runnable test rather than a one-off research figure,
 * per 06-RESEARCH.md's own instruction: "re-run the committed harness after
 * any step-list or `defineTiedTeams` change."
 *
 * Measurement date: 2026-08-15 (06-RESEARCH.md), re-measured 2026-08-18
 * against the Task 2 repair (Plan 06-02) and Plan 06-01's ACC guard/
 * lost-to-all repairs.
 * Seed ranges: fully-picked mulberry32 seeds 1-100; mid-season (through
 * week 7) mulberry32 seeds 1001-1100 -- identical to
 * `standings-tiebreaker-agreement.test.ts` and `n-seed-ranking.test.ts`, so
 * every generated-season figure in this repo is directly comparable.
 * Slate: `public/data/2026/games.json`, 888 games, 67 P4 teams across 4
 * conferences (`public/data/2026/teams.json`). These figures are valid only
 * while that slate and `CONFERENCE_RULES` are unchanged.
 *
 * Assertions below pin REGIMES and RANGES rather than exact figures, so a
 * legitimate step-order correction does not produce a false failure while a
 * silent multi-x drift still fails loudly (06-RESEARCH.md's own guidance).
 *
 * Runs under the `node` environment (see `trace-isolation.test.ts`'s
 * docblock for why).
 */

import { describe, it, expect } from 'vitest'
import { resolveConferenceRanking } from '../../../shared/domain/tiebreakers/engine'
import { conferenceGamesFor, toOutcomes, P4_CONFERENCES } from '../../../shared/domain/standings/computeStandings'
import type { ConferenceId, ConferenceRanking, TeamId } from '../../../shared/domain/tiebreakers/types'
import type { Team } from '../../../shared/types/schedule'
import { mulberry32, generatePicks, readSlate } from '../../helpers/generated-seasons'

const { games, teams } = readSlate()
const knownFbsTeamIds = new Set<TeamId>(teams.map(t => t.id))

function confTeamIdsFor(conference: ConferenceId, allTeams: readonly Team[]): Set<TeamId> {
  return new Set<TeamId>(allTeams.filter(t => t.conference === conference).map(t => t.id))
}

interface Measurement {
  /** Per-conference count of `resolvedBy: 'unresolved'` groups, one entry per season (model B decision count). */
  unresolvedGroupCounts: Record<ConferenceId, number[]>
  /** Per-conference fraction of teams that landed in a single-team (distinct-rank) group, one entry per season. */
  distinctRankFractions: Record<ConferenceId, number[]>
  /** `resolveConferenceRanking` throwing for any reason (recursion-guard or iteration-cap trips). */
  guardFailures: string[]
  /** Pitfall 1 regression: a multi-team top bucket presented as the answer without a bucket recursion ever running. */
  unseparatedTopBucketFailures: string[]
}

function emptyMeasurement(): Measurement {
  const byConference = (): Record<ConferenceId, number[]> => ({
    'SEC': [],
    'Big Ten': [],
    'Big 12': [],
    'ACC': []
  })
  return {
    unresolvedGroupCounts: byConference(),
    distinctRankFractions: byConference(),
    guardFailures: [],
    unseparatedTopBucketFailures: []
  }
}

/**
 * Pitfall 1 regression check: for a `'tiebreaker'` group, the FIRST
 * separating step of its FIRST cycle is exactly the branch point where the
 * pre-06-02 engine would have emitted a multi-team top bucket in raw
 * team-id order (`partitionByStepValue`'s `sort((a, b) => a - b)`) as the
 * answer. If that bucket holds more than one team, the repaired engine must
 * have recursed into it -- i.e. `group.trace` must contain a later cycle
 * whose `tiedTeams` is exactly that bucket (as a set). Absence of such a
 * cycle means the bucket was never resolved and is the 19.2%-of-slots
 * regression this test exists to catch.
 */
function unseparatedTopBucketViolations(
  conference: ConferenceId,
  ranking: ConferenceRanking,
  label: string
): string[] {
  const violations: string[] = []

  for (const group of ranking.groups) {
    if (group.resolvedBy !== 'tiebreaker' || group.trace.length === 0) continue

    const firstCycle = group.trace[0]!
    const decisiveStep = firstCycle.steps.find(step => step.separated)
    if (!decisiveStep) continue

    const topBucket = decisiveStep.partition[0]!
    if (topBucket.length <= 1) continue // nothing to repair -- a clean single-team separation

    const topBucketSet = new Set(topBucket)
    const recursedIntoBucket = group.trace.some(
      cycle => cycle.tiedTeams.length === topBucket.length && cycle.tiedTeams.every(id => topBucketSet.has(id))
    )
    if (!recursedIntoBucket) {
      violations.push(
        `${label} ${conference}: decisive multi-team top bucket [${topBucket.join(', ')}] was never `
        + 'recursed into -- looks like a raw-id-sorted emission'
      )
    }
  }

  return violations
}

function measure(seeds: readonly number[], throughWeek?: number): Measurement {
  const measurement = emptyMeasurement()

  for (const seed of seeds) {
    const picks = generatePicks(games, mulberry32(seed), throughWeek)
    const outcomes = toOutcomes(games, picks)
    const label = throughWeek === undefined ? `fully-picked seed ${seed}` : `weeks 1-${throughWeek} seed ${seed}`

    for (const conference of P4_CONFERENCES) {
      const confTeamIds = confTeamIdsFor(conference, teams)
      if (confTeamIds.size === 0) continue

      try {
        const ranking = resolveConferenceRanking(
          conference,
          conferenceGamesFor(games, confTeamIds),
          outcomes,
          confTeamIds,
          games,
          knownFbsTeamIds
        )

        const unresolvedCount = ranking.groups.filter(g => g.resolvedBy === 'unresolved').length
        measurement.unresolvedGroupCounts[conference]!.push(unresolvedCount)

        const singleTeamGroups = ranking.groups.filter(g => g.teams.length === 1).length
        measurement.distinctRankFractions[conference]!.push(singleTeamGroups / confTeamIds.size)

        measurement.unseparatedTopBucketFailures.push(
          ...unseparatedTopBucketViolations(conference, ranking, label)
        )
      } catch (error) {
        measurement.guardFailures.push(
          `${label} ${conference}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  return measurement
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

const FULLY_PICKED_SEEDS = Array.from({ length: 100 }, (_, i) => i + 1)
const MID_SEASON_SEEDS = Array.from({ length: 100 }, (_, i) => 1001 + i)

describe('N-seed manual-decision rate over 200 generated seasons of the committed 2026 slate', () => {
  const fullyPicked = measure(FULLY_PICKED_SEEDS)
  const midSeason = measure(MID_SEASON_SEEDS, 7)

  it('never trips a recursion or iteration-cap guard', () => {
    // Pitfall 2's repair (Plan 06-01) plus this plan's iteration cap.
    // Measured 44/400 before the guard repair, 0/400 after.
    expect(fullyPicked.guardFailures).toEqual([])
    expect(midSeason.guardFailures).toEqual([])
  })

  it('produces zero unseparated-top-bucket emissions (Pitfall 1)', () => {
    // Measured 19.2% of contested slots before this plan's repair; must be
    // 0% after.
    expect(fullyPicked.unseparatedTopBucketFailures).toEqual([])
    expect(midSeason.unseparatedTopBucketFailures).toEqual([])
  })

  it('keeps SEC / Big Ten / Big 12 under 1 manual decision per fully-picked season on average', () => {
    // Measured (post Plan 06-01 + 06-02 repairs) SEC 0.10, Big Ten 0.19,
    // Big 12 0.01. Asserted as a REGIME (< 1) rather than the exact figure.
    expect(mean(fullyPicked.unresolvedGroupCounts.SEC)).toBeLessThan(1)
    expect(mean(fullyPicked.unresolvedGroupCounts['Big Ten'])).toBeLessThan(1)
    expect(mean(fullyPicked.unresolvedGroupCounts['Big 12'])).toBeLessThan(1)
  })

  it('documents the ACC as the known-high conference', () => {
    // Measured 3.84 under model B pre-06-01 elimination repair. Asserted as
    // a RANGE (2, 6) so the number stays visible in the suite and a silent
    // 3x drift still fails loudly. Plan 06-01's lost-to-all elimination
    // repair may lower this figure further -- that is expected, and is
    // exactly why the lower bound is 2 rather than 3.
    const accMean = mean(fullyPicked.unresolvedGroupCounts.ACC)
    expect(accMean).toBeGreaterThan(2)
    expect(accMean).toBeLessThan(6)
  })

  it('produces a distinct rank for at least 90% of SEC / Big Ten / Big 12 teams when fully picked', () => {
    // Measured ~16.0/16, ~17.9/18, ~16.0/16 (essentially every team).
    // Nothing is asserted about the ACC here -- see the next test.
    expect(mean(fullyPicked.distinctRankFractions.SEC)).toBeGreaterThanOrEqual(0.9)
    expect(mean(fullyPicked.distinctRankFractions['Big Ten'])).toBeGreaterThanOrEqual(0.9)
    expect(mean(fullyPicked.distinctRankFractions['Big 12'])).toBeGreaterThanOrEqual(0.9)
  })

  it('asserts nothing about the ACC distinct-rank count -- structural, not a bug', () => {
    // Measured ~6.5 distinct ranks across 17 teams (85% sharing a rank).
    // `CONFERENCE_RULES.ACC` has exactly one computable step (head-to-head)
    // because the July 2026 amended policy's remaining steps -- SportSource
    // Analytics Team Success Ranking, then a commissioner's draw -- are
    // permanently uncomputable in a static, winner-only app. This is the
    // ACC's published procedure working as intended, not an engine defect,
    // so no floor is asserted for it. This test exists only to document the
    // choice, not to assert a value.
    expect(P4_CONFERENCES).toContain('ACC')
  })

  // No wall-clock timing assertion: 06-RESEARCH.md measured 0.45ms for all
  // four conferences' full N-seed resolution on this slate, which is not a
  // performance concern and would make this suite environment-dependent
  // and flaky if asserted directly.
})
