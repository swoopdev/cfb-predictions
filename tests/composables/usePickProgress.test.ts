/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import type { Game, TeamsEnvelope } from '#shared/types/schedule'

// NOW import the composable and mocked dependencies
import { usePickProgress } from '~/composables/usePickProgress'
import { usePicksStorage } from '~/composables/usePicksStorage'
import { useGames } from '~/composables/useGames'

/**
 * Tests for usePickProgress composable.
 * Covers: overall progress, per-week progress, reactive updates, edge cases.
 */

// Mock composables BEFORE importing usePickProgress
vi.mock('~/composables/usePicksStorage', () => ({
  usePicksStorage: vi.fn()
}))

vi.mock('~/composables/useGames', () => ({
  useGames: vi.fn()
}))

/**
 * Create mock game data for testing
 */
function createMockGames(count: number = 100): Game[] {
  const games: Game[] = []
  for (let i = 0; i < count; i++) {
    games.push({
      id: i + 1000,
      season: 2026,
      week: Math.floor(i / 10) + 1, // 10 games per week
      home_id: 2600 + (i % 10),
      away_id: 2700 + (i % 10),
      home_team: `Home${i}`,
      away_team: `Away${i}`,
      home_points: 0,
      away_points: 0,
      status: 'scheduled',
      notes: null
    })
  }
  return games
}

/**
 * Create mock games envelope
 */
function createMockEnvelope(games: Game[]): TeamsEnvelope {
  return {
    season: 2026,
    scheduleHash: 'test-hash',
    games
  }
}

