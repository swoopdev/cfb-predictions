import { describe, it, expect } from 'vitest'
import { computeTeamStatLeaders } from '~/utils/statLeaders'
import type { PlayerStatEntry } from '#shared/types/playerStats'

function makeStat(overrides: Partial<PlayerStatEntry> & Pick<PlayerStatEntry, 'playerId' | 'player' | 'teamId' | 'category' | 'statType' | 'stat'>): PlayerStatEntry {
  return {
    position: 'QB',
    jersey: null,
    ...overrides
  }
}

describe('computeTeamStatLeaders', () => {
  it('ranks passing/rushing/receiving leaders by YDS descending, scoped to the team', () => {
    const stats: PlayerStatEntry[] = [
      makeStat({ playerId: '1', player: 'QB1', teamId: 100, category: 'passing', statType: 'YDS', stat: 300 }),
      makeStat({ playerId: '2', player: 'QB2', teamId: 100, category: 'passing', statType: 'YDS', stat: 50 }),
      makeStat({ playerId: '3', player: 'OtherTeamQB', teamId: 200, category: 'passing', statType: 'YDS', stat: 999 }),
      makeStat({ playerId: '4', player: 'RB1', teamId: 100, category: 'rushing', statType: 'YDS', stat: 120 }),
      makeStat({ playerId: '5', player: 'WR1', teamId: 100, category: 'receiving', statType: 'YDS', stat: 80 })
    ]

    const leaders = computeTeamStatLeaders(stats, 100)

    expect(leaders.passing.map(l => l.player)).toEqual(['QB1', 'QB2'])
    expect(leaders.rushing.map(l => l.player)).toEqual(['RB1'])
    expect(leaders.receiving.map(l => l.player)).toEqual(['WR1'])
  })

  it('caps at topN', () => {
    const stats: PlayerStatEntry[] = [1, 2, 3, 4, 5].map(n => makeStat({
      playerId: String(n), player: `RB${n}`, teamId: 1, category: 'rushing', statType: 'YDS', stat: n * 10
    }))

    const leaders = computeTeamStatLeaders(stats, 1, 2)

    expect(leaders.rushing).toHaveLength(2)
    expect(leaders.rushing.map(l => l.player)).toEqual(['RB5', 'RB4'])
  })

  it('coerces a string stat value for sorting rather than dropping the row', () => {
    const stats: PlayerStatEntry[] = [
      makeStat({ playerId: '1', player: 'A', teamId: 1, category: 'rushing', statType: 'YDS', stat: '150' }),
      makeStat({ playerId: '2', player: 'B', teamId: 1, category: 'rushing', statType: 'YDS', stat: 90 })
    ]

    const leaders = computeTeamStatLeaders(stats, 1)

    expect(leaders.rushing.map(l => l.player)).toEqual(['A', 'B'])
    expect(leaders.rushing[0]!.value).toBe(150)
  })

  it('ignores unrelated category/statType combinations', () => {
    const stats: PlayerStatEntry[] = [
      makeStat({ playerId: '1', player: 'A', teamId: 1, category: 'passing', statType: 'TD', stat: 5 }),
      makeStat({ playerId: '2', player: 'B', teamId: 1, category: 'defensive', statType: 'TOT', stat: 12 })
    ]

    const leaders = computeTeamStatLeaders(stats, 1)

    expect(leaders.passing).toEqual([])
    expect(leaders.rushing).toEqual([])
    expect(leaders.receiving).toEqual([])
  })

  it('returns empty arrays for a team with no stats yet', () => {
    expect(computeTeamStatLeaders([], 999)).toEqual({ passing: [], rushing: [], receiving: [] })
  })
})
