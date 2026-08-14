import { describe, it, expect } from 'vitest'
import type { TeamId, StepValue, StepOutcome } from '~/shared/domain/tiebreakers/types'
import type { ConferenceRecord } from '~/shared/domain/tiebreakers/records'
import {
  winPctSafe,
  evaluateHeadToHead,
  evaluateCommonOpponents,
  evaluateCumulativeOpponentWinPct,
  evaluateNextHighestPlacedCommonOpponent,
  evaluateTotalWins,
  evaluateStep
} from '~/shared/domain/tiebreakers/steps'
import type { BaseOrdering } from '~/shared/domain/tiebreakers/types'

describe('winPctSafe', () => {
  it('returns { kind: "indeterminate" } when gamesPlayed is 0', () => {
    const result = winPctSafe(0, 0)
    expect(result).toEqual({ kind: 'indeterminate' })
  })

  it('returns { kind: "record" } with computed winPct when gamesPlayed > 0', () => {
    const result = winPctSafe(3, 4)
    expect(result).toEqual({
      kind: 'record',
      wins: 3,
      losses: 1,
      winPct: 0.75
    })
  })

  it('handles 0 wins correctly', () => {
    const result = winPctSafe(0, 3)
    expect(result).toEqual({
      kind: 'record',
      wins: 0,
      losses: 3,
      winPct: 0
    })
  })

  it('handles perfect record correctly', () => {
    const result = winPctSafe(5, 5)
    expect(result).toEqual({
      kind: 'record',
      wins: 5,
      losses: 0,
      winPct: 1
    })
  })

  it('never produces NaN', () => {
    const results = [
      winPctSafe(0, 0),
      winPctSafe(0, 1),
      winPctSafe(1, 1),
      winPctSafe(10, 15)
    ]
    for (const result of results) {
      if (result.kind === 'record') {
        expect(Number.isNaN(result.winPct)).toBe(false)
      }
    }
  })
})

describe('evaluateHeadToHead', () => {
  it('partitions round-robin 3-team tie by head-to-head record', () => {
    // A beat B and C (2-0); B beat C and lost to A (1-1); C lost to everyone (0-2)
    // Within tied group [1, 2, 3]:
    // Team 1: vs [2,3] -> beat both -> 2-0
    // Team 2: vs [1,3] -> beat 3, lost to 1 -> 1-1
    // Team 3: vs [1,2] -> lost to both -> 0-2
    // Partition: [[1], [2], [3]] (each has different record)
    const teams: TeamId[] = [1, 2, 3]
    const records = new Map<TeamId, ConferenceRecord>([
      [
        1,
        {
          teamId: 1,
          wins: 2,
          losses: 0,
          gamesPlayed: 2,
          winPct: 1.0,
          beat: new Set([2, 3]),
          lostTo: new Set(),
          opponents: new Set([2, 3])
        }
      ],
      [
        2,
        {
          teamId: 2,
          wins: 1,
          losses: 1,
          gamesPlayed: 2,
          winPct: 0.5,
          beat: new Set([3]),
          lostTo: new Set([1]),
          opponents: new Set([1, 3])
        }
      ],
      [
        3,
        {
          teamId: 3,
          wins: 0,
          losses: 2,
          gamesPlayed: 2,
          winPct: 0.0,
          beat: new Set(),
          lostTo: new Set([1, 2]),
          opponents: new Set([1, 2])
        }
      ]
    ])

    const result = evaluateHeadToHead(teams, records)

    // Team 1 beat all others and has best record
    expect(result.step).toBe('head-to-head')
    expect(result.separated).toBe(true)
    expect(result.partition).toEqual([[1], [2], [3]])
  })

  it('returns separated:false for non-round-robin with no beatAllOthers', () => {
    // A beat B, B beat C, A did not play C
    const teams: TeamId[] = [1, 2, 3]
    const records = new Map<TeamId, ConferenceRecord>([
      [
        1,
        {
          teamId: 1,
          wins: 1,
          losses: 0,
          gamesPlayed: 1,
          winPct: 1.0,
          beat: new Set([2]),
          lostTo: new Set(),
          opponents: new Set([2])
        }
      ],
      [
        2,
        {
          teamId: 2,
          wins: 1,
          losses: 1,
          gamesPlayed: 2,
          winPct: 0.5,
          beat: new Set([3]),
          lostTo: new Set([1]),
          opponents: new Set([1, 3])
        }
      ],
      [
        3,
        {
          teamId: 3,
          wins: 0,
          losses: 1,
          gamesPlayed: 1,
          winPct: 0.0,
          beat: new Set(),
          lostTo: new Set([2]),
          opponents: new Set([2])
        }
      ]
    ])

    const result = evaluateHeadToHead(teams, records)

    expect(result.separated).toBe(false)
    expect(result.partition).toEqual([[1, 2, 3]])
    // All teams should have 'mixed' or 'no-common-games' result
    for (const { value } of result.values) {
      if (value.kind === 'headToHead') {
        expect(['mixed', 'no-common-games']).toContain(value.result)
      }
    }
  })
})

