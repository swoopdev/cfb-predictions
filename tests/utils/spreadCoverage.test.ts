import { describe, it, expect } from 'vitest'
import { computeSpreadCoverage } from '~/utils/spreadCoverage'
import type { BettingLine } from '#shared/types/bettingLines'

function makeLine(overrides: Partial<BettingLine> = {}): BettingLine {
  return {
    gameId: 1,
    favored: 'home',
    spread: 7.5,
    homeMoneyline: -300,
    awayMoneyline: 240,
    openFavored: 'home',
    openSpread: 7.5,
    ...overrides
  }
}

describe('computeSpreadCoverage', () => {
  it('returns undefined when no line is published', () => {
    expect(computeSpreadCoverage(undefined, 31, 24)).toBeUndefined()
  })

  it('returns undefined when the score is not yet final', () => {
    expect(computeSpreadCoverage(makeLine(), null, null)).toBeUndefined()
  })

  it('favorite covers when they win by more than the spread', () => {
    const line = makeLine({ favored: 'home', spread: 7.5 })
    expect(computeSpreadCoverage(line, 31, 20)).toBe('home') // won by 11
  })

  it('underdog covers when the favorite wins by less than the spread', () => {
    const line = makeLine({ favored: 'home', spread: 7.5 })
    expect(computeSpreadCoverage(line, 24, 20)).toBe('away') // won by only 4
  })

  it('underdog covers when they win outright', () => {
    const line = makeLine({ favored: 'home', spread: 7.5 })
    expect(computeSpreadCoverage(line, 17, 24)).toBe('away')
  })

  it('handles the favorite being the away team', () => {
    const line = makeLine({ favored: 'away', spread: 3 })
    expect(computeSpreadCoverage(line, 10, 20)).toBe('away') // away won by 10, covers -3
    expect(computeSpreadCoverage(line, 18, 20)).toBe('home') // away won by only 2, home covers +3
  })

  it('returns undefined on a push (margin exactly equals the spread)', () => {
    const line = makeLine({ favored: 'home', spread: 7 })
    expect(computeSpreadCoverage(line, 27, 20)).toBeUndefined()
  })

  it('pick \'em: straight-up winner covers', () => {
    const line = makeLine({ favored: 'even', spread: 0 })
    expect(computeSpreadCoverage(line, 21, 17)).toBe('home')
    expect(computeSpreadCoverage(line, 17, 21)).toBe('away')
  })

  it('pick \'em: a tie is a push', () => {
    const line = makeLine({ favored: 'even', spread: 0 })
    expect(computeSpreadCoverage(line, 21, 21)).toBeUndefined()
  })
})
