/**
 * @vitest-environment node
 */

/**
 * TIE-08: `resolveConferenceRanking` extends the engine from two
 * championship seeds to a full 1..N ordering. This suite pins the contract
 * every downstream consumer (standings display, championship card, manual
 * resolution) depends on:
 *
 *  - completeness: every team lands in exactly one rank group
 *  - ordering: groups run best to worst
 *  - group semantics: `teams.length` and `resolvedBy` agree with each other
 *  - `contestedWith`: always a superset of `teams`, and length 1 exactly
 *    when `resolvedBy` is `'sole-candidate'`
 *  - `championshipFor`: reads seed 1/2 directly off `groups[0]`/`groups[1]`
 *  - decisive step: a `'tiebreaker'` group's last cycle always has a
 *    reachable separating step (D-16)
 *  - the Pitfall 1 bucket-recursion containment invariant (06-RESEARCH.md
 *    "Containment invariant") -- distinguishes the correct repair from a
 *    plausible-looking broken one
 *
 * Runs under the `node` environment (see `trace-isolation.test.ts`'s
 * docblock for why).
 */

import { describe, it, expect } from 'vitest'
import { resolveConferenceRanking, championshipFor } from '../../../shared/domain/tiebreakers/engine'
import { conferenceGamesFor, toOutcomes, P4_CONFERENCES } from '../../../shared/domain/standings/computeStandings'
import { deriveConferenceRecords } from '../../../shared/domain/tiebreakers/records'
import type { ConferenceId, ConferenceRanking, TeamId } from '../../../shared/domain/tiebreakers/types'
import type { Game, Team } from '../../../shared/types/schedule'
import { mulberry32, generatePicks, readSlate } from '../../helpers/generated-seasons'

const { games, teams } = readSlate()
const knownFbsTeamIds = new Set<TeamId>(teams.map(t => t.id))

function confTeamIdsFor(conference: ConferenceId, allTeams: readonly Team[]): Set<TeamId> {
  return new Set<TeamId>(allTeams.filter(t => t.conference === conference).map(t => t.id))
}

function schoolName(id: TeamId, allTeams: readonly Team[]): string {
  return allTeams.find(t => t.id === id)?.school ?? `unknown id ${id}`
}

/**
 * Every violation this suite can detect for one generated season, across
 * all four P4 conferences. House `violationsFor(label, picks)` collector
 * style (`standings-tiebreaker-agreement.test.ts:242-330`): richly
 * formatted failure strings, asserted once with `expect(violations).toEqual([])`.
 */