describe('evaluateCommonOpponents', () => {
  it('returns separated:false with indeterminate values when zero common opponents', () => {
    // Team 1 beat A; Team 2 beat B; Team 3 beat C
    // No common opponents among the three
    const teams: TeamId[] = [1, 2, 3]
    const records = new Map<TeamId, ConferenceRecord>([
      [
        1,
        {
          teamId: 1,
          wins: 1,
          losses: 0,
          gamesPlayed: 1,
          winPct: 1.0,
          beat: new Set([10]),
          lostTo: new Set(),
          opponents: new Set([10])
        }
      ],
      [
        2,
        {
          teamId: 2,
          wins: 1,
          losses: 0,
          gamesPlayed: 1,
          winPct: 1.0,
          beat: new Set([20]),
          lostTo: new Set(),
          opponents: new Set([20])
        }
      ],
      [
        3,
        {
          teamId: 3,
          wins: 1,
          losses: 0,
          gamesPlayed: 1,
          winPct: 1.0,
          beat: new Set([30]),
          lostTo: new Set(),
          opponents: new Set([30])
        }
      ]
    ])

    const result = evaluateCommonOpponents(teams, records)

    expect(result.step).toBe('common-opponents')
    expect(result.separated).toBe(false)
    expect(result.partition).toEqual([[1, 2, 3]])

    // All values should be indeterminate
    for (const { value } of result.values) {
      expect(value).toEqual({ kind: 'indeterminate' })
    }

    // Verify no NaN anywhere
    for (const { value } of result.values) {
      if (value.kind === 'record') {
        expect(Number.isNaN(value.winPct)).toBe(false)
      }
    }
  })

  it('computes win pct against common opponents only', () => {
    // All three teams beat opponent 100, but:
    // Team 1: beat 100, 101
    // Team 2: beat 100, 102
    // Team 3: beat 100, 103
    // Common opponent: only 100
    // Team 1: 1-0 vs 100 = 1.0
    // Team 2: 1-0 vs 100 = 1.0
    // Team 3: 1-0 vs 100 = 1.0
    // (all tied on common opponents too, so no separation)

    // Let's make it clearer: team 1 beat 100, team 2 beat 100, team 3 lost to 100
    const teams: TeamId[] = [1, 2, 3]
    const records = new Map<TeamId, ConferenceRecord>([
      [
        1,
        {
          teamId: 1,
          wins: 2,
          losses: 0,
          gamesPlayed: 2,
          winPct: 1.0,
          beat: new Set([100, 101]),
          lostTo: new Set(),
          opponents: new Set([100, 101])
        }
      ],
      [
        2,
        {
          teamId: 2,
          wins: 2,
          losses: 0,
          gamesPlayed: 2,
          winPct: 1.0,
          beat: new Set([100, 102]),
          lostTo: new Set(),
          opponents: new Set([100, 102])
        }
      ],
      [
        3,
        {
          teamId: 3,
          wins: 1,
          losses: 1,
          gamesPlayed: 2,
          winPct: 0.5,
          beat: new Set([103]),
          lostTo: new Set([100]),
          opponents: new Set([100, 103])
        }
      ]
    ])

    const result = evaluateCommonOpponents(teams, records)

    expect(result.step).toBe('common-opponents')
    // Team 1 and 2 beat 100; Team 3 lost to 100. Should separate.
    expect(result.separated).toBe(true)
    expect(result.partition[0]).toContain(1)
    expect(result.partition[0]).toContain(2)
  })
})

