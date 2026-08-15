import { describe, it, expect } from 'vitest'
import { computeStandings, resolveAllConferences, toOutcomes, P4_CONFERENCES } from '../../../shared/domain/standings'
import type { StandingsTeam } from '../../../shared/types/standings'
import type { ChampionshipResult } from '../../../shared/domain/tiebreakers/types'
import {
  allTeams,
  game,
  ALABAMA,
  FLORIDA,
  GEORGIA,
  LSU,
  OLE_MISS,
  MICHIGAN,
  AKRON,
  FCS_OPPONENT,
  secRoundRobinGames,
  secRoundRobinPicks,
  secRoundRobinExpectedRanks,
  separationGames,
  separationPicks,
  singleConferenceGame,
  singleNonConferenceGame,
  singleFcsGame,
  unflaggedSameConferenceGame
} from '../../fixtures/standings.fixtures'

/**
 * Unit tests for the pure standings engine (STAND-01/02/03/04).
 *
 * Scope is the computation only — rendering is covered by
 * `tests/components/StandingsTable.test.ts`.
 */

function bySchool(rows: StandingsTeam[], school: string): StandingsTeam {
  const row = rows.find(r => r.school === school)
  if (!row) throw new Error(`No standings row for ${school}`)
  return row
}

function fmt(record: { wins: number, losses: number }): string {
  return `${record.wins}-${record.losses}`
}

