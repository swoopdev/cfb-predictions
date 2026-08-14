import { computed } from 'vue'
import { usePicksStorage } from './usePicksStorage'
import { useGames } from './useGames'

export interface PickProgress {
  picked: number
  total: number
}

/**
 * Composable for reactive progress tracking.
 *
 * Derives pick counts (overall and per-week) from:
 * - usePicksStorage: the picks Ref { gameId: teamId }
 * - useGames: the games query returning { season, scheduleHash, games[] }
 *
 * Progress is always in sync with picks via computed dependencies — no manual updates needed.
 *
 * @param season Season year (default: 2026)
 * @returns Object with:
 *   - progressOverall: Computed<PickProgress> for entire season
 *   - progressForWeek: Function(weekNum) -> Computed<PickProgress> for a specific week
 *
 * @example
 * const { progressOverall, progressForWeek } = usePickProgress(2026)
 * console.log(progressOverall.value) // { picked: 5, total: 130 }
 * console.log(progressForWeek(1).value) // { picked: 2, total: 14 }
 */
export function usePickProgress(season = 2026) {
  const picks = usePicksStorage(season)
  const { data: gamesData } = useGames(season)

  /**
   * Computed: overall progress for entire season
   * Updates whenever picks or games change
   */
  const progressOverall = computed<PickProgress>(() => {
    const games = gamesData.value?.games ?? []
    const total = games.length
    const picked = Object.keys(picks.value).length
    return { picked, total }
  })

  /**
   * Factory function: create a per-week progress computed
   * Each call returns a new computed instance scoped to that week
   */
  function progressForWeek(weekNum: number) {
    return computed<PickProgress>(() => {
      const games = gamesData.value?.games ?? []
      const weekGames = games.filter(g => g.week === weekNum)
      const total = weekGames.length
      const picked = weekGames.filter(g => g.id in picks.value).length
      return { picked, total }
    })
  }

  return { progressOverall, progressForWeek }
}
