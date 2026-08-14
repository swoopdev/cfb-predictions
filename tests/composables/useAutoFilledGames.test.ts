import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useAutoFilledGames } from '~/app/composables/useAutoFilledGames'
import { autoFilledExamples } from '../fixtures/picks.fixtures'

/**
 * Tests for useAutoFilledGames composable.
 * Covers: provenance tracking, Set conversion, persistence, idempotence.
 */

const SEASON = 2026
const STORAGE_KEY = `cfb_autofilled_${SEASON}`

describe('useAutoFilledGames', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('markAutoFilled', () => {
    it('should add game IDs to the auto-filled set', () => {
      const { autoFilled, markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123, 456])

      expect(autoFilled.value).toEqual([123, 456])
    })

    it('should handle adding a single game ID', () => {
      const { autoFilled, markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([789])

      expect(autoFilled.value).toEqual([789])
    })

    it('should persist changes to localStorage', async () => {
      const { markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123, 456])

      await nextTick()

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored).toEqual([123, 456])
    })

    it('should be idempotent: calling with same IDs multiple times is safe', () => {
      const { autoFilled, markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123, 456])
      const firstLength = autoFilled.value.length

      markAutoFilled([123, 456])
      const secondLength = autoFilled.value.length

      expect(secondLength).toBe(firstLength)
      expect(autoFilled.value).toEqual([123, 456])
    })

    it('should handle duplicate game IDs in input by deduplicating', () => {
      const { autoFilled, markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123, 456, 123, 789, 456])

      // After deduplication, should have unique IDs
      expect(new Set(autoFilled.value).size).toBe(3)
      expect(autoFilled.value).toContain(123)
      expect(autoFilled.value).toContain(456)
      expect(autoFilled.value).toContain(789)
    })

    it('should append new IDs without overwriting existing ones', () => {
      const { autoFilled, markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123, 456])
      markAutoFilled([789])

      expect(autoFilled.value).toContain(123)
      expect(autoFilled.value).toContain(456)
      expect(autoFilled.value).toContain(789)
    })
  })

  describe('isAutoFilled', () => {
    it('should return true for marked game IDs', () => {
      const { markAutoFilled, isAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123, 456])

      expect(isAutoFilled(123)).toBe(true)
      expect(isAutoFilled(456)).toBe(true)
    })

    it('should return false for unmarked game IDs', () => {
      const { markAutoFilled, isAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123])

      expect(isAutoFilled(456)).toBe(false)
      expect(isAutoFilled(789)).toBe(false)
    })

    it('should return false when no game IDs are marked', () => {
      const { isAutoFilled } = useAutoFilledGames(SEASON)

      expect(isAutoFilled(123)).toBe(false)
      expect(isAutoFilled(456)).toBe(false)
    })

    it('should correctly identify game IDs after multiple markAutoFilled calls', () => {
      const { markAutoFilled, isAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123])
      expect(isAutoFilled(123)).toBe(true)

      markAutoFilled([456, 789])
      expect(isAutoFilled(456)).toBe(true)
      expect(isAutoFilled(789)).toBe(true)
      expect(isAutoFilled(123)).toBe(true) // Should still be true
    })
  })

  describe('autoFilledSet', () => {
    it('should expose autoFilled array as a Computed<Set>', () => {
      const { autoFilledSet, markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123, 456])

      expect(autoFilledSet.value).toBeInstanceOf(Set)
      expect(autoFilledSet.value.size).toBe(2)
    })

    it('should contain exactly the IDs from the underlying array', () => {
      const { autoFilled, autoFilledSet, markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123, 456, 789])

      expect(autoFilledSet.value).toEqual(new Set(autoFilled.value))
    })

    it('should be reactive: reflects changes when autoFilled is updated', () => {
      const { autoFilledSet, markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123])
      const set1 = autoFilledSet.value
      expect(set1.size).toBe(1)

      markAutoFilled([456])
      const set2 = autoFilledSet.value
      expect(set2.size).toBe(2)
      expect(set2).not.toBe(set1) // Computed should return new Set instances
    })

    it('should allow O(1) lookups via Set.has()', () => {
      const { autoFilledSet, markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123, 456, 789])

      expect(autoFilledSet.value.has(123)).toBe(true)
      expect(autoFilledSet.value.has(456)).toBe(true)
      expect(autoFilledSet.value.has(789)).toBe(true)
      expect(autoFilledSet.value.has(999)).toBe(false)
    })

    it('should support iteration over Set', () => {
      const { autoFilledSet, markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([123, 456, 789])

      const ids = Array.from(autoFilledSet.value)
      expect(ids).toHaveLength(3)
      expect(ids).toContain(123)
      expect(ids).toContain(456)
      expect(ids).toContain(789)
    })
  })

  describe('Persistence', () => {
    it('should persist auto-filled IDs across composable instances', async () => {
      const { markAutoFilled } = useAutoFilledGames(SEASON)
      markAutoFilled([123, 456])

      await nextTick()

      const { autoFilled } = useAutoFilledGames(SEASON)
      expect(autoFilled.value).toEqual([123, 456])
    })

    it('should restore from localStorage on initialization', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([789, 101]))

      const { autoFilled } = useAutoFilledGames(SEASON)
      expect(autoFilled.value).toEqual([789, 101])
    })

    it('should initialize empty when no prior data exists', () => {
      const { autoFilled } = useAutoFilledGames(SEASON)
      expect(autoFilled.value).toEqual([])
    })
  })

  describe('Corruption Recovery', () => {
    it('should recover from corrupted JSON by returning empty array', () => {
      localStorage.setItem(STORAGE_KEY, 'not json')

      const { autoFilled } = useAutoFilledGames(SEASON)
      expect(autoFilled.value).toEqual([])
    })

    it('should recover from JSON object instead of array', () => {
      localStorage.setItem(STORAGE_KEY, '{"123": true}')

      const { autoFilled } = useAutoFilledGames(SEASON)
      expect(autoFilled.value).toEqual([])
    })

    it('should recover from JSON null', () => {
      localStorage.setItem(STORAGE_KEY, 'null')

      const { autoFilled } = useAutoFilledGames(SEASON)
      expect(autoFilled.value).toEqual([])
    })

    it('should allow new marks after corruption recovery', () => {
      localStorage.setItem(STORAGE_KEY, 'not json')

      const { markAutoFilled, isAutoFilled } = useAutoFilledGames(SEASON)
      markAutoFilled([123])

      expect(isAutoFilled(123)).toBe(true)
    })
  })

  describe('Season Namespacing', () => {
    it('should use season-namespaced storage key', () => {
      const season = 2027
      const { markAutoFilled } = useAutoFilledGames(season)
      markAutoFilled([123])

      expect(localStorage.getItem(`cfb_autofilled_${season}`)).toBeDefined()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('should support multiple seasons independently', () => {
      const { markAutoFilled: mark2026, autoFilled: af2026 } = useAutoFilledGames(2026)
      const { markAutoFilled: mark2027, autoFilled: af2027 } = useAutoFilledGames(2027)

      mark2026([123, 456])
      mark2027([789])

      expect(af2026.value).toEqual([123, 456])
      expect(af2027.value).toEqual([789])
    })
  })

  describe('Integration Scenarios', () => {
    it('should support bulk week fill scenario', () => {
      const { autoFilled, markAutoFilled, isAutoFilled } = useAutoFilledGames(SEASON)
      const weekGames = autoFilledExamples.bulkWeek

      markAutoFilled(weekGames)

      expect(autoFilled.value).toHaveLength(10)
      weekGames.forEach((gameId) => {
        expect(isAutoFilled(gameId)).toBe(true)
      })
    })

    it('should support bulk season fill scenario', () => {
      const { autoFilled, markAutoFilled } = useAutoFilledGames(SEASON)
      const seasonGames = autoFilledExamples.bulkSeason

      markAutoFilled(seasonGames)

      expect(autoFilled.value).toHaveLength(50)
    })

    it('should correctly handle mixed user and auto-filled picks', () => {
      const { markAutoFilled, isAutoFilled } = useAutoFilledGames(SEASON)

      // Simulate: bulk fill 5 games
      markAutoFilled([101, 102, 103, 104, 105])

      // User manually picked 3 games (not tracked by this composable)
      // Query: which games were auto-filled?
      expect(isAutoFilled(101)).toBe(true)
      expect(isAutoFilled(102)).toBe(true)
      expect(isAutoFilled(103)).toBe(true)
      expect(isAutoFilled(201)).toBe(false) // User pick, not auto-filled
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty input array', () => {
      const { autoFilled, markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([])

      expect(autoFilled.value).toEqual([])
    })

    it('should handle large game IDs', () => {
      const { isAutoFilled, markAutoFilled } = useAutoFilledGames(SEASON)
      const largeId = Number.MAX_SAFE_INTEGER

      markAutoFilled([largeId])

      expect(isAutoFilled(largeId)).toBe(true)
    })

    it('should handle zero and negative game IDs', () => {
      const { isAutoFilled, markAutoFilled } = useAutoFilledGames(SEASON)

      markAutoFilled([0, -1, 1])

      expect(isAutoFilled(0)).toBe(true)
      expect(isAutoFilled(-1)).toBe(true)
      expect(isAutoFilled(1)).toBe(true)
    })
  })
})
