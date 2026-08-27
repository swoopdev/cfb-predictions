import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchBettingLines } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/betting-lines.json`. Same
 * missing-file tolerance as `useRankings`/`useWinProbabilities` -- the file
 * only exists once the weekly fetch workflow has run at least once.
 */
export function useBettingLines(season = 2026) {
  return useQuery({
    queryKey: queryKeys.bettingLines(season),
    queryFn: () => fetchBettingLines(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
