import { describe, it, expect } from 'vitest'
import { filterGames } from '../../app/utils/schedule'
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
    neutralSite: false
  }
}

describe('filterGames', () => {
  const teamsById = new Map<number, Team>([
    [1, makeTeam(1, 'SEC')],
    [2, makeTeam(2, 'Big Ten')],
    [3, makeTeam(3, 'ACC')],
    [4, makeTeam(4, 'SEC')]
  ])

  it('returns games unchanged when no filter is set', () => {
    const games = [makeGame(101, 1, 2), makeGame(102, 3, 4)]
    expect(filterGames(games, {}, teamsById)).toEqual(games)
  })

  it('filters by team, matching either home OR away side, preserving order', () => {
    const games = [
      makeGame(101, 5, 1), // team 5 home
      makeGame(102, 2, 5), // team 5 away
      makeGame(103, 2, 3) // no team 5
    ]
    const result = filterGames(games, { team: [5] }, teamsById)
    expect(result).toEqual([games[0], games[1]])
  })

  it('filters by conference, matching either home OR away side — cross-conference game appears under both conferences', () => {
    // SEC (team 1) at Big Ten (team 2) — should appear under both SEC and Big Ten filters.
    const crossConfGame = makeGame(201, 2, 1)
    const secOnlyGame = makeGame(202, 1, 4)
    const games = [crossConfGame, secOnlyGame]

    const secResult = filterGames(games, { conf: ['SEC'] }, teamsById)
    expect(secResult).toEqual([crossConfGame, secOnlyGame])

    const bigTenResult = filterGames(games, { conf: ['Big Ten'] }, teamsById)
    expect(bigTenResult).toEqual([crossConfGame])
  })

  it('when both conf and team are set, team wins (defensive fallback)', () => {
    const games = [
      makeGame(101, 5, 1), // team 5 home, not SEC
      makeGame(102, 1, 4) // SEC vs SEC, no team 5
    ]
    const result = filterGames(games, { conf: ['SEC'], team: [5] }, teamsById)
    expect(result).toEqual(filterGames(games, { team: [5] }, teamsById))
    expect(result).toEqual([games[0]])
  })
})
