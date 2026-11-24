import { describe, it, expect } from 'vitest'
import type { Game, Team } from '../../shared/types/schedule'
import { homeWinProbability, ratingWinProbability, FBS_VS_FCS_WIN_PROBABILITY } from '../../shared/domain/odds/winProbability'
import { createSeasonModel, EMPTY_SCENARIO, projectSeason, currentBracketField, seasonModelDataFrom } from '../../shared/domain/odds/seasonModel'
import { enumerateTitleGamePaths } from '../../shared/domain/odds/paths'
import { simulateSeason, winOutOdds } from '../../shared/domain/odds/simulate'
import { modelFingerprint } from '../../shared/domain/odds/fingerprint'

function team(id: number, conference: string): Team {
  return { id, school: `T${id}`, mascot: null, abbreviation: null, conference, classification: 'fbs', color: '#000000', alternateColor: '#ffffff', logo: '' }
}

let nextGameId = 1000
function game(homeId: number, awayId: number, opts: Partial<Game> = {}): Game {
  return {
    id: nextGameId++,
    week: 10,
    seasonType: 'regular',
    homeId,
    homeTeam: `T${homeId}`,
    awayId,
    awayTeam: `T${awayId}`,
    conferenceGame: true,
    neutralSite: false,
    venueId: null,
    completed: false,
    homePoints: null,
    awayPoints: null,
    ...opts
  }
}

function final(homeId: number, awayId: number, homePoints: number, awayPoints: number): Game {
  return game(homeId, awayId, { completed: true, homePoints, awayPoints, week: 9 })
}

/**
 * Four-team SEC: A(1) 2-0, B(2) 1-1, C(3) 1-1, D(4) 0-2 with A-D and B-C
 * left. A is in either way (3-0, or 2-1 tied with the B/C winner for the
 * top two); the B-C winner takes the other spot; D is out.
 */
function miniSeason() {
  const teams = [team(1, 'SEC'), team(2, 'SEC'), team(3, 'SEC'), team(4, 'SEC'), team(87, 'FBS Independents')]
  const games = [
    final(1, 2, 30, 10),
    final(1, 3, 30, 10),
    final(2, 4, 30, 10),
    final(3, 4, 30, 10),
    game(1, 4, { week: 11 }),
    game(2, 3, { week: 11 })
  ]
  const bc = games[5]!
  const data = seasonModelDataFrom({
    season: 2026,
    games,
    teams,
    winProbabilities: { probabilities: [{ gameId: bc.id, homeWinProbability: 0.6 }] },
    teamRatings: { ratings: teams.map(t => ({ teamId: t.id, spRating: 10 })) }
  })
  return { teams, games, data, bc, ad: games[4]! }
}

describe('win probability', () => {
  const inputs = { pregame: new Map([[1, 0.8]]), spRatings: new Map([[10, 20], [11, 10]]) }

  it('prefers the betting-line probability when one exists', () => {
    expect(homeWinProbability(inputs, { id: 1, homeId: 10, awayId: 11, neutralSite: false })).toBe(0.8)
  })

  it('falls back to SP+ with home field, symmetric at a neutral site', () => {
    const home = homeWinProbability(inputs, { id: 2, homeId: 10, awayId: 11, neutralSite: false })
    const neutral = ratingWinProbability(inputs, 10, 11, false)
    expect(home).toBeGreaterThan(neutral)
    expect(ratingWinProbability(inputs, 10, 11, false) + ratingWinProbability(inputs, 11, 10, false)).toBeCloseTo(1, 10)
  })

  it('gives the FBS team the FCS-matchup rate when the opponent has no rating', () => {
    expect(ratingWinProbability(inputs, 10, 999, true)).toBe(FBS_VS_FCS_WIN_PROBABILITY)
  })
})

