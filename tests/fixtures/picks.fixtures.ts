/**
 * Test fixtures for pick state and auto-filled game ID tests.
 * Used across multiple test suites for consistency and reusability.
 */

/**
 * Empty picks object: no games have been picked.
 */
export const emptyPicks: Record<number, number> = {}

/**
 * Partial picks: a few games have been picked.
 * gameId 123 → teamId 456 (home team)
 * gameId 789 → teamId 101 (away team)
 * gameId 202 → teamId 303 (home team)
 */
export const partialPicks: Record<number, number> = {
  123: 456,
  789: 101,
  202: 303
}

/**
 * All games picked: simulates a fully completed season scenario.
 * Represents 888 games with picks distributed between home/away teams.
 * (Stub: only first 50 for test purposes; real fixture would have all 888)
 */
export const allGamesPicked: Record<number, number> = {
  ...Object.fromEntries(
    Array.from({ length: 50 }, (_, i) => {
      const gameId = i + 1
      const teamId = i % 2 === 0 ? gameId + 1000 : gameId + 2000
      return [gameId, teamId]
    })
  )
}

/**
 * Corrupted JSON examples for testing error recovery.
 */
export const corruptedJsonExamples = {
  /**
   * Plain text (not JSON): "not json"
   */
  invalidJson: 'not json',

  /**
   * JSON null value (fails shape validation check)
   */
  jsonNull: 'null',

  /**
   * JSON array instead of object (fails shape validation check)
   */
  jsonArray: '[123, 456]',

  /**
   * Truncated JSON (missing closing brace)
   */
  truncatedJson: '{"123": 456, "789": 101',

  /**
   * Empty string
   */
  emptyString: '',

  /**
   * Single character
   */
  singleChar: 'x'
}

/**
 * Edge-case game IDs for testing boundary conditions.
 */
export const edgeCaseGameIds = {
  /**
   * Maximum safe integer in JavaScript
   */
  maxSafeInteger: Number.MAX_SAFE_INTEGER,

  /**
   * Large but valid game ID
   */
  largeGameId: 999999,

  /**
   * Minimum safe integer
   */
  minSafeInteger: Number.MIN_SAFE_INTEGER,

  /**
   * Zero (edge case: is zero a valid game ID?)
   * For this app, no — game IDs start at 1
   */
  zero: 0,

  /**
   * Negative number (edge case)
   */
  negative: -1
}

/**
 * Auto-filled game IDs for testing provenance tracking.
 */
export const autoFilledExamples = {
  /**
   * Empty array: no games were auto-filled
   */
  empty: [],

  /**
   * Single game auto-filled
   */
  single: [123],

  /**
   * Multiple games auto-filled
   */
  multiple: [123, 456, 789, 101, 202],

  /**
   * Duplicates (tests idempotence in markAutoFilled)
   */
  withDuplicates: [123, 456, 123, 789, 456],

  /**
   * Large set: simulates a bulk fill of one week (8-15 games)
   */
  bulkWeek: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],

  /**
   * Full season auto-filled (stub: first 50 games)
   */
  bulkSeason: Array.from({ length: 50 }, (_, i) => i + 1)
}

/**
 * Cross-tab sync scenario fixtures: represents state before/after sync.
 */
export const crossTabSyncScenarios = {
  /**
   * Tab A initial state
   */
  tabABefore: { 123: 456 },

  /**
   * Tab B initial state (different picks)
   */
  tabBBefore: { 789: 101, 202: 303 },

  /**
   * Tab A after syncing with Tab B (reads the merged or updated state)
   */
  tabAAfter: { 789: 101, 202: 303, 123: 456 },

  /**
   * Tab B after syncing with Tab A (same merged state)
   */
  tabBAfter: { 789: 101, 202: 303, 123: 456 }
}
