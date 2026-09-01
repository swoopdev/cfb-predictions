import { describe, it, expect } from 'vitest'
import { groupByConference } from '../../app/utils/schedule'
import type { Game, Team } from '../../shared/types/schedule'

function makeTeam(id: number, conference: string): Team {
  return {
    id,
    school: `Team ${id}`,
    mascot: null,
    abbreviation: null,
    conference,
    classification: 'fbs',
    color: '#000000',
    alternateColor: '#ffffff',
    logo: `/logos/${id}.png`
  }
}

function makeGame(id: number, homeId: number, awayId: number): Game {
  return {
    id,
    week: 1,
    seasonType: 'regular',
    homeId,
    homeTeam: `Team ${homeId}`,
    awayId,
    awayTeam: `Team ${awayId}`,
    conferenceGame: false,
    neutralSite: false,
    venueId: null,
    completed: false,
    homePoints: null,
    awayPoints: null
  }
}

describe('groupByConference', () => {
  it('returns an empty array for an empty game list', () => {
    expect(groupByConference([], new Map())).toEqual([])
  })

  it('groups games by the home team conference and sorts groups alphabetically', () => {
    const teamsById = new Map<number, Team>([
      [1, makeTeam(1, 'SEC')],
      [2, makeTeam(2, 'ACC')],
      [3, makeTeam(3, 'Big Ten')],
      [4, makeTeam(4, 'SEC')]
    ])
    const games: Game[] = [
      makeGame(101, 1, 2), // home team 1 -> SEC
      makeGame(102, 2, 3), // home team 2 -> ACC
      makeGame(103, 3, 4), // home team 3 -> Big Ten
      makeGame(104, 4, 1) // home team 4 -> SEC
    ]

    const result = groupByConference(games, teamsById)

    expect(result).toEqual([
      { conference: 'ACC', games: [games[1]] },
      { conference: 'Big Ten', games: [games[2]] },
      { conference: 'SEC', games: [games[0], games[3]] }
    ])
  })

  it('groups by the HOME team conference even when the away team is unresolvable (FCS opponent)', () => {
    const teamsById = new Map<number, Team>([
      [1, makeTeam(1, 'Mountain West')]
    ])
    // awayId 999 has no entry in teamsById — home team's conference must still
    // drive the grouping key (RESEARCH.md Pitfall 5 / D-07).
    const games: Game[] = [makeGame(201, 1, 999)]

    const result = groupByConference(games, teamsById)

    expect(result).toEqual([
      { conference: 'Mountain West', games: [games[0]] }
    ])
  })
})