describe('exact title-game paths', () => {
  it('finds the clinched, alive and eliminated teams and their paths', () => {
    const { data, bc } = miniSeason()
    const model = createSeasonModel(data)
    const result = enumerateTitleGamePaths(model, EMPTY_SCENARIO, 'SEC')
    expect(result.mode).toBe('exact')
    if (result.mode !== 'exact') return

    expect(result.combinations).toBe(4)
    const byId = new Map(result.teams.map(t => [t.teamId, t]))
    expect(byId.get(1)!.status).toBe('clinched')
    expect(byId.get(4)!.status).toBe('eliminated')

    const b = byId.get(2)!
    expect(b.status).toBe('alive')
    expect(b.controlsDestiny).toBe(true)
    expect(b.probability).toBeCloseTo(0.6, 10)
    expect(b.paths).toHaveLength(1)
    expect(b.paths[0]!.conditions).toEqual([{ gameId: bc.id, winnerId: 2, loserId: 3 }])

    // Exactly two title-game spots per combination.
    const total = result.teams.reduce((sum, t) => sum + t.probability, 0)
    expect(total).toBeCloseTo(2, 10)
  })

  it('treats a picked game as fixed, collapsing the paths', () => {
    const { data, bc } = miniSeason()
    const model = createSeasonModel(data)
    const result = enumerateTitleGamePaths(model, { ...EMPTY_SCENARIO, picks: { [bc.id]: 3 } }, 'SEC')
    if (result.mode !== 'exact') throw new Error('expected exact')
    expect(result.combinations).toBe(2)
    const byId = new Map(result.teams.map(t => [t.teamId, t]))
    expect(byId.get(3)!.status).toBe('clinched')
    expect(byId.get(2)!.status).toBe('eliminated')
  })

  it('reports too-many when more games are open than the exact limit', () => {
    const { data } = miniSeason()
    const model = createSeasonModel(data)
    expect(enumerateTitleGamePaths(model, EMPTY_SCENARIO, 'SEC', 1)).toEqual({ mode: 'too-many', conference: 'SEC', openGames: 2 })
  })
})

describe('season simulation', () => {
  it('awards exactly two title-game spots per simulated season and is reproducible', () => {
    const { data } = miniSeason()
    const model = createSeasonModel(data)
    const a = simulateSeason(model, EMPTY_SCENARIO, 400, 42)
    const b = simulateSeason(model, EMPTY_SCENARIO, 400, 42)
    expect(a).toEqual(b)

    const sec = a.teams.filter(t => model.teamById.get(t.teamId)!.conference === 'SEC')
    expect(sec.reduce((sum, t) => sum + t.titleGame, 0)).toBeCloseTo(2, 10)
    expect(sec.reduce((sum, t) => sum + t.conferenceTitle, 0)).toBeCloseTo(1, 10)
    expect(a.teams.find(t => t.teamId === 1)!.titleGame).toBe(1)
    expect(a.teams.find(t => t.teamId === 4)!.titleGame).toBe(0)
    expect(a.teams.find(t => t.teamId === 2)!.titleGame).toBeGreaterThan(0.45)
    expect(a.teams.find(t => t.teamId === 2)!.titleGame).toBeLessThan(0.75)
  })

  it('puts the B-C game at the top of both teams\' title-game leverage', () => {
    const { data, bc } = miniSeason()
    const model = createSeasonModel(data)
    const odds = simulateSeason(model, EMPTY_SCENARIO, 400, 3)
    const top = odds.titleGameLeverage[2]![0]!
    expect(top.gameId).toBe(bc.id)
    expect(top.delta).toBeCloseTo(1, 5)
  })

  it('winning out guarantees B a title-game spot', () => {
    const { data } = miniSeason()
    const model = createSeasonModel(data)
    const result = winOutOdds(model, EMPTY_SCENARIO, 2, 200)
    expect(result.gamesForced).toBe(1)
    expect(result.titleGame).toBe(1)
  })

  it('projects favorites into the title game and seeds a field', () => {
    const { data } = miniSeason()
    const model = createSeasonModel(data)
    const draw = projectSeason(model, EMPTY_SCENARIO)
    expect(draw.titleGame.get('SEC')!.participants).toEqual([1, 2])
    expect(draw.field.length).toBe(data.teams.length)
    expect(draw.field.map(e => e.seed)).toEqual(draw.field.map((_, i) => i + 1))
    expect(currentBracketField(model).length).toBe(data.teams.length)
  })
})

describe('model fingerprint', () => {
  it('changes when a game result changes', () => {
    const { data } = miniSeason()
    const before = modelFingerprint(data)
    const games = data.games.map((g, i) => (i === 4 ? { ...g, completed: true, homePoints: 21, awayPoints: 7 } : g))
    expect(modelFingerprint({ ...data, games })).not.toBe(before)
    expect(modelFingerprint(data)).toBe(before)
  })
})