describe('evaluateCumulativeOpponentWinPct', () => {
  it('uses record-weighted aggregate, not unweighted mean', () => {
    // Fixture that produces different results for weighted vs unweighted:
    // Team 1's opponents: W (2-3, 0.4), X (1-1, 0.5)
    //   -> weighted (2+1)/(3+1) = 3/4 = 0.75
    //   -> unweighted mean (0.4+0.5)/2 = 0.45
    // Team 2's opponents: W (2-3, 0.4), X (1-1, 0.5)
    //   -> weighted 0.75
    //   -> unweighted 0.45
    // Team 3's opponents: Y (0-1, 0.0), Z (5-5, 0.5)
    //   -> weighted (0+5)/(1+5) = 5/6 = 0.833
    //   -> unweighted (0+0.5)/2 = 0.25
    //
    // Weighted partition: [[3], [1, 2]]
    // Unweighted partition: [[1, 2], [3]]  <- opposite!
    // We should get the weighted result.

    const teams: TeamId[] = [1, 2, 3]
    const records = new Map<TeamId, ConferenceRecord>([
      [
        1,
        {
          teamId: 1,
          wins: 5,
          losses: 0,
          gamesPlayed: 5,
          winPct: 1.0,
          beat: new Set([10, 11]),
          lostTo: new Set(),
          opponents: new Set([10, 11])
        }
      ],
      [
        2,
        {
          teamId: 2,
          wins: 5,
          losses: 0,
          gamesPlayed: 5,
          winPct: 1.0,
          beat: new Set([10, 11]),
          lostTo: new Set(),
          opponents: new Set([10, 11])
        }
      ],
      [
        3,
        {
          teamId: 3,
          wins: 5,
          losses: 0,
          gamesPlayed: 5,
          winPct: 1.0,
          beat: new Set([20, 21]),
          lostTo: new Set(),
          opponents: new Set([20, 21])
        }
      ],
      // Opponent records: W (2-3), X (1-1), Y (0-1), Z (5-5)
      [
        10,
        {
          teamId: 10,
          wins: 2,
          losses: 3,
          gamesPlayed: 5,
          winPct: 0.4,
          beat: new Set(),
          lostTo: new Set(),
          opponents: new Set()
        }
      ],
      [
        11,
        {
          teamId: 11,
          wins: 1,
          losses: 1,
          gamesPlayed: 2,
          winPct: 0.5,
          beat: new Set(),
          lostTo: new Set(),
          opponents: new Set()
        }
      ],
      [
        20,
        {
          teamId: 20,
          wins: 0,
          losses: 1,
          gamesPlayed: 1,
          winPct: 0,
          beat: new Set(),
          lostTo: new Set(),
          opponents: new Set()
        }
      ],
      [
        21,
        {
          teamId: 21,
          wins: 5,
          losses: 5,
          gamesPlayed: 10,
          winPct: 0.5,
          beat: new Set(),
          lostTo: new Set(),
          opponents: new Set()
        }
      ]
    ])

    const result = evaluateCumulativeOpponentWinPct(teams, records)

    expect(result.step).toBe('cumulative-opponent-win-pct')
    // Weighted result: C (0.833) > A&B (0.75)
    // Unweighted would be: A&B (0.45) > C (0.25)
    // Verify we got the weighted result
    expect(result.partition[0]).toContain(3)
    expect(result.partition[1]).toContain(1)
    expect(result.partition[1]).toContain(2)
  })

  it('never produces NaN from zero-opponent-games edge case', () => {
    // A team with no opponents should get indeterminate, not NaN
    const teams: TeamId[] = [1, 2]
    const records = new Map<TeamId, ConferenceRecord>([
      [
        1,
        {
          teamId: 1,
          wins: 5,
          losses: 0,
          gamesPlayed: 5,
          winPct: 1.0,
          beat: new Set([10]),
          lostTo: new Set(),
          opponents: new Set([10])
        }
      ],
      [
        2,
        {
          teamId: 2,
          wins: 5,
          losses: 0,
          gamesPlayed: 5,
          winPct: 1.0,
          beat: new Set(),
          lostTo: new Set(),
          opponents: new Set()
        }
      ]
    ])

    const result = evaluateCumulativeOpponentWinPct(teams, records)

    expect(result.separated).toBe(false)
    for (const { value } of result.values) {
      if (value.kind === 'record') {
        expect(Number.isNaN(value.winPct)).toBe(false)
      }
    }
  })
})

