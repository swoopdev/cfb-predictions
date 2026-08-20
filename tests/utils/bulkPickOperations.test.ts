import { describe, it, expect } from 'vitest'
import type { Game } from '#shared/types/schedule'
import {
  fillWeekRemaining,
  fillSeasonRemaining,
  clearWeek,
  clearSeason
} from '~/utils/bulkPickOperations'

/**
 * Tests for bulkPickOperations utility functions.
 * Verifies: pure functions (no mutations), batch updates, preservation of existing picks,
 * correct auto-filled tracking, and week/season scoping.
 */

// fillWeekRemaining/fillSeasonRemaining pick a random winner now, so a
// deterministic `random` hook (this task) is passed to every assertion that
// checks an EXACT winning team id -- `0` always resolves `random() < 0.5` to
// the home team, keeping those assertions meaningful instead of flaky.
const ALWAYS_HOME = () => 0
const ALWAYS_AWAY = () => 1

// Mock game data for testing
const mockGames: Game[] = [
  // Week 1 games
  {
    id: 101,
    week: 1,
    seasonType: 'regular',
    homeId: 1,
    homeTeam: 'Team A',
    awayId: 2,
    awayTeam: 'Team B',
    conferenceGame: true,
    neutralSite: false
  },
  {
    id: 102,
    week: 1,
    seasonType: 'regular',
    homeId: 3,
    homeTeam: 'Team C',
    awayId: 4,
    awayTeam: 'Team D',
    conferenceGame: true,
    neutralSite: false
  },
  {
    id: 103,
    week: 1,
    seasonType: 'regular',
    homeId: 5,
    homeTeam: 'Team E',
    awayId: 6,
    awayTeam: 'Team F',
    conferenceGame: true,
    neutralSite: false
  },
  // Week 2 games
  {
    id: 201,
    week: 2,
    seasonType: 'regular',
    homeId: 2,
    homeTeam: 'Team B',
    awayId: 3,
    awayTeam: 'Team C',
    conferenceGame: true,
    neutralSite: false
  },
  {
    id: 202,
    week: 2,
    seasonType: 'regular',
    homeId: 4,
    homeTeam: 'Team D',
    awayId: 5,
    awayTeam: 'Team E',
    conferenceGame: true,
    neutralSite: false
  }
]

