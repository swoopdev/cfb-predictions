import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchPostseasonGames } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/postseason-games.json` (bowls
 * and CFP rounds). Empty until CFBD schedules the postseason after
 * Selection Day; same missing-file tolerance as `useRankings`.
 */
export function usePostseasonGames(season = 2026) {
  return useQuery({
    queryKey: queryKeys.postseasonGames(season),
    queryFn: () => fetchPostseasonGames(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