describe('evaluateNextHighestPlacedCommonOpponent', () => {
  it('uses collective-bucket comparison when bucket has multiple tied teams (D-05)', () => {
    // Fixture per D-05: collective-bucket comparison vs one-opponent-at-a-time
    // Tied teams: [1, 2]
    // BaseOrdering (best to worst):
    //   - Bucket 0: [100] (raw winner)
    //   - Bucket 1: [101, 102] (tied raw standings - this is the qualifying bucket)
    //   - Bucket 2: [103]
    //
    // Team 1's record vs bucket [101, 102] combined:
    //   - beat 101, lost to 102 -> 1-1
    // Team 2's record vs bucket [101, 102] combined:
    //   - beat 102, lost to 101 -> 1-1
    //
    // If computed one-at-a-time against 101: T1 1-0 vs 101, T2 0-1 vs 101 -> would separate
    // But collective: both 1-1 -> no separation at this step
    const teams: TeamId[] = [1, 2]
    const baseOrdering: BaseOrdering = [[100], [101, 102], [103]]

    const records = new Map<TeamId, ConferenceRecord>([
      [
        1,
        {
          teamId: 1,
          wins: 5,
          losses: 0,
          gamesPlayed: 5,
          winPct: 1.0,
          beat: new Set([100, 101]),
          lostTo: new Set([102]),
          opponents: new Set([100, 101, 102])
        }
      ],
      [
        2,
        {
          teamId: 2,
          wins: 5,
          losses: 0,
          gamesPlayed: 5,
          winPct: 1.0,
          beat: new Set([100, 102]),
          lostTo: new Set([101]),
          opponents: new Set([100, 101, 102])
        }
      ],
      [
        101,
        {
          teamId: 101,
          wins: 3,
          losses: 2,
          gamesPlayed: 5,
          winPct: 0.6,
          beat: new Set(),
          lostTo: new Set(),
          opponents: new Set()
        }
      ],
      [
        102,
        {
          teamId: 102,
          wins: 2,
          losses: 3,
          gamesPlayed: 5,
          winPct: 0.4,
          beat: new Set(),
          lostTo: new Set(),
          opponents: new Set()
        }
      ]
    ])

    const result = evaluateNextHighestPlacedCommonOpponent(teams, baseOrdering, records)

    expect(result.step).toBe('next-highest-placed-common-opponent')
    // Both teams 1 and 2 have 1-1 record vs the collective bucket [101, 102]
    // Collective weighted: (1+1)/(1+1) = 2/2 = 1.0 for both
    // Should not separate
    expect(result.separated).toBe(false)
  })

  it('skips buckets with zero qualifying common opponents and walks down', () => {
    // BaseOrdering: [[100], [101, 102], [103]]
    // Teams [1, 2] have no common opponents in bucket 0 (only beat 100, but 2 didn't play 100)
    // Bucket 1 [101, 102]: only team 1 played 101; team 2 didn't play 101 (no common opponent)
    // Actually, let me make it clearer: both teams beat 103
    // BaseOrdering: [[100], [101], [102], [103]]
    // Teams [1, 2]: team 1 beat 101, lost to 102; team 2 beat 102, lost to 101
    // No common opponents until we reach bucket 3 where both played 103
    const teams: TeamId[] = [1, 2]
    const baseOrdering: BaseOrdering = [[100], [101], [102], [103]]

    const records = new Map<TeamId, ConferenceRecord>([
      [
        1,
        {
          teamId: 1,
          wins: 2,
          losses: 0,
          gamesPlayed: 2,
          winPct: 1.0,
          beat: new Set([200, 103]),
          lostTo: new Set(),
          opponents: new Set([200, 103])
        }
      ],
      [
        2,
        {
          teamId: 2,
          wins: 2,
          losses: 0,
          gamesPlayed: 2,
          winPct: 1.0,
          beat: new Set([201, 103]),
          lostTo: new Set(),
          opponents: new Set([201, 103])
        }
      ],
      [
        103,
        {
          teamId: 103,
          wins: 1,
          losses: 2,
          gamesPlayed: 3,
          winPct: 0.333,
          beat: new Set(),
          lostTo: new Set(),
          opponents: new Set()
        }
      ]
    ])

    const result = evaluateNextHighestPlacedCommonOpponent(teams, baseOrdering, records)

    // The walk should skip buckets 0, 1, 2 (none are in team opponents) and reach bucket 3 [103]
    // Both teams beat 103 -> both 1-0 -> tie
    expect(result.separated).toBe(false)
  })

  it('returns indeterminate when no qualifying bucket found in entire baseOrdering', () => {
    const teams: TeamId[] = [1, 2]
    const baseOrdering: BaseOrdering = [[100]]

    const records = new Map<TeamId, ConferenceRecord>([
      [
        1,
        {
          teamId: 1,
          wins: 1,
          losses: 0,
          gamesPlayed: 1,
          winPct: 1.0,
          beat: new Set([101]),
          lostTo: new Set(),
          opponents: new Set([101])
        }
      ],
      [
        2,
        {
          teamId: 2,
          wins: 1,
          losses: 0,
          gamesPlayed: 1,
          winPct: 1.0,
          beat: new Set([102]),
          lostTo: new Set(),
          opponents: new Set([102])
        }
      ]
    ])

    const result = evaluateNextHighestPlacedCommonOpponent(teams, baseOrdering, records)

    expect(result.separated).toBe(false)
    expect(result.values.every(({ value }) => value.kind === 'indeterminate')).toBe(true)
  })
})

