import type { Game } from '#shared/types/schedule'

/**
 * Pure-function utilities for bulk pick operations (fill week/season, clear week/season).
 * All functions are pure: they take inputs, return new state, and never mutate inputs or
 * access localStorage directly. Vue components manage the reactive update via `picks.value = newPicks`.
 *
 * **Pattern (D-15):** Bulk operations collect all changes in memory, then return a single
 * object for atomic update. Caller does: `picks.value = result.newPicks` (one mutation).
 *
 * **Provenance (D-05):** Fill operations return which games were auto-filled in a separate
 * array. Caller is responsible for tracking via `markAutoFilled(autoFilledIds)`.
 */

/**
 * Picks a winner for `game` at random -- home or away, each 50/50 -- rather
 * than always the home team. `random` defaults to `Math.random` but is
 * injectable so callers (tests) can supply a deterministic stand-in instead
 * of asserting against genuinely random output.
 */
function randomWinner(game: Game, random: () => number): number {
  return random() < 0.5 ? game.homeId : game.awayId
}

/**
 * Fill all unpicked games in a specific week with a random winner.
 * Existing picks are never overwritten.
 *
 * @param games - Array of all Game objects for the season
 * @param weekNum - Week number to fill (e.g., 1, 2, ...)
 * @param currentPicks - Current picks object { gameId: winningTeamId }
 * @param random - RNG hook, defaults to `Math.random` (this task: injectable so tests can be deterministic)
 * @returns Object with newPicks (updated picks) and autoFilledIds (newly-filled game IDs)
 */
export function fillWeekRemaining(
  games: Game[],
  weekNum: number,
  currentPicks: Record<number, number>,
  random: () => number = Math.random
): { newPicks: Record<number, number>, autoFilledIds: number[] } {
  const weekGames = games.filter(g => g.week === weekNum)
  const updates: Record<number, number> = {}
  const autoFilledIds: number[] = []

  for (const game of weekGames) {
    if (!(game.id in currentPicks)) {
      updates[game.id] = randomWinner(game, random)
      autoFilledIds.push(game.id)
    }
  }

  return {
    newPicks: { ...currentPicks, ...updates },
    autoFilledIds
  }
}

/**
 * Fill all unpicked games in the entire season with a random winner.
 * Existing picks are never overwritten.
 *
 * @param games - Array of all Game objects for the season
 * @param currentPicks - Current picks object { gameId: winningTeamId }
 * @param random - RNG hook, defaults to `Math.random` (this task: injectable so tests can be deterministic)
 * @returns Object with newPicks (updated picks) and autoFilledIds (newly-filled game IDs)
 */
export function fillSeasonRemaining(
  games: Game[],
  currentPicks: Record<number, number>,
  random: () => number = Math.random
): { newPicks: Record<number, number>, autoFilledIds: number[] } {
  const updates: Record<number, number> = {}
  const autoFilledIds: number[] = []

  for (const game of games) {
    if (!(game.id in currentPicks)) {
      updates[game.id] = randomWinner(game, random)
      autoFilledIds.push(game.id)
    }
  }

  return {
    newPicks: { ...currentPicks, ...updates },
    autoFilledIds
  }
}

/**
 * Clear all picks in a specific week.
 * No confirmation is needed (per D-14).
 *
 * @param games - Array of all Game objects for the season
 * @param weekNum - Week number to clear (e.g., 1, 2, ...)
 * @param currentPicks - Current picks object { gameId: winningTeamId }
 * @returns New picks object with all week games removed
 */
export function clearWeek(
  games: Game[],
  weekNum: number,
  currentPicks: Record<number, number>
): Record<number, number> {
  const weekGameIds = new Set(
    games.filter(g => g.week === weekNum).map(g => g.id)
  )

  return Object.fromEntries(
    Object.entries(currentPicks).filter(([gameId]) => !weekGameIds.has(Number(gameId)))
  )
}

/**
 * Clear all picks for the entire season.
 * Caller is responsible for confirmation (per D-14).
 *
 * @returns Empty picks object
 */
export function clearSeason(): Record<number, number> {
  return {}
}