describe('bulkPickOperations', () => {
  describe('fillWeekRemaining', () => {
    it('should fill unpicked games in a week with home team', () => {
      const currentPicks = { 101: 2 } // game 101 already picked for team 2
      const result = fillWeekRemaining(mockGames, 1, currentPicks, ALWAYS_HOME)

      expect(result.newPicks[101]).toBe(2) // Existing pick unchanged
      expect(result.newPicks[102]).toBe(3) // game 102 filled with home team 3
      expect(result.newPicks[103]).toBe(5) // game 103 filled with home team 5
    })

    it('should return new object without mutating input', () => {
      const currentPicks = { 101: 2 }
      const originalPicks = { ...currentPicks }

      fillWeekRemaining(mockGames, 1, currentPicks)

      expect(currentPicks).toEqual(originalPicks)
    })

    it('should track auto-filled game IDs', () => {
      const currentPicks = { 101: 2 }
      const result = fillWeekRemaining(mockGames, 1, currentPicks, ALWAYS_HOME)

      expect(result.autoFilledIds).toContain(102)
      expect(result.autoFilledIds).toContain(103)
      expect(result.autoFilledIds).not.toContain(101)
    })

    it('should return empty auto-filled list if all games already picked', () => {
      const currentPicks = { 101: 2, 102: 3, 103: 5 }
      const result = fillWeekRemaining(mockGames, 1, currentPicks, ALWAYS_HOME)

      expect(result.autoFilledIds).toEqual([])
      expect(result.newPicks).toEqual(currentPicks)
    })

    it('should handle empty picks', () => {
      const currentPicks = {}
      const result = fillWeekRemaining(mockGames, 1, currentPicks, ALWAYS_HOME)

      expect(result.newPicks[101]).toBe(1)
      expect(result.newPicks[102]).toBe(3)
      expect(result.newPicks[103]).toBe(5)
      expect(result.autoFilledIds).toHaveLength(3)
    })

    it('should only fill games in the specified week', () => {
      const currentPicks = {}
      const result = fillWeekRemaining(mockGames, 2, currentPicks, ALWAYS_HOME)

      expect(result.newPicks[101]).toBeUndefined()
      expect(result.newPicks[102]).toBeUndefined()
      expect(result.newPicks[201]).toBe(2)
      expect(result.newPicks[202]).toBe(4)
      expect(result.autoFilledIds).toHaveLength(2)
    })

    it('should preserve existing picks when filling', () => {
      const currentPicks = { 101: 99, 103: 99 } // 101 and 103 already have picks
      const result = fillWeekRemaining(mockGames, 1, currentPicks, ALWAYS_HOME)

      expect(result.newPicks[101]).toBe(99) // Preserved
      expect(result.newPicks[102]).toBe(3) // Filled
      expect(result.newPicks[103]).toBe(99) // Preserved
    })
  })

  describe('fillSeasonRemaining', () => {
    it('should fill all unpicked games in season with home team', () => {
      const currentPicks = { 101: 2 }
      const result = fillSeasonRemaining(mockGames, currentPicks, ALWAYS_HOME)

      expect(result.newPicks[101]).toBe(2) // Existing pick unchanged
      expect(result.newPicks[102]).toBe(3)
      expect(result.newPicks[103]).toBe(5)
      expect(result.newPicks[201]).toBe(2)
      expect(result.newPicks[202]).toBe(4)
    })

    it('should return new object without mutating input', () => {
      const currentPicks = { 101: 2 }
      const originalPicks = { ...currentPicks }

      fillSeasonRemaining(mockGames, currentPicks)

      expect(currentPicks).toEqual(originalPicks)
    })

    it('should track auto-filled game IDs for entire season', () => {
      const currentPicks = {}
      const result = fillSeasonRemaining(mockGames, currentPicks)

      expect(result.autoFilledIds).toContain(101)
      expect(result.autoFilledIds).toContain(102)
      expect(result.autoFilledIds).toContain(103)
      expect(result.autoFilledIds).toContain(201)
      expect(result.autoFilledIds).toContain(202)
      expect(result.autoFilledIds).toHaveLength(5)
    })

    it('should handle empty picks', () => {
      const currentPicks = {}
      const result = fillSeasonRemaining(mockGames, currentPicks, ALWAYS_HOME)

      expect(Object.keys(result.newPicks).length).toBe(mockGames.length)
      expect(result.autoFilledIds.length).toBe(mockGames.length)
    })

    it('should preserve all existing picks', () => {
      const currentPicks = {
        101: 99,
        102: 88,
        201: 77
      }
      const result = fillSeasonRemaining(mockGames, currentPicks, ALWAYS_HOME)

      expect(result.newPicks[101]).toBe(99)
      expect(result.newPicks[102]).toBe(88)
      expect(result.newPicks[201]).toBe(77)
      expect(result.newPicks[103]).toBe(5)
      expect(result.newPicks[202]).toBe(4)
    })
  })

  describe('clearWeek', () => {
    it('should clear all picks in a week', () => {
      const currentPicks = { 101: 2, 102: 3, 103: 5, 201: 2, 202: 4 }
      const result = clearWeek(mockGames, 1, currentPicks)

      expect(result[101]).toBeUndefined()
      expect(result[102]).toBeUndefined()
      expect(result[103]).toBeUndefined()
      expect(result[201]).toBe(2)
      expect(result[202]).toBe(4)
    })

    it('should return new object without mutating input', () => {
      const currentPicks = { 101: 2, 102: 3, 201: 2 }
      const originalPicks = { ...currentPicks }

      clearWeek(mockGames, 1, currentPicks)

      expect(currentPicks).toEqual(originalPicks)
    })

    it('should handle clearing empty week', () => {
      const currentPicks = { 201: 2, 202: 4 }
      const result = clearWeek(mockGames, 1, currentPicks)

      expect(result).toEqual(currentPicks)
    })

    it('should handle clearing week with all picks', () => {
      const currentPicks = { 101: 2, 102: 3, 103: 5 }
      const result = clearWeek(mockGames, 1, currentPicks)

      expect(Object.keys(result).length).toBe(0)
    })

    it('should handle partial picks in week', () => {
      const currentPicks = { 101: 2, 103: 5 }
      const result = clearWeek(mockGames, 1, currentPicks)

      expect(result[101]).toBeUndefined()
      expect(result[103]).toBeUndefined()
    })
  })

  describe('clearSeason', () => {
    it('should return empty object', () => {
      const result = clearSeason()

      expect(result).toEqual({})
    })

    it('should not take input (pure function)', () => {
      const result = clearSeason()

      expect(result).toEqual({})
    })
  })

  describe('Pure Function Contract', () => {
    it('fillWeekRemaining should not have side effects', () => {
      const currentPicks = { 101: 2 }
      const originalPicks = JSON.parse(JSON.stringify(currentPicks))

      // Same `random` hook passed to both calls -- "same input -> same
      // output" only holds for a deterministic RNG, not the impure default
      // `Math.random` (this task's randomized winner selection).
      const result1 = fillWeekRemaining(mockGames, 1, currentPicks, ALWAYS_HOME)
      const result2 = fillWeekRemaining(mockGames, 1, currentPicks, ALWAYS_HOME)

      expect(currentPicks).toEqual(originalPicks)
      expect(result1).toEqual(result2) // Same input → same output
    })

    it('fillSeasonRemaining should not have side effects', () => {
      const currentPicks = { 101: 2 }
      const originalPicks = JSON.parse(JSON.stringify(currentPicks))

      const result1 = fillSeasonRemaining(mockGames, currentPicks, ALWAYS_HOME)
      const result2 = fillSeasonRemaining(mockGames, currentPicks, ALWAYS_HOME)

      expect(currentPicks).toEqual(originalPicks)
      expect(result1).toEqual(result2)
    })

    it('clearWeek should not have side effects', () => {
      const currentPicks = { 101: 2, 102: 3, 201: 2 }
      const originalPicks = JSON.parse(JSON.stringify(currentPicks))

      const result1 = clearWeek(mockGames, 1, currentPicks)
      const result2 = clearWeek(mockGames, 1, currentPicks)

      expect(currentPicks).toEqual(originalPicks)
      expect(result1).toEqual(result2)
    })
  })

  describe('Batch Update Pattern', () => {
    it('fillWeekRemaining returns single object for atomic update', () => {
      const currentPicks = {}
      const result = fillWeekRemaining(mockGames, 1, currentPicks, ALWAYS_HOME)

      // Caller should do: picks.value = result.newPicks
      // This is a single assignment, not cascading writes
      expect(typeof result.newPicks).toBe('object')
      expect(Array.isArray(result.autoFilledIds)).toBe(true)
    })

    it('fillSeasonRemaining returns single object for atomic update', () => {
      const currentPicks = {}
      const result = fillSeasonRemaining(mockGames, currentPicks, ALWAYS_HOME)

      expect(typeof result.newPicks).toBe('object')
      expect(Array.isArray(result.autoFilledIds)).toBe(true)
    })
  })

  describe('random winner selection', () => {
    it('fillWeekRemaining picks the away team when random() >= 0.5', () => {
      const result = fillWeekRemaining(mockGames, 1, {}, ALWAYS_AWAY)

      expect(result.newPicks[101]).toBe(2)
      expect(result.newPicks[102]).toBe(4)
      expect(result.newPicks[103]).toBe(6)
    })

    it('fillWeekRemaining picks the home team when random() < 0.5', () => {
      const result = fillWeekRemaining(mockGames, 1, {}, ALWAYS_HOME)

      expect(result.newPicks[101]).toBe(1)
      expect(result.newPicks[102]).toBe(3)
      expect(result.newPicks[103]).toBe(5)
    })

    it('fillSeasonRemaining picks the away team when random() >= 0.5', () => {
      const result = fillSeasonRemaining(mockGames, {}, ALWAYS_AWAY)

      expect(result.newPicks[101]).toBe(2)
      expect(result.newPicks[201]).toBe(3)
      expect(result.newPicks[202]).toBe(5)
    })

    it('defaults to Math.random when no random hook is supplied', () => {
      const result = fillWeekRemaining(mockGames, 1, {})

      for (const game of mockGames.filter(g => g.week === 1)) {
        expect([game.homeId, game.awayId]).toContain(result.newPicks[game.id])
      }
    })
  })
})