describe('computeStandings', () => {
  describe('conference scope', () => {
    it('returns exactly the four P4 conferences', () => {
      const result = computeStandings(secRoundRobinGames, allTeams, {})
      expect(Object.keys(result).sort()).toEqual(['ACC', 'Big 12', 'Big Ten', 'SEC'])
    })

    it('exposes the P4 list derived from the tiebreaker engine rules', () => {
      expect([...P4_CONFERENCES].sort()).toEqual(['ACC', 'Big 12', 'Big Ten', 'SEC'])
    })

    it('omits G5 conferences even when a G5 team appears on the slate', () => {
      const result = computeStandings(singleNonConferenceGame, allTeams, { 401: ALABAMA })
      expect(result['Mid-American']).toBeUndefined()
      expect(Object.values(result).flat().some(r => r.school === 'Akron')).toBe(false)
    })

    it('lists every member of a conference even with an entirely unpicked slate', () => {
      const result = computeStandings(secRoundRobinGames, allTeams, {})
      expect(result.SEC!.map(r => r.school).sort()).toEqual(
        ['Alabama', 'Florida', 'Georgia', 'LSU', 'Ole Miss']
      )
      expect(result['Big Ten']).toHaveLength(2)
      expect(result['Big 12']).toHaveLength(2)
      expect(result.ACC).toHaveLength(2)
    })
  })

  describe('empty picks', () => {
    it('shows every team at 0-0 in both records', () => {
      const result = computeStandings(secRoundRobinGames, allTeams, {})

      for (const row of result.SEC!) {
        expect(fmt(row.overallRecord)).toBe('0-0')
        expect(fmt(row.confRecord)).toBe('0-0')
      }
    })

    it('ranks every team 1 and marks them all tied when nobody has played', () => {
      const result = computeStandings(secRoundRobinGames, allTeams, {})

      expect(result.SEC!.map(r => r.rank)).toEqual([1, 1, 1, 1, 1])
      expect(result.SEC!.every(r => r.isTied)).toBe(true)
    })
  })

  describe('single conference game', () => {
    const result = computeStandings(singleConferenceGame, allTeams, { 301: ALABAMA })

    it('credits the winner one conference win and one overall win', () => {
      const alabama = bySchool(result.SEC!, 'Alabama')
      expect(fmt(alabama.confRecord)).toBe('1-0')
      expect(fmt(alabama.overallRecord)).toBe('1-0')
    })

    it('charges the loser one conference loss and one overall loss', () => {
      const florida = bySchool(result.SEC!, 'Florida')
      expect(fmt(florida.confRecord)).toBe('0-1')
      expect(fmt(florida.overallRecord)).toBe('0-1')
    })

    it('leaves uninvolved conference members untouched', () => {
      for (const school of ['Georgia', 'LSU', 'Ole Miss']) {
        const row = bySchool(result.SEC!, school)
        expect(fmt(row.confRecord)).toBe('0-0')
        expect(fmt(row.overallRecord)).toBe('0-0')
      }
    })

    it('credits the away team when the away team is picked', () => {
      const awayWin = computeStandings(singleConferenceGame, allTeams, { 301: FLORIDA })
      expect(fmt(bySchool(awayWin.SEC!, 'Florida').confRecord)).toBe('1-0')
      expect(fmt(bySchool(awayWin.SEC!, 'Alabama').confRecord)).toBe('0-1')
    })
  })

  describe('non-conference games', () => {
    it('moves only the overall record for a P4-vs-G5 game', () => {
      const result = computeStandings(singleNonConferenceGame, allTeams, { 401: ALABAMA })
      const alabama = bySchool(result.SEC!, 'Alabama')

      expect(fmt(alabama.overallRecord)).toBe('1-0')
      expect(fmt(alabama.confRecord)).toBe('0-0')
    })

    it('moves only the overall record for a P4-vs-FCS game, and the FCS team never appears', () => {
      const result = computeStandings(singleFcsGame, allTeams, { 501: ALABAMA })
      const alabama = bySchool(result.SEC!, 'Alabama')

      expect(fmt(alabama.overallRecord)).toBe('1-0')
      expect(fmt(alabama.confRecord)).toBe('0-0')
      expect(Object.values(result).flat().some(r => r.id === FCS_OPPONENT)).toBe(false)
    })

    it('charges a P4 team an overall loss when the FCS opponent is picked to win', () => {
      const result = computeStandings(singleFcsGame, allTeams, { 501: FCS_OPPONENT })
      const alabama = bySchool(result.SEC!, 'Alabama')

      expect(fmt(alabama.overallRecord)).toBe('0-1')
      expect(fmt(alabama.confRecord)).toBe('0-0')
    })

    it('honours the conferenceGame flag over team membership', () => {
      const result = computeStandings(unflaggedSameConferenceGame, allTeams, { 601: ALABAMA })

      expect(fmt(bySchool(result.SEC!, 'Alabama').overallRecord)).toBe('1-0')
      expect(fmt(bySchool(result.SEC!, 'Alabama').confRecord)).toBe('0-0')
      expect(fmt(bySchool(result.SEC!, 'Florida').overallRecord)).toBe('0-1')
      expect(fmt(bySchool(result.SEC!, 'Florida').confRecord)).toBe('0-0')
    })
  })

  describe('record separation (STAND-03)', () => {
    it('tracks a divergent conference and overall record on the same team', () => {
      const result = computeStandings(separationGames, allTeams, separationPicks)
      const alabama = bySchool(result.SEC!, 'Alabama')

      // 4 conference games (3-1) + 2 non-conference wins = 5-1 overall.
      expect(fmt(alabama.confRecord)).toBe('3-1')
      expect(fmt(alabama.overallRecord)).toBe('5-1')
    })

    it('does not collapse the two records into one another for the opponents', () => {
      const result = computeStandings(separationGames, allTeams, separationPicks)

      expect(fmt(bySchool(result.SEC!, 'LSU').confRecord)).toBe('1-0')
      expect(fmt(bySchool(result.SEC!, 'LSU').overallRecord)).toBe('1-0')
      expect(fmt(bySchool(result.SEC!, 'Florida').confRecord)).toBe('0-1')
      expect(fmt(bySchool(result.SEC!, 'Florida').overallRecord)).toBe('0-1')
    })
  })

  describe('ranking (STAND-04, D-04)', () => {
    const result = computeStandings(secRoundRobinGames, allTeams, secRoundRobinPicks)

    it('gives three teams with an identical conference record the same rank, then skips to 5', () => {
      const actual = result.SEC!.map(r => ({ school: r.school, rank: r.rank, conf: fmt(r.confRecord) }))
      expect(actual).toEqual(secRoundRobinExpectedRanks)
    })

    it('marks only the teams sharing a rank as tied', () => {
      expect(bySchool(result.SEC!, 'Alabama').isTied).toBe(false)
      expect(bySchool(result.SEC!, 'Florida').isTied).toBe(true)
      expect(bySchool(result.SEC!, 'Georgia').isTied).toBe(true)
      expect(bySchool(result.SEC!, 'LSU').isTied).toBe(true)
      expect(bySchool(result.SEC!, 'Ole Miss').isTied).toBe(false)
    })

    it('sorts best conference record first', () => {
      expect(result.SEC!.map(r => r.school)[0]).toBe('Alabama')
      expect(result.SEC!.at(-1)!.school).toBe('Ole Miss')
    })

    it('ranks an unplayed 0-0 team ahead of a winless team despite equal win percentage', () => {
      // `winPctSafe` gives both a 0-0 and a 0-2 team a win percentage of 0, so
      // losses have to be a separate sort key or the winless team floats up.
      const games = [
        game(701, ALABAMA, FLORIDA, true),
        game(702, GEORGIA, FLORIDA, true)
      ]
      const result = computeStandings(games, allTeams, { 701: ALABAMA, 702: GEORGIA })
      const order = result.SEC!.map(r => `${r.school} ${fmt(r.confRecord)} #${r.rank}`)

      expect(order).toEqual([
        'Alabama 1-0 #1',
        'Georgia 1-0 #1',
        'LSU 0-0 #3',
        'Ole Miss 0-0 #3',
        'Florida 0-2 #5'
      ])
    })

    it('falls back to alphabetical order inside a tie when no tiebreaker result is supplied', () => {
      const tied = result.SEC!.filter(r => r.rank === 2).map(r => r.school)
      expect(tied).toEqual(['Florida', 'Georgia', 'LSU'])
    })

    it('uses a resolved tiebreaker to order teams within a tie without changing their rank', () => {
      // Internally consistent with the fixture: Alabama is 4-0 and alone in
      // the top bucket, so seed 1 is its outright; seed 2 is the deliberate
      // Florida/Georgia/LSU head-to-head cycle, resolved here the way Phase 6
      // will hand it back after a manual resolution.
      const resolved: Partial<Record<'SEC', ChampionshipResult>> = {
        SEC: {
          conference: 'SEC',
          seed1: { status: 'resolved', order: [ALABAMA], trace: [] },
          seed2: { status: 'resolved', order: [LSU, GEORGIA, FLORIDA], trace: [] }
        }
      }

      const ordered = computeStandings(secRoundRobinGames, allTeams, secRoundRobinPicks, resolved)
      const tied = ordered.SEC!.filter(r => r.rank === 2)

      expect(ordered.SEC![0]!.school).toBe('Alabama')
      expect(ordered.SEC![0]!.rank).toBe(1)
      expect(tied.map(r => r.school)).toEqual(['LSU', 'Georgia', 'Florida'])
      expect(tied.every(r => r.rank === 2)).toBe(true)
      expect(bySchool(ordered.SEC!, 'Ole Miss').rank).toBe(5)
      expect(ordered.SEC!.map(r => r.rank)).toEqual([1, 2, 2, 2, 5])
    })

    it('ignores a resolved order naming a team that is not in the conference', () => {
      // T-05-03-01. Phase 6 supplies this argument by hand, so an id that is
      // unknown, out-of-conference, or simply stale must neither throw nor
      // materialise a phantom row.
      const resolved: Partial<Record<'SEC', ChampionshipResult>> = {
        SEC: {
          conference: 'SEC',
          seed1: { status: 'resolved', order: [MICHIGAN, 987654, ALABAMA], trace: [] },
          seed2: { status: 'resolved', order: [-1], trace: [] }
        }
      }

      const ordered = computeStandings(secRoundRobinGames, allTeams, secRoundRobinPicks, resolved)

      expect(ordered.SEC!).toHaveLength(5)
      expect(ordered.SEC!.map(r => r.id).sort((a, b) => a - b)).toEqual(
        [ALABAMA, FLORIDA, GEORGIA, LSU, OLE_MISS]
      )
      expect(ordered.SEC![0]!.school).toBe('Alabama')
    })

    it('gives two placed teams in DIFFERENT seed groups one rank when their records match', () => {
      // The cross-group record collision the rank closure exists for. A rule
      // that merely let unplaced teams adopt a placed team's rank would miss
      // it: Georgia (group 0) and LSU (group 1) are both 2-2 and would land on
      // different rank numbers, violating D-04.
      //
      // Not reachable through `resolveConferenceChampionship` — seed 2's
      // redefinition anchors on the same records seed 1's restart did — but
      // Phase 6 supplies this argument by hand, so the contract must hold.
      const resolved: Partial<Record<'SEC', ChampionshipResult>> = {
        SEC: {
          conference: 'SEC',
          seed1: { status: 'resolved', order: [GEORGIA], trace: [] },
          seed2: { status: 'resolved', order: [LSU], trace: [] }
        }
      }

      const ordered = computeStandings(secRoundRobinGames, allTeams, secRoundRobinPicks, resolved)

      expect(bySchool(ordered.SEC!, 'Georgia').rank).toBe(bySchool(ordered.SEC!, 'LSU').rank)
      expect(ordered.SEC![0]!.school).toBe('Georgia')
      expect(ordered.SEC![1]!.school).toBe('LSU')
    })

    it('breaks a same-name, same-record tie by team id so output is never order-dependent', () => {
      // Two real schools do share a name in CFBD data (e.g. "Miami"), so the
      // final id fallback is not hypothetical.
      const duplicates = [
        ...allTeams,
        { ...allTeams[0]!, id: 900, school: 'Alabama' },
        { ...allTeams[0]!, id: 800, school: 'Alabama' }
      ]
      const result = computeStandings([], duplicates, {})
      const alabamas = result.SEC!.filter(r => r.school === 'Alabama').map(r => r.id)

      expect(alabamas).toEqual([ALABAMA, 800, 900])
    })

    it('ignores a needsUserInput tiebreaker result and keeps the deterministic fallback order', () => {
      const resolved: Partial<Record<'SEC', ChampionshipResult>> = {
        SEC: {
          conference: 'SEC',
          seed1: {
            status: 'needsUserInput',
            tiedTeams: [FLORIDA, GEORGIA, LSU],
            reason: { code: 'needs-scores', ruleCitation: '', sourceName: '' },
            trace: []
          },
          seed2: {
            status: 'needsUserInput',
            tiedTeams: [FLORIDA, GEORGIA, LSU],
            reason: { code: 'needs-scores', ruleCitation: '', sourceName: '' },
            trace: []
          }
        }
      }

      const ordered = computeStandings(secRoundRobinGames, allTeams, secRoundRobinPicks, resolved)
      expect(ordered.SEC!.filter(r => r.rank === 2).map(r => r.school)).toEqual(
        ['Florida', 'Georgia', 'LSU']
      )
    })
  })

  describe('untrusted picks (T-05-SC)', () => {
    it('ignores a pick whose gameId is not on the slate', () => {
      const result = computeStandings(singleConferenceGame, allTeams, {
        301: ALABAMA,
        999999: OLE_MISS
      })

      expect(fmt(bySchool(result.SEC!, 'Alabama').confRecord)).toBe('1-0')
      expect(fmt(bySchool(result.SEC!, 'Ole Miss').confRecord)).toBe('0-0')
      expect(fmt(bySchool(result.SEC!, 'Ole Miss').overallRecord)).toBe('0-0')
    })

    it('ignores a pick whose winner did not play in that game', () => {
      const result = computeStandings(singleConferenceGame, allTeams, { 301: AKRON })

      expect(fmt(bySchool(result.SEC!, 'Alabama').confRecord)).toBe('0-0')
      expect(fmt(bySchool(result.SEC!, 'Florida').confRecord)).toBe('0-0')
    })

    it('does not throw on a wholly bogus picks object', () => {
      expect(() =>
        computeStandings(secRoundRobinGames, allTeams, { 0: 0, [-1]: -1, 12345: 67890 })
      ).not.toThrow()
    })
  })

  describe('purity', () => {
    it('mutates neither the games, the teams, nor the picks it is given', () => {
      const games = structuredClone(secRoundRobinGames)
      const teams = structuredClone(allTeams)
      const picks = structuredClone(secRoundRobinPicks)

      computeStandings(games, teams, picks)

      expect(games).toEqual(secRoundRobinGames)
      expect(teams).toEqual(allTeams)
      expect(picks).toEqual(secRoundRobinPicks)
    })

    it('is deterministic across repeated calls', () => {
      const a = computeStandings(secRoundRobinGames, allTeams, secRoundRobinPicks)
      const b = computeStandings(secRoundRobinGames, allTeams, secRoundRobinPicks)
      expect(a).toEqual(b)
    })
  })
})

