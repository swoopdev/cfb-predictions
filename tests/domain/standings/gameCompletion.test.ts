import { describe, it, expect } from 'vitest'
import { reconcilePicks } from '../../../shared/domain/standings/gameCompletion'
import type { Game } from '../../../shared/types/schedule'

function makeGame(overrides: Partial<Game> & Pick<Game, 'id' | 'homeId' | 'awayId'>): Game {
  return {
    week: 1,
    seasonType: 'regular',
    homeTeam: 'Home',
    awayTeam: 'Away',
    conferenceGame: false,
    neutralSite: false,
    venueId: null,
    completed: false,
    homePoints: null,
    awayPoints: null,
    ...overrides
  }
}

describe('reconcilePicks', () => {
  it('overwrites a wrong pick with the actual winner once the game completes', () => {
    const games = [makeGame({ id: 1, homeId: 100, awayId: 200, completed: true, homePoints: 24, awayPoints: 17 })]
    const picks = { 1: 200 } // picked the away team, who lost

    const result = reconcilePicks(games, picks)

    expect(result[1]).toBe(100)
  })

  it('leaves an already-correct pick untouched (same object reference)', () => {
    const games = [makeGame({ id: 1, homeId: 100, awayId: 200, completed: true, homePoints: 24, awayPoints: 17 })]
    const picks = { 1: 100 }

    const result = reconcilePicks(games, picks)

    expect(result).toBe(picks)
  })

  it('does not touch picks for games that are not yet completed', () => {
    const games = [makeGame({ id: 1, homeId: 100, awayId: 200, completed: false })]
    const picks = { 1: 200 }

    const result = reconcilePicks(games, picks)

    expect(result).toBe(picks)
    expect(result[1]).toBe(200)
  })

  it('leaves an unpicked completed game alone (adds no new pick)', () => {
    const games = [makeGame({ id: 1, homeId: 100, awayId: 200, completed: true, homePoints: 24, awayPoints: 17 })]
    const picks = {}

    const result = reconcilePicks(games, picks)

    expect(result[1]).toBe(100)
  })

  it('does not guess a winner for a tied completed game', () => {
    const games = [makeGame({ id: 1, homeId: 100, awayId: 200, completed: true, homePoints: 21, awayPoints: 21 })]
    const picks = { 1: 200 }

    const result = reconcilePicks(games, picks)

    expect(result).toBe(picks)
    expect(result[1]).toBe(200)
  })

  it('leaves picks alone when completed but points have not been published yet', () => {
    const games = [makeGame({ id: 1, homeId: 100, awayId: 200, completed: true, homePoints: null, awayPoints: null })]
    const picks = { 1: 200 }

    const result = reconcilePicks(games, picks)

    expect(result).toBe(picks)
  })

  it('reconciles multiple games independently, preserving unrelated picks', () => {
    const games = [
      makeGame({ id: 1, homeId: 100, awayId: 200, completed: true, homePoints: 24, awayPoints: 17 }),
      makeGame({ id: 2, homeId: 300, awayId: 400, completed: false })
    ]
    const picks = { 1: 200, 2: 300, 3: 999 }

    const result = reconcilePicks(games, picks)

    expect(result).toEqual({ 1: 100, 2: 300, 3: 999 })
  })
})