function violationsFor(label: string, picks: Record<number, number>): string[] {
  const violations: string[] = []
  const outcomes = toOutcomes(games, picks)

  for (const conference of P4_CONFERENCES) {
    const confTeamIds = confTeamIdsFor(conference, teams)
    if (confTeamIds.size === 0) continue

    const ranking = resolveConferenceRanking(
      conference,
      conferenceGamesFor(games, confTeamIds),
      outcomes,
      confTeamIds,
      games,
      knownFbsTeamIds
    )
    const records = deriveConferenceRecords(conferenceGamesFor(games, confTeamIds), outcomes, confTeamIds)

    const label2 = (groupIndex: number, school: (id: TeamId) => string, msg: string): string =>
      `${label} ${conference} group ${groupIndex}: ${msg}`

    // --- Completeness: union of every group's teams == full membership,
    // pairwise disjoint. ---
    const seen = new Set<TeamId>()
    let duplicated = false
    for (const group of ranking.groups) {
      for (const teamId of group.teams) {
        if (seen.has(teamId)) duplicated = true
        seen.add(teamId)
      }
    }
    if (duplicated) {
      violations.push(`${label} ${conference}: a team id appears in more than one rank group`)
    }
    const missing = [...confTeamIds].filter(id => !seen.has(id))
    if (missing.length > 0) {
      violations.push(
        `${label} ${conference}: ${missing.map(id => schoolName(id, teams)).join(', ')} placed in no rank group`
      )
    }
    const extra = [...seen].filter(id => !confTeamIds.has(id))
    if (extra.length > 0) {
      violations.push(
        `${label} ${conference}: ${extra.map(id => schoolName(id, teams)).join(', ')} placed but not in the conference`
      )
    }

    // --- Ordering: groups run best to worst by conference win pct.
    // Scoped to SEC/Big Ten/Big 12: their shared `defineBucketTiedTeams`
    // strategy walks the frozen base ordering strictly best-to-worst, so
    // group max win pct is monotonically non-increasing by construction.
    // The ACC is DELIBERATELY excluded -- `defineAccTiedTeams` ties teams
    // with DIFFERENT win percentages together (matching win/loss count on an
    // alternate schedule length, per D-10's own documented example "1 Boston
    // College 6-2" above "1 Duke 7-2"), and head-to-head can then seed the
    // lower-pct member of that tie ahead of a higher-pct team that becomes
    // the ACC's next sole remaining candidate once its tied partner commits.
    // That is the published procedure working as intended, not a defect. ---
    if (conference !== 'ACC') {
      let previousMax: number | undefined
      ranking.groups.forEach((group, groupIndex) => {
        const maxPct = Math.max(...group.teams.map(id => records.get(id)?.winPct ?? 0))
        if (previousMax !== undefined && maxPct > previousMax) {
          violations.push(
            label2(
              groupIndex,
              id => schoolName(id, teams),
              `max win pct ${maxPct} exceeds the previous group's max win pct ${previousMax}`
            )
          )
        }
        previousMax = maxPct
      })
    }

    // --- Group semantics + contestedWith. ---
    ranking.groups.forEach((group, groupIndex) => {
      if (group.teams.length === 1) {
        if (group.resolvedBy !== 'sole-candidate' && group.resolvedBy !== 'tiebreaker') {
          violations.push(
            label2(groupIndex, id => schoolName(id, teams), `single-team group has resolvedBy '${group.resolvedBy}'`)
          )
        }
      } else {
        if (group.resolvedBy !== 'unresolved') {
          violations.push(
            label2(groupIndex, id => schoolName(id, teams), `multi-team group has resolvedBy '${group.resolvedBy}'`)
          )
        }
        if (group.terminalReason === undefined) {
          violations.push(
            label2(groupIndex, id => schoolName(id, teams), 'multi-team group is missing terminalReason')
          )
        }
      }

      const contestedSet = new Set(group.contestedWith)
      const notContested = group.teams.filter(id => !contestedSet.has(id))
      if (notContested.length > 0) {
        violations.push(
          label2(
            groupIndex,
            id => schoolName(id, teams),
            `teams [${notContested.join(', ')}] are not in contestedWith`
          )
        )
      }
      const soleCandidateLengthMismatch
        = (group.resolvedBy === 'sole-candidate') !== (group.contestedWith.length === 1)
      if (soleCandidateLengthMismatch) {
        violations.push(
          label2(
            groupIndex,
            id => schoolName(id, teams),
            `contestedWith.length ${group.contestedWith.length} disagrees with resolvedBy '${group.resolvedBy}'`
          )
        )
      }
    })

    // --- Decisive step (D-16): a 'tiebreaker' group's last cycle has a
    // reachable separating step. ---
    ranking.groups.forEach((group, groupIndex) => {
      if (group.resolvedBy !== 'tiebreaker' || group.trace.length === 0) return
      const lastCycle = group.trace.at(-1)!
      const hasSeparatingStep = lastCycle.steps.some(step => step.separated)
      if (!hasSeparatingStep) {
        violations.push(
          label2(groupIndex, id => schoolName(id, teams), 'last cycle has no reachable separating step')
        )
      }
    })

    // --- championshipFor: reads groups[0]/groups[1] directly, per D-12. ---
    const { seed1, seed2 } = championshipFor(ranking)
    if (ranking.groups.length > 0) {
      if (seed1 !== ranking.groups[0]) {
        violations.push(`${label} ${conference}: championshipFor seed1 is not groups[0]`)
      }
      if (ranking.groups[0]!.teams.length === 1) {
        if (seed2 !== ranking.groups[1]) {
          violations.push(`${label} ${conference}: championshipFor seed2 is not groups[1] when groups[0] is a single team`)
        }
      } else if (seed2 !== undefined) {
        violations.push(`${label} ${conference}: championshipFor seed2 is defined even though groups[0] is a multi-team group`)
      }
    }

    // --- Pitfall 1 containment invariant: every 'restart' cycle with a
    // multi-team removed set is IMMEDIATELY followed (in this group's own
    // trace) by a cycle whose tiedTeams is a subset of that removed set --
    // proof the bucket recursion stayed contained rather than escaping to
    // the wider pool. ---
    ranking.groups.forEach((group, groupIndex) => {
      group.trace.forEach((cycle, cycleIndex) => {
        if (cycle.outcome !== 'restart' || cycle.removed.length <= 1) return
        const bucketIds = new Set(cycle.removed.map(r => r.teamId))
        const next = group.trace[cycleIndex + 1]
        if (next === undefined) return // resolved immediately (base case) -- nothing to check
        const escaped = next.tiedTeams.filter(id => !bucketIds.has(id))
        if (escaped.length > 0) {
          violations.push(
            label2(
              groupIndex,
              id => schoolName(id, teams),
              `bucket recursion escaped containment: [${escaped.join(', ')}] were not in the `
              + `removed bucket [${[...bucketIds].join(', ')}]`
            )
          )
        }
      })
    })
  }

  return violations
}

