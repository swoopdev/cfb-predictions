import { describe, it, expect } from 'vitest'
import { playoffFormatFor, NOTRE_DAME_TEAM_ID } from '../../shared/domain/playoff/formats'
import { selectPlayoffField } from '../../shared/domain/playoff/field'
import { resolveBracket, simulateBracketPicks, bracketChampion } from '../../shared/domain/playoff/bracket'
import { anchorScores, committeeRanking } from '../../shared/domain/playoff/committee'

const format = playoffFormatFor(2026)

/** Teams 1..30 ranked in id order. Team 1-4 SEC/Big Ten/Big 12/ACC champions by default. */
function champions(overrides: Record<string, number[]> = {}) {
  return new Map<string, number[]>(Object.entries({
    'SEC': [1],
    'Big Ten': [2],
    'Big 12': [3],
    'ACC': [4],
    'American Athletic': [20],
    'Mountain West': [25],
    'Sun Belt': [26],
    'Mid-American': [27],
    'Conference USA': [28],
    'Pac-12': [29],
    ...overrides
  }))
}
const order = Array.from({ length: 30 }, (_, i) => i + 1)

describe('2026 playoff field selection', () => {
  it('seeds twelve teams straight by ranking with the best G6 champion in', () => {
    const field = selectPlayoffField(format, order, champions())
    expect(field.map(e => e.teamId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 20])
    expect(field.find(e => e.teamId === 20)!.autoBid).toContain('Group of Six')
    expect(field.find(e => e.teamId === 5)!.autoBid).toBeNull()
  })

  it('brings in a Power Four champion ranked outside the top 12 and seeds it by rank', () => {
    const field = selectPlayoffField(format, order, champions({ ACC: [18] }))
    expect(field.map(e => e.teamId)).toContain(18)
    expect(field.map(e => e.teamId)).not.toContain(11)
    expect(field.find(e => e.teamId === 18)!.seed).toBe(11)
    expect(field.find(e => e.teamId === 20)!.seed).toBe(12)
  })

  it('takes the highest-ranked candidate when a G6 champion is not yet known', () => {
    const field = selectPlayoffField(format, order, champions({ 'American Athletic': [22, 15, 30] }))
    expect(field.map(e => e.teamId)).toContain(15)
  })

  it('guarantees Notre Dame a spot when ranked in the top 12', () => {
    const ranked = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, NOTRE_DAME_TEAM_ID, ...order.slice(11)]
    const field = selectPlayoffField(format, ranked, champions({ 'ACC': [18], 'Big 12': [19] }))
    expect(field.map(e => e.teamId)).toContain(NOTRE_DAME_TEAM_ID)
    expect(field.find(e => e.teamId === NOTRE_DAME_TEAM_ID)!.autoBid).toContain('Notre Dame')
  })
})

describe('bracket', () => {
  const field = selectPlayoffField(format, order, champions())

  it('pairs 5v12, 6v11, 7v10, 8v9 and sends winners to the fixed quarterfinals', () => {
    const slots = resolveBracket(format, field, { 'r1-8-9': 9 })
    const r1 = slots.filter(s => s.def.round === 'first-round').map(s => [s.topSeed, s.bottomSeed])
    expect(r1).toEqual([[5, 12], [6, 11], [7, 10], [8, 9]])
    const qf1 = slots.find(s => s.def.id === 'qf-1')!
    expect(qf1.top).toBe(1)
    expect(qf1.bottom).toBe(9)
  })

  it('ignores a stale pick and lets a final score override a pick', () => {
    const slots = resolveBracket(format, field, { 'r1-5-12': 999, 'r1-6-11': 11 }, [
      { homeId: 6, awayId: 11, completed: true, homePoints: 31, awayPoints: 17 }
    ])
    expect(slots.find(s => s.def.id === 'r1-5-12')!.winner).toBeNull()
    const r6 = slots.find(s => s.def.id === 'r1-6-11')!
    expect(r6.winner).toBe(6)
    expect(r6.winnerSource).toBe('result')
    expect(r6.score).toEqual({ top: 31, bottom: 17 })
  })

  it('"Sim the rest" fills every slot through a champion and keeps existing picks', () => {
    const picks = simulateBracketPicks(format, field, { 'r1-8-9': 9 }, [], () => 0.5, () => 0.1)
    expect(picks['r1-8-9']).toBe(9)
    expect(Object.keys(picks)).toHaveLength(format.slots.length)
    expect(bracketChampion(resolveBracket(format, field, picks))).not.toBeNull()
  })
})

describe('committee model', () => {
  const sp = new Map([[1, 30], [2, 25], [3, 10], [4, 5]])
  const anchor = anchorScores({ source: 'cfp', week: 12, rankings: [{ teamId: 1, rank: 1 }, { teamId: 2, rank: 2 }] }, [1, 2, 3, 4], sp)

  it('keeps the anchor order when nothing has happened since', () => {
    expect(committeeRanking(anchor, [], sp).order).toEqual([1, 2, 3, 4])
  })

  it('drops the top team below No. 2 after a loss to an unranked team', () => {
    const { order } = committeeRanking(anchor, [{ winnerId: 3, loserId: 1, titleGame: false }], sp)
    expect(order.indexOf(1)).toBeGreaterThan(order.indexOf(2))
  })

  it('punishes a title-game loss less than a regular-season loss', () => {
    const regular = committeeRanking(anchor, [{ winnerId: 2, loserId: 1, titleGame: false }], sp).scores.get(1)!
    const titleGame = committeeRanking(anchor, [{ winnerId: 2, loserId: 1, titleGame: true }], sp).scores.get(1)!
    expect(titleGame).toBeGreaterThan(regular)
  })
})