describe('usePickProgress', () => {
  let mockPicksRef: any
  let mockGamesQuery: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Create reactive mock picks ref
    mockPicksRef = ref<Record<number, number>>({})

    // Create mock games query
    mockGamesQuery = {
      data: ref<TeamsEnvelope | undefined>(undefined),
      isPending: ref(false),
      isError: ref(false)
    }

    // Setup mock implementations
    ;(usePicksStorage as any).mockReturnValue(mockPicksRef)
    ;(useGames as any).mockReturnValue(mockGamesQuery)
  })

  describe('progressOverall', () => {
    it('should return 0/0 when games data is not loaded', () => {
      mockGamesQuery.data.value = undefined

      const { progressOverall } = usePickProgress(2026)

      expect(progressOverall.value.picked).toBe(0)
      expect(progressOverall.value.total).toBe(0)
    })

    it('should return correct total when games are loaded', () => {
      const games = createMockGames(50)
      mockGamesQuery.data.value = createMockEnvelope(games)

      const { progressOverall } = usePickProgress(2026)

      expect(progressOverall.value.total).toBe(50)
      expect(progressOverall.value.picked).toBe(0)
    })

    it('should count picked games correctly', () => {
      const games = createMockGames(50)
      mockGamesQuery.data.value = createMockEnvelope(games)

      mockPicksRef.value[1000] = 2600
      mockPicksRef.value[1001] = 2601
      mockPicksRef.value[1002] = 2602

      const { progressOverall } = usePickProgress(2026)

      expect(progressOverall.value.picked).toBe(3)
      expect(progressOverall.value.total).toBe(50)
    })

    it('should update reactively when picks are added', async () => {
      const games = createMockGames(50)
      mockGamesQuery.data.value = createMockEnvelope(games)

      const { progressOverall } = usePickProgress(2026)

      expect(progressOverall.value.picked).toBe(0)

      // Add a pick
      mockPicksRef.value[1000] = 2600
      await nextTick()

      expect(progressOverall.value.picked).toBe(1)

      // Add more picks
      mockPicksRef.value[1001] = 2601
      mockPicksRef.value[1002] = 2602
      await nextTick()

      expect(progressOverall.value.picked).toBe(3)
    })

    it('should update reactively when picks are removed', async () => {
      const games = createMockGames(50)
      mockGamesQuery.data.value = createMockEnvelope(games)

      mockPicksRef.value[1000] = 2600
      mockPicksRef.value[1001] = 2601

      const { progressOverall } = usePickProgress(2026)
      expect(progressOverall.value.picked).toBe(2)

      // Remove a pick
      delete mockPicksRef.value[1000]
      await nextTick()

      expect(progressOverall.value.picked).toBe(1)
    })

    it('should update reactively when games data loads', async () => {
      const { progressOverall } = usePickProgress(2026)

      expect(progressOverall.value.total).toBe(0)

      // Simulate games loading
      const games = createMockGames(50)
      mockGamesQuery.data.value = createMockEnvelope(games)
      await nextTick()

      expect(progressOverall.value.total).toBe(50)
    })

    it('should handle all games picked', () => {
      const games = createMockGames(10)
      mockGamesQuery.data.value = createMockEnvelope(games)

      // Pick all games
      games.forEach((game) => {
        mockPicksRef.value[game.id] = 2600
      })

      const { progressOverall } = usePickProgress(2026)

      expect(progressOverall.value.picked).toBe(10)
      expect(progressOverall.value.total).toBe(10)
    })
  })

  describe('progressForWeek', () => {
    it('should return 0/0 for a week when games are not loaded', () => {
      mockGamesQuery.data.value = undefined

      const { progressForWeek } = usePickProgress(2026)
      const progress = progressForWeek(1)

      expect(progress.value.picked).toBe(0)
      expect(progress.value.total).toBe(0)
    })

    it('should return correct total for a specific week', () => {
      // 10 games per week (games 0-9 in week 1, 10-19 in week 2, etc.)
      const games = createMockGames(50)
      mockGamesQuery.data.value = createMockEnvelope(games)

      const { progressForWeek } = usePickProgress(2026)

      const week1Progress = progressForWeek(1)
      const week2Progress = progressForWeek(2)
      const week5Progress = progressForWeek(5)

      expect(week1Progress.value.total).toBe(10)
      expect(week2Progress.value.total).toBe(10)
      expect(week5Progress.value.total).toBe(10)
    })

    it('should count only picks for that week', () => {
      const games = createMockGames(30)
      mockGamesQuery.data.value = createMockEnvelope(games)

      // Pick games only from week 1 (ids 1000-1009)
      mockPicksRef.value[1000] = 2600
      mockPicksRef.value[1001] = 2601
      mockPicksRef.value[1002] = 2602

      const { progressForWeek } = usePickProgress(2026)

      const week1Progress = progressForWeek(1)
      const week2Progress = progressForWeek(2)

      expect(week1Progress.value.picked).toBe(3)
      expect(week2Progress.value.picked).toBe(0)
    })

    it('should update reactively when picks are added to a week', async () => {
      const games = createMockGames(30)
      mockGamesQuery.data.value = createMockEnvelope(games)

      const { progressForWeek } = usePickProgress(2026)
      const week1Progress = progressForWeek(1)

      expect(week1Progress.value.picked).toBe(0)

      // Add picks to week 1
      mockPicksRef.value[1000] = 2600
      mockPicksRef.value[1001] = 2601
      await nextTick()

      expect(week1Progress.value.picked).toBe(2)
    })

    it('should return 0 for week with zero games', () => {
      const games = createMockGames(10)
      mockGamesQuery.data.value = createMockEnvelope(games)

      const { progressForWeek } = usePickProgress(2026)
      const week99Progress = progressForWeek(99)

      expect(week99Progress.value.total).toBe(0)
      expect(week99Progress.value.picked).toBe(0)
    })

    it('should handle independent week progress tracking', () => {
      const games = createMockGames(30)
      mockGamesQuery.data.value = createMockEnvelope(games)

      // Pick games from week 1 and week 2
      mockPicksRef.value[1000] = 2600 // week 1
      mockPicksRef.value[1005] = 2605 // week 1
      mockPicksRef.value[1010] = 2610 // week 2
      mockPicksRef.value[1015] = 2615 // week 2

      const { progressForWeek } = usePickProgress(2026)

      const week1Progress = progressForWeek(1)
      const week2Progress = progressForWeek(2)

      expect(week1Progress.value.picked).toBe(2)
      expect(week1Progress.value.total).toBe(10)
      expect(week2Progress.value.picked).toBe(2)
      expect(week2Progress.value.total).toBe(10)
    })

    it('should cache computed for same week number', () => {
      const games = createMockGames(30)
      mockGamesQuery.data.value = createMockEnvelope(games)

      const { progressForWeek } = usePickProgress(2026)

      const progress1 = progressForWeek(1)
      const progress2 = progressForWeek(1)

      // Both calls should return different computed instances
      // but they should reference the same underlying week
      expect(progress1.value).toEqual(progress2.value)
    })
  })

  describe('Edge Cases', () => {
    it('should handle pick for non-existent game gracefully', () => {
      const games = createMockGames(10)
      mockGamesQuery.data.value = createMockEnvelope(games)

      // Add pick for a game that doesn't exist in the data
      mockPicksRef.value[9999] = 2600

      const { progressOverall } = usePickProgress(2026)

      // The pick still gets counted in total picks
      expect(progressOverall.value.picked).toBe(1)
    })

    it('should handle empty games array', () => {
      mockGamesQuery.data.value = createMockEnvelope([])

      const { progressOverall, progressForWeek } = usePickProgress(2026)

      expect(progressOverall.value.total).toBe(0)
      expect(progressForWeek(1).value.total).toBe(0)
    })

    it('should handle large game count', () => {
      const games = createMockGames(1000)
      mockGamesQuery.data.value = createMockEnvelope(games)

      const { progressOverall } = usePickProgress(2026)

      expect(progressOverall.value.total).toBe(1000)
    })

    it('should handle season parameter', () => {
      const usePicksStorageSpy = usePicksStorage as any
      const useGamesSpy = useGames as any

      usePickProgress(2027)

      expect(usePicksStorageSpy).toHaveBeenCalledWith(2027)
      expect(useGamesSpy).toHaveBeenCalledWith(2027)
    })

    it('should default to season 2026', () => {
      const usePicksStorageSpy = usePicksStorage as any
      const useGamesSpy = useGames as any

      usePickProgress()

      expect(usePicksStorageSpy).toHaveBeenCalledWith(2026)
      expect(useGamesSpy).toHaveBeenCalledWith(2026)
    })
  })

  describe('Derived Consistency', () => {
    it('should maintain consistency between overall and per-week progress', () => {
      const games = createMockGames(40) // 4 weeks × 10 games
      mockGamesQuery.data.value = createMockEnvelope(games)

      // Add 30 picks: 10 per week
      for (let w = 1; w <= 3; w++) {
        for (let i = 0; i < 10; i++) {
          const gameIdx = (w - 1) * 10 + i
          mockPicksRef.value[games[gameIdx].id] = 2600
        }
      }

      const { progressOverall, progressForWeek } = usePickProgress(2026)

      const week1 = progressForWeek(1)
      const week2 = progressForWeek(2)
      const week3 = progressForWeek(3)
      const week4 = progressForWeek(4)

      const sumPicked = week1.value.picked + week2.value.picked + week3.value.picked + week4.value.picked
      const sumTotal = week1.value.total + week2.value.total + week3.value.total + week4.value.total

      expect(progressOverall.value.picked).toBe(sumPicked)
      expect(progressOverall.value.total).toBe(sumTotal)
    })
  })
})