describe('N-seed ranking over 200 generated seasons of the committed 2026 slate', () => {
  it('holds across 100 fully-picked seasons', () => {
    const violations: string[] = []
    for (let seed = 1; seed <= 100; seed++) {
      const random = mulberry32(seed)
      violations.push(...violationsFor(`fully-picked seed ${seed}`, generatePicks(games, random)))
    }

    expect(violations.slice(0, 10)).toEqual([])
    expect(violations).toHaveLength(0)
  })

  it('holds across 100 partially-picked seasons (weeks 1-7)', () => {
    const violations: string[] = []
    for (let seed = 1001; seed <= 1100; seed++) {
      const random = mulberry32(seed)
      violations.push(...violationsFor(`weeks 1-7 seed ${seed}`, generatePicks(games, random, 7)))
    }

    expect(violations.slice(0, 10)).toEqual([])
    expect(violations).toHaveLength(0)
  })
})

describe('synthetic fixtures (do not depend on the generated slate)', () => {
  it('produces N single-team sole-candidate groups when every team has a distinct record', () => {
    const teamIds = new Set<TeamId>([201, 202, 203, 204])
    const conferenceGames: Game[] = [
      { id: 1, week: 1, seasonType: 'regular', homeId: 201, homeTeam: 'A', awayId: 202, awayTeam: 'B', conferenceGame: true, neutralSite: false },
      { id: 2, week: 1, seasonType: 'regular', homeId: 201, homeTeam: 'A', awayId: 203, awayTeam: 'C', conferenceGame: true, neutralSite: false },
      { id: 3, week: 1, seasonType: 'regular', homeId: 201, homeTeam: 'A', awayId: 204, awayTeam: 'D', conferenceGame: true, neutralSite: false },
      { id: 4, week: 2, seasonType: 'regular', homeId: 202, homeTeam: 'B', awayId: 203, awayTeam: 'C', conferenceGame: true, neutralSite: false },
      { id: 5, week: 2, seasonType: 'regular', homeId: 202, homeTeam: 'B', awayId: 204, awayTeam: 'D', conferenceGame: true, neutralSite: false },
      { id: 6, week: 2, seasonType: 'regular', homeId: 203, homeTeam: 'C', awayId: 204, awayTeam: 'D', conferenceGame: true, neutralSite: false }
    ]
    // 201: 3-0, 202: 2-1, 203: 1-2, 204: 0-3 -- all distinct win percentages.
    const outcomes = new Map<number, TeamId>([[1, 201], [2, 201], [3, 201], [4, 202], [5, 202], [6, 203]])

    const ranking = resolveConferenceRanking('SEC', conferenceGames, outcomes, teamIds)

    expect(ranking.groups).toHaveLength(4)
    expect(ranking.groups.map(g => g.teams)).toEqual([[201], [202], [203], [204]])
    for (const group of ranking.groups) {
      expect(group.resolvedBy).toBe('sole-candidate')
      expect(group.contestedWith).toEqual(group.teams)
      expect(group.trace).toEqual([])
    }
  })

  it('produces one unresolved group holding every team when the whole membership is tied at 0-0', () => {
    const teamIds = new Set<TeamId>([301, 302, 303])
    const conferenceGames: Game[] = []
    const outcomes = new Map<number, TeamId>()

    const ranking = resolveConferenceRanking('SEC', conferenceGames, outcomes, teamIds)

    expect(ranking.groups).toHaveLength(1)
    expect(new Set(ranking.groups[0]!.teams)).toEqual(new Set([301, 302, 303]))
    expect(ranking.groups[0]!.resolvedBy).toBe('unresolved')
    expect(ranking.groups[0]!.terminalReason).toBeDefined()
  })

  it('championshipFor names groups[0] as a multi-team seed1 and suppresses seed2', () => {
    const ranking: ConferenceRanking = {
      conference: 'SEC',
      groups: [
        {
          teams: [1, 2, 3],
          resolvedBy: 'unresolved',
          contestedWith: [1, 2, 3],
          trace: [],
          terminalReason: { code: 'needs-scores', ruleCitation: 'x', sourceName: 'y' }
        },
        { teams: [4], resolvedBy: 'sole-candidate', contestedWith: [4], trace: [] }
      ]
    }

    const { seed1, seed2 } = championshipFor(ranking)
    expect(seed1).toBe(ranking.groups[0])
    expect(seed2).toBeUndefined()
  })

  it('championshipFor names groups[0]/groups[1] when groups[0] is a single team', () => {
    const ranking: ConferenceRanking = {
      conference: 'SEC',
      groups: [
        { teams: [1], resolvedBy: 'sole-candidate', contestedWith: [1], trace: [] },
        { teams: [2], resolvedBy: 'sole-candidate', contestedWith: [2], trace: [] }
      ]
    }

    const { seed1, seed2 } = championshipFor(ranking)
    expect(seed1).toBe(ranking.groups[0])
    expect(seed2).toBe(ranking.groups[1])
  })
})