describe('toOutcomes', () => {
  it('keys outcomes by gameId and drops unknown games and non-participant winners', () => {
    const outcomes = toOutcomes(singleConferenceGame, { 301: ALABAMA, 777: FLORIDA })
    expect([...outcomes.entries()]).toEqual([[301, ALABAMA]])

    expect(toOutcomes(singleConferenceGame, { 301: AKRON }).size).toBe(0)
  })
})

describe('resolveAllConferences', () => {
  it('resolves every P4 conference from a picked slate', () => {
    const resolved = resolveAllConferences(secRoundRobinGames, allTeams, secRoundRobinPicks)
    expect(Object.keys(resolved).sort()).toEqual(['ACC', 'Big 12', 'Big Ten', 'SEC'])
  })

  it('reports needsUserInput for the deliberate head-to-head cycle behind the tie', () => {
    const resolved = resolveAllConferences(secRoundRobinGames, allTeams, secRoundRobinPicks)

    // Alabama is 4-0 and alone in the top bucket, so seed 1 resolves outright;
    // seed 2 is the unbreakable Florida/Georgia/LSU cycle.
    expect(resolved.SEC!.seed1.status).toBe('resolved')
    expect(resolved.SEC!.seed2.status).toBe('needsUserInput')
  })

  it('feeds straight back into computeStandings', () => {
    const resolved = resolveAllConferences(secRoundRobinGames, allTeams, secRoundRobinPicks)
    const result = computeStandings(secRoundRobinGames, allTeams, secRoundRobinPicks, resolved)

    expect(result.SEC!.map(r => r.rank)).toEqual([1, 2, 2, 2, 5])
    expect(result.SEC![0]!.school).toBe('Alabama')
  })

  it('does not throw on untrusted picks', () => {
    expect(() =>
      resolveAllConferences(secRoundRobinGames, allTeams, { 101: AKRON, 424242: ALABAMA })
    ).not.toThrow()
  })

  it('skips a conference with no members rather than resolving an empty pool', () => {
    const secOnly = allTeams.filter(t => t.conference === 'SEC')
    const resolved = resolveAllConferences(secRoundRobinGames, secOnly, secRoundRobinPicks)

    expect(Object.keys(resolved)).toEqual(['SEC'])
  })

  it('still returns all four conference keys from computeStandings when a conference has no members', () => {
    const secOnly = allTeams.filter(t => t.conference === 'SEC')
    const result = computeStandings(secRoundRobinGames, secOnly, secRoundRobinPicks)

    expect(Object.keys(result).sort()).toEqual(['ACC', 'Big 12', 'Big Ten', 'SEC'])
    expect(result.ACC).toEqual([])
  })
})
