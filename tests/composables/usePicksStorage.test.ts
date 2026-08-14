import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { usePicksStorage } from '~/app/composables/usePicksStorage'
import {
  emptyPicks,
  partialPicks,
  corruptedJsonExamples
} from '../fixtures/picks.fixtures'

/**
 * Tests for usePicksStorage composable.
 * Covers: persistence, corruption recovery, edge cases, cross-tab sync awareness.
 */

const SEASON = 2026
const STORAGE_KEY = `cfb_picks_${SEASON}`
const CORRUPT_KEY = `${STORAGE_KEY}_corrupt`

describe('usePicksStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up after each test
    localStorage.clear()
  })

  describe('Persistence', () => {
    it('should initialize with empty picks when storage is empty', () => {
      const picks = usePicksStorage(SEASON)
      expect(picks.value).toEqual(emptyPicks)
    })

    it('should persist a pick to localStorage', async () => {
      const picks = usePicksStorage(SEASON)
      picks.value[123] = 456

      await nextTick()

      const stored = localStorage.getItem(STORAGE_KEY)
      expect(stored).toBeDefined()
      expect(JSON.parse(stored!)).toEqual({ 123: 456 })
    })

    it('should restore picks from localStorage on composable creation', async () => {
      // First instance: add a pick
      const picks1 = usePicksStorage(SEASON)
      picks1.value[123] = 456
      picks1.value[789] = 101

      await nextTick()

      // Simulate page reload: create new instance
      const picks2 = usePicksStorage(SEASON)
      expect(picks2.value).toEqual({ 123: 456, 789: 101 })
    })

    it('should handle multiple pick mutations', async () => {
      const picks = usePicksStorage(SEASON)

      picks.value[123] = 456
      picks.value[789] = 101
      picks.value[202] = 303

      await nextTick()

      expect(picks.value).toEqual(partialPicks)
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(partialPicks)
    })

    it('should support clearing a pick via delete', () => {
      const picks = usePicksStorage(SEASON)
      picks.value[123] = 456
      expect(picks.value).toHaveProperty('123')

      delete picks.value[123]
      expect(picks.value).not.toHaveProperty('123')
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).not.toHaveProperty('123')
    })
  })

  describe('Toggle/Clear Pattern', () => {
    it('should support toggle: picking and clearing same game', () => {
      const picks = usePicksStorage(SEASON)

      // Pick game 123 for team 456
      picks.value[123] = 456
      expect(picks.value[123]).toBe(456)

      // Toggle: clear the pick
      delete picks.value[123]
      expect(picks.value[123]).toBeUndefined()

      // Toggle again: pick it again
      picks.value[123] = 789
      expect(picks.value[123]).toBe(789)
    })
  })

  describe('Corruption Recovery (D-07, D-08)', () => {
    it('should recover from invalid JSON by returning empty picks', () => {
      localStorage.setItem(STORAGE_KEY, corruptedJsonExamples.invalidJson)

      const picks = usePicksStorage(SEASON)
      expect(picks.value).toEqual(emptyPicks)
    })

    it('should preserve corrupted data under _corrupt key', () => {
      const corruptedValue = corruptedJsonExamples.invalidJson
      localStorage.setItem(STORAGE_KEY, corruptedValue)

      usePicksStorage(SEASON)
      expect(localStorage.getItem(CORRUPT_KEY)).toBe(corruptedValue)
    })

    it('should recover from JSON null by returning empty picks', () => {
      localStorage.setItem(STORAGE_KEY, corruptedJsonExamples.jsonNull)

      const picks = usePicksStorage(SEASON)
      expect(picks.value).toEqual(emptyPicks)
    })

    it('should recover from JSON array by returning empty picks', () => {
      localStorage.setItem(STORAGE_KEY, corruptedJsonExamples.jsonArray)

      const picks = usePicksStorage(SEASON)
      expect(picks.value).toEqual(emptyPicks)
    })

    it('should recover from truncated JSON by returning empty picks', () => {
      localStorage.setItem(STORAGE_KEY, corruptedJsonExamples.truncatedJson)

      const picks = usePicksStorage(SEASON)
      expect(picks.value).toEqual(emptyPicks)
    })

    it('should allow new picks after corruption recovery', async () => {
      localStorage.setItem(STORAGE_KEY, corruptedJsonExamples.invalidJson)

      const picks = usePicksStorage(SEASON)
      picks.value[123] = 456

      await nextTick()

      expect(picks.value[123]).toBe(456)
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ 123: 456 })
    })

    it('should not overwrite existing corrupted backup if already stored', () => {
      const firstCorruptValue = 'first corruption'
      localStorage.setItem(STORAGE_KEY, firstCorruptValue)

      // First load: should store corruption
      usePicksStorage(SEASON)
      expect(localStorage.getItem(CORRUPT_KEY)).toBe(firstCorruptValue)

      // Second load: should not overwrite existing backup
      localStorage.setItem(STORAGE_KEY, 'second corruption')
      usePicksStorage(SEASON)
      expect(localStorage.getItem(CORRUPT_KEY)).toBe(firstCorruptValue)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty string in storage', () => {
      localStorage.setItem(STORAGE_KEY, corruptedJsonExamples.emptyString)

      const picks = usePicksStorage(SEASON)
      expect(picks.value).toEqual(emptyPicks)
    })

    it('should handle game ID at Number.MAX_SAFE_INTEGER', async () => {
      const picks = usePicksStorage(SEASON)
      const maxId = Number.MAX_SAFE_INTEGER

      picks.value[maxId] = 456
      expect(picks.value[maxId]).toBe(456)

      await nextTick()

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored[String(maxId)]).toBe(456)
    })

    it('should handle zero as a game ID (edge case)', () => {
      const picks = usePicksStorage(SEASON)
      picks.value[0] = 456

      // JSON keys are always strings, so 0 becomes "0"
      expect(picks.value[0]).toBe(456)
    })

    it('should handle negative game IDs (edge case)', () => {
      const picks = usePicksStorage(SEASON)
      picks.value[-1] = 456

      expect(picks.value[-1]).toBe(456)
    })
  })

  describe('Season Namespacing', () => {
    it('should use season-namespaced storage key', () => {
      const season = 2027
      const picks = usePicksStorage(season)
      picks.value[123] = 456

      expect(localStorage.getItem(`cfb_picks_${season}`)).toBeDefined()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('should support multiple seasons independently', () => {
      const picks2026 = usePicksStorage(2026)
      const picks2027 = usePicksStorage(2027)

      picks2026.value[123] = 456
      picks2027.value[789] = 101

      expect(picks2026.value).toEqual({ 123: 456 })
      expect(picks2027.value).toEqual({ 789: 101 })
    })
  })

  describe('Reactivity and Serialization', () => {
    it('should reactively update when picks object is mutated', () => {
      const picks = usePicksStorage(SEASON)

      const initialLength = Object.keys(picks.value).length
      picks.value[123] = 456
      const newLength = Object.keys(picks.value).length

      expect(newLength).toBe(initialLength + 1)
    })

    it('should serialize and deserialize correctly', async () => {
      const picks = usePicksStorage(SEASON)
      const testData = {
        123: 456,
        789: 101,
        999: 888
      }

      Object.assign(picks.value, testData)

      await nextTick()

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored).toEqual(testData)

      // Create new instance to test deserialization
      const picks2 = usePicksStorage(SEASON)
      expect(picks2.value).toEqual(testData)
    })
  })

  describe('Cross-Tab Sync Awareness', () => {
    it('should read localStorage changes made by other tabs (simulated)', () => {
      // Simulate Tab A with picks
      const picksA = usePicksStorage(SEASON)
      picksA.value[123] = 456

      // Simulate Tab B writing to localStorage directly
      const tabBData = { 789: 101, 202: 303 }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabBData))

      // Simulate Tab A reading the updated value (this is what VueUse listenToStorageChanges does)
      // For this test, we manually trigger a refresh by creating a new composable instance
      const picksA2 = usePicksStorage(SEASON)

      // The new instance should reflect the cross-tab write
      expect(picksA2.value).toEqual(tabBData)
    })
  })
})