describe('evaluateTotalWins', () => {
  it('partitions by FCS-capped overall win counts', () => {
    const teams: TeamId[] = [1, 2, 3]
    const overallWinCounts = new Map<TeamId, number>([
      [1, 12],
      [2, 11],
      [3, 10]
    ])

    const result = evaluateTotalWins(teams, overallWinCounts)

    expect(result.step).toBe('total-wins')
    expect(result.separated).toBe(true)
    expect(result.partition).toEqual([[1], [2], [3]])

    // Each value should have kind='record' with wins=count, losses=0
    expect(result.values[0].value).toEqual({
      kind: 'record',
      wins: 12,
      losses: 0,
      winPct: 12
    })
  })

  it('throws when overallWinCounts is undefined', () => {
    const teams: TeamId[] = [1, 2]

    expect(() => {
      evaluateTotalWins(teams, undefined)
    }).toThrow(/total-wins step requires overallWinCounts/)
  })

  it('groups teams with same win count together', () => {
    const teams: TeamId[] = [1, 2, 3]
    const overallWinCounts = new Map<TeamId, number>([
      [1, 12],
      [2, 12],
      [3, 10]
    ])

    const result = evaluateTotalWins(teams, overallWinCounts)

    expect(result.partition[0]).toContain(1)
    expect(result.partition[0]).toContain(2)
    expect(result.partition[1]).toContain(3)
  })
})

describe('evaluateStep dispatcher', () => {
  it('dispatches to winPctSafe and correct evaluator for head-to-head', () => {
    const teams: TeamId[] = [1, 2]
    const baseOrdering: BaseOrdering = [[1, 2]]
    const records = new Map<TeamId, ConferenceRecord>([
      [
        1,
        {
          teamId: 1,
          wins: 1,
          losses: 0,
          gamesPlayed: 1,
          winPct: 1.0,
          beat: new Set([2]),
          lostTo: new Set(),
          opponents: new Set([2])
        }
      ],
      [
        2,
        {
          teamId: 2,
          wins: 0,
          losses: 1,
          gamesPlayed: 1,
          winPct: 0.0,
          beat: new Set(),
          lostTo: new Set([1]),
          opponents: new Set([1])
        }
      ]
    ])

    const result = evaluateStep('head-to-head', teams, baseOrdering, records)

    expect(result.step).toBe('head-to-head')
    expect(result.separated).toBe(true)
  })

  it('dispatches to total-wins', () => {
    const teams: TeamId[] = [1, 2]
    const baseOrdering: BaseOrdering = [[1, 2]]
    const records = new Map<TeamId, ConferenceRecord>()
    const overallWinCounts = new Map<TeamId, number>([
      [1, 12],
      [2, 11]
    ])

    const result = evaluateStep('total-wins', teams, baseOrdering, records, overallWinCounts)

    expect(result.step).toBe('total-wins')
  })

  it('dispatches to next-highest-placed-common-opponent', () => {
    const teams: TeamId[] = [1, 2]
    const baseOrdering: BaseOrdering = [[100]]
    const records = new Map<TeamId, ConferenceRecord>([
      [
        1,
        {
          teamId: 1,
          wins: 1,
          losses: 0,
          gamesPlayed: 1,
          winPct: 1.0,
          beat: new Set([100]),
          lostTo: new Set(),
          opponents: new Set([100])
        }
      ],
      [
        2,
        {
          teamId: 2,
          wins: 1,
          losses: 0,
          gamesPlayed: 1,
          winPct: 1.0,
          beat: new Set([100]),
          lostTo: new Set(),
          opponents: new Set([100])
        }
      ]
    ])

    const result = evaluateStep(
      'next-highest-placed-common-opponent',
      teams,
      baseOrdering,
      records
    )

    expect(result.step).toBe('next-highest-placed-common-opponent')
  })
})
