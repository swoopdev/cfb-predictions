/**
 * @vitest-environment node
 */

/**
 * Pitfall 5 (06-RESEARCH.md): `resolveTiedGroup`'s `cycles` accumulator is
 * threaded through an entire recursive resolution and returned by reference
 * at every exit. That is correct WITHIN one rank slot's resolution -- it is
 * a defect the instant one accumulator is reused ACROSS slots, because a
 * later group's expandable reasoning would then render an earlier group's
 * steps too, and it would silently corrupt the D-08 invalidation hash
 * (Plan 06-05), which reads `trace.at(-1)`.
 *
 * Two distinct assertions are needed and neither substitutes for the other:
 *
 * (a) IDENTITY -- no two groups in one `ConferenceRanking` reference the
 *     same `trace` array object. Catches a shared accumulator even when the
 *     ids happen to line up correctly.
 * (b) MEMBERSHIP -- every team id mentioned anywhere inside a group's trace
 *     belongs to that group's `contestedWith`. Catches a copied-but-still-
 *     cumulative array (ids leak even though the array reference itself is
 *     fresh).
 *
 * Runs under the `node` environment: `readSlate` resolves paths through
 * `fileURLToPath`, which happy-dom's non-`file:` `URL` rejects.
 */

import { describe, it, expect } from 'vitest'
import { resolveConferenceRanking } from '../../../shared/domain/tiebreakers/engine'
import { conferenceGamesFor, toOutcomes, P4_CONFERENCES } from '../../../shared/domain/standings/computeStandings'
import type { ConferenceId, TeamId } from '../../../shared/domain/tiebreakers/types'
import type { Team } from '../../../shared/types/schedule'
import { mulberry32, generatePicks, readSlate } from '../../helpers/generated-seasons'

const { games, teams } = readSlate()
const knownFbsTeamIds = new Set<TeamId>(teams.map(t => t.id))

function confTeamIdsFor(conference: ConferenceId, allTeams: readonly Team[]): Set<TeamId> {
  return new Set<TeamId>(allTeams.filter(t => t.conference === conference).map(t => t.id))
}

/**
 * Collects every trace-isolation violation for one generated season across
 * all four P4 conferences. Richly formatted per the house
 * `violationsFor(label, picks)` collector style
 * (`standings-tiebreaker-agreement.test.ts:242-330`) -- a bare boolean
 * assertion here is unusable when it fails, because you need to know which
 * conference and which group index.
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

    // (a) IDENTITY: every group's trace array is its own object instance.
    const traceRefs = new Set(ranking.groups.map(group => group.trace))
    if (traceRefs.size !== ranking.groups.length) {
      violations.push(
        `[identity] ${label} ${conference}: ${ranking.groups.length} groups but only `
        + `${traceRefs.size} distinct trace array instances -- a cycles accumulator is shared`
      )
    }

    // (b) MEMBERSHIP: every id anywhere in a group's trace is a member of
    // that group's own contestedWith.
    ranking.groups.forEach((group, groupIndex) => {
      const allowed = new Set<TeamId>(group.contestedWith)

      for (const cycle of group.trace) {
        for (const teamId of cycle.tiedTeams) {
          if (!allowed.has(teamId)) {
            violations.push(
              `[membership] ${label} ${conference} group ${groupIndex}: tiedTeams id ${teamId} `
              + `is not in contestedWith [${group.contestedWith.join(', ')}]`
            )
          }
        }
        for (const step of cycle.steps) {
          for (const { teamId } of step.values) {
            if (!allowed.has(teamId)) {
              violations.push(
                `[membership] ${label} ${conference} group ${groupIndex}: step '${step.step}' `
                + `values teamId ${teamId} is not in contestedWith [${group.contestedWith.join(', ')}]`
              )
            }
          }
          for (const bucket of step.partition) {
            for (const teamId of bucket) {
              if (!allowed.has(teamId)) {
                violations.push(
                  `[membership] ${label} ${conference} group ${groupIndex}: step '${step.step}' `
                  + `partition teamId ${teamId} is not in contestedWith [${group.contestedWith.join(', ')}]`
                )
              }
            }
          }
        }
        for (const { teamId } of cycle.removed) {
          if (!allowed.has(teamId)) {
            violations.push(
              `[membership] ${label} ${conference} group ${groupIndex}: removed teamId ${teamId} `
              + `is not in contestedWith [${group.contestedWith.join(', ')}]`
            )
          }
        }
      }
    })
  }

  return violations
}

describe('trace isolation across 200 generated seasons of the committed 2026 slate', () => {
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
