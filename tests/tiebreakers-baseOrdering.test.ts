import { describe, it, expect } from 'vitest'
import { computeBaseOrdering } from '../shared/domain/tiebreakers/baseOrdering'
import type { ConferenceRecord } from '../shared/domain/tiebreakers/records'

function record(teamId: number, wins: number, losses: number): ConferenceRecord {
  const gamesPlayed = wins + losses
  return {
    teamId,
    wins,
    losses,
    gamesPlayed,
    winPct: gamesPlayed === 0 ? 0 : wins / gamesPlayed,
    beat: new Set(),
    lostTo: new Set(),
    opponents: new Set()
  }
}

describe('computeBaseOrdering', () => {
  it('groups a 4-team fixture with one 2-way raw win-pct tie into 3 buckets in best-to-worst order', () => {
    // Team 1: 3-0 (1.0), Team 2 & Team 3: 2-1 (0.667) tied, Team 4: 0-3 (0.0)
    const records = new Map<number, ConferenceRecord>([
      [1, record(1, 3, 0)],
      [2, record(2, 2, 1)],
      [3, record(3, 2, 1)],
      [4, record(4, 0, 3)]
    ])

    const ordering = computeBaseOrdering(records)

    expect(ordering).toHaveLength(3)
    expect(ordering[0]).toEqual([1])
    expect(ordering[1]).toEqual([2, 3])
    expect(ordering[2]).toEqual([4])
  })

  it('orders teamIds within a tied bucket ascending by id for determinism', () => {
    const records = new Map<number, ConferenceRecord>([
      [5, record(5, 2, 1)],
      [2, record(2, 2, 1)],
      [9, record(9, 2, 1)]
    ])

    const ordering = computeBaseOrdering(records)

    expect(ordering).toEqual([[2, 5, 9]])
  })

  it('places all-zero-games teams (winPct 0) in the lowest bucket without producing NaN buckets', () => {
    const records = new Map<number, ConferenceRecord>([
      [1, record(1, 1, 0)],
      [2, record(2, 0, 0)]
    ])

    const ordering = computeBaseOrdering(records)

    expect(ordering).toEqual([[1], [2]])
  })
})
