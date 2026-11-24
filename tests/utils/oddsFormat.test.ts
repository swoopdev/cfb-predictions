import { describe, it, expect } from 'vitest'
import { conferenceSlug, CONFERENCE_SLUGS, formatDelta, formatOdds, groupPaths } from '~/utils/oddsFormat'

describe('formatOdds', () => {
  it('never prints a simulated certainty as 0% or 100%', () => {
    expect(formatOdds(0)).toBe('<1%')
    expect(formatOdds(1)).toBe('>99%')
    expect(formatOdds(0.004)).toBe('<1%')
    expect(formatOdds(0.996)).toBe('>99%')
    expect(formatOdds(0.4249)).toBe('42%')
    expect(formatOdds(undefined)).toBe('—')
  })

  it('prints exact locks as 0% / 100%, tolerating float error', () => {
    expect(formatOdds(0.9999999999999, true)).toBe('100%')
    expect(formatOdds(1e-15, true)).toBe('0%')
    expect(formatOdds(0.75, true)).toBe('75%')
  })

  it('formats leverage as signed points', () => {
    expect(formatDelta(0.123)).toBe('+12')
    expect(formatDelta(-0.04)).toBe('−4')
    expect(formatDelta(0.001)).toBe('<1')
  })
})

describe('conference slugs', () => {
  it('round-trips every Power Four conference', () => {
    for (const [slug, conference] of Object.entries(CONFERENCE_SLUGS)) expect(conferenceSlug(conference)).toBe(slug)
    expect(conferenceSlug('Mountain West')).toBeUndefined()
  })
})

describe('groupPaths', () => {
  const TEAM = 1
  const own = { gameId: 10, winnerId: TEAM, loserId: 2 }
  const helpA = { gameId: 20, winnerId: 3, loserId: 4 }
  const helpB = { gameId: 30, winnerId: 5, loserId: 6 }
  const helpC = { gameId: 40, winnerId: 7, loserId: 8 }

  it('groups paths by the team\'s own results and lists outside help as alternatives', () => {
    const groups = groupPaths(TEAM, [
      { conditions: [own, helpA], probability: 0.5 },
      { conditions: [own, helpB, helpC], probability: 0.2 },
      { conditions: [helpA, helpB], probability: 0.1 }
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]).toEqual({ own: [own], options: [[helpA], [helpB, helpC]], bestProbability: 0.5 })
    expect(groups[1]).toEqual({ own: [], options: [[helpA, helpB]], bestProbability: 0.1 })
  })

  it('marks a group whose own results suffice with no options', () => {
    const groups = groupPaths(TEAM, [{ conditions: [own], probability: 0.8 }])
    expect(groups).toEqual([{ own: [own], options: [], bestProbability: 0.8 }])
  })

  it('treats a loss in the team\'s own game as its own condition', () => {
    const ownLoss = { gameId: 11, winnerId: 9, loserId: TEAM }
    const groups = groupPaths(TEAM, [{ conditions: [ownLoss, helpA], probability: 0.3 }])
    expect(groups[0]!.own).toEqual([ownLoss])
  })
})
