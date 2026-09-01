/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import {
  transformRoster,
  transformCoaches,
  transformRecruiting,
  transformRecords,
  transformTeamStats,
  transformPlayerStats,
  transformTeamRatings,
  buildTeamIdByName
} from '../scripts/lib/schemas'

const teamIdByName = buildTeamIdByName([
  { id: 1, school: 'Ohio State' },
  { id: 2, school: 'Michigan' }
])

describe('transformRoster', () => {
  it('resolves teamId by name and passes fields through', () => {
    const raw = [
      { id: 'abc-123', firstName: 'Will', lastName: 'Howard', team: 'Ohio State', position: 'QB', jersey: 18, height: 74, weight: 235 }
    ]
    expect(transformRoster(raw, teamIdByName)).toEqual([
      { id: 'abc-123', teamId: 1, firstName: 'Will', lastName: 'Howard', position: 'QB', jersey: 18, height: 74, weight: 235 }
    ])
  })

  it('drops a player whose team name does not resolve', () => {
    const raw = [
      { id: 'x', firstName: 'A', lastName: 'B', team: 'Some FCS School', position: null, jersey: null, height: null, weight: null }
    ]
    expect(transformRoster(raw, teamIdByName)).toEqual([])
  })
})

describe('transformCoaches', () => {
  it('picks the season matching targetYear and sums career record across all seasons', () => {
    const raw = [
      {
        firstName: 'Ryan',
        lastName: 'Day',
        seasons: [
          { teamId: 1, year: 2023, wins: 11, losses: 2, ties: 0 },
          { teamId: 1, year: 2024, wins: 14, losses: 2, ties: 0 }
        ]
      }
    ]
    expect(transformCoaches(raw, 2024)).toEqual([
      {
        teamId: 1,
        firstName: 'Ryan',
        lastName: 'Day',
        currentSeason: { year: 2024, wins: 14, losses: 2, ties: 0 },
        careerRecord: { wins: 25, losses: 4, ties: 0, firstYear: 2023, lastYear: 2024 }
      }
    ])
  })

  it('omits a coach with no season entry for targetYear', () => {
    const raw = [
      { firstName: 'A', lastName: 'B', seasons: [{ teamId: 1, year: 2020, wins: 1, losses: 1, ties: 0 }] }
    ]
    expect(transformCoaches(raw, 2024)).toEqual([])
  })

  it('a later coach record for the same team+year wins (interim replacement)', () => {
    const raw = [
      { firstName: 'Fired', lastName: 'Coach', seasons: [{ teamId: 1, year: 2024, wins: 3, losses: 4, ties: 0 }] },
      { firstName: 'Interim', lastName: 'Coach', seasons: [{ teamId: 1, year: 2024, wins: 2, losses: 3, ties: 0 }] }
    ]
    const result = transformCoaches(raw, 2024)
    expect(result).toHaveLength(1)
    expect(result[0]!.lastName).toBe('Coach')
    expect(result[0]!.firstName).toBe('Interim')
  })
})

describe('transformRecruiting', () => {
  it('resolves teamId by name', () => {
    const raw = [{ rank: 3, team: 'Michigan', points: 285.5 }]
    expect(transformRecruiting(raw, teamIdByName)).toEqual([{ teamId: 2, rank: 3, points: 285.5 }])
  })
})

describe('transformRecords', () => {
  it('passes teamId and split records straight through', () => {
    const split = { games: 12, wins: 10, losses: 2, ties: 0 }
    const raw = [{
      teamId: 1,
      expectedWins: 9.4,
      total: split,
      conferenceGames: split,
      homeGames: split,
      awayGames: split,
      neutralSiteGames: split
    }]
    expect(transformRecords(raw)).toEqual([{
      teamId: 1,
      expectedWins: 9.4,
      total: split,
      conferenceGames: split,
      homeGames: split,
      awayGames: split,
      neutralSiteGames: split
    }])
  })
})

describe('transformTeamStats', () => {
  it('pivots flat statName/statValue rows into one row per team', () => {
    const raw = [
      { team: 'Ohio State', statName: 'totalYards', statValue: 5230 },
      { team: 'Ohio State', statName: 'sacks', statValue: 38 },
      { team: 'Michigan', statName: 'totalYards', statValue: 4800 }
    ]
    const result = transformTeamStats(raw, teamIdByName)
    expect(result).toContainEqual({ teamId: 1, stats: { totalYards: 5230, sacks: 38 } })
    expect(result).toContainEqual({ teamId: 2, stats: { totalYards: 4800 } })
  })

  it('drops rows whose team name does not resolve', () => {
    const raw = [{ team: 'Unknown School', statName: 'totalYards', statValue: 100 }]
    expect(transformTeamStats(raw, teamIdByName)).toEqual([])
  })
})

describe('transformPlayerStats', () => {
  it('resolves teamId and enriches with roster jersey', () => {
    const jerseyByPlayerId = new Map([['p1', 18]])
    const raw = [
      { playerId: 'p1', player: 'Will Howard', position: 'QB', team: 'Ohio State', category: 'passing', statType: 'YDS', stat: 4123 }
    ]
    expect(transformPlayerStats(raw, teamIdByName, jerseyByPlayerId)).toEqual([
      { playerId: 'p1', player: 'Will Howard', teamId: 1, position: 'QB', category: 'passing', statType: 'YDS', stat: 4123, jersey: 18 }
    ])
  })

  it('falls back to jersey null when the player is not on the committed roster', () => {
    const raw = [
      { playerId: 'p2', player: 'Walk On', position: 'WR', team: 'Ohio State', category: 'receiving', statType: 'YDS', stat: 50 }
    ]
    expect(transformPlayerStats(raw, teamIdByName, new Map())[0]!.jersey).toBeNull()
  })
})

describe('transformTeamRatings SP+ breakdown', () => {
  it('carries offense/defense sub-ratings through onto the merged row', () => {
    const rawSp = [{
      team: 'Ohio State',
      rating: 25.3,
      ranking: 1,
      offense: { rating: 40.1, ranking: 2, success: 0.51, explosiveness: 1.8 },
      defense: { rating: -14.8, ranking: 3, success: 0.32, explosiveness: 1.1 }
    }]
    const result = transformTeamRatings(rawSp, [], [], [], teamIdByName)
    expect(result).toEqual([{
      teamId: 1,
      spRating: 25.3,
      spRanking: 1,
      spOffense: { rating: 40.1, ranking: 2, success: 0.51, explosiveness: 1.8 },
      spDefense: { rating: -14.8, ranking: 3, success: 0.32, explosiveness: 1.1 },
      fpi: null,
      fpiRanking: null,
      elo: null,
      atsWins: null,
      atsLosses: null,
      atsPushes: null
    }])
  })
})
