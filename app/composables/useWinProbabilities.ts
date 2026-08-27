import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchWinProbabilities } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/win-probabilities.json`. Same
 * missing-file tolerance as `useRankings` — the file only exists once the
 * weekly fetch workflow has run at least once for the season.
 */
export function useWinProbabilities(season = 2026) {
  return useQuery({
    queryKey: queryKeys.winProbabilities(season),
    queryFn: () => fetchWinProbabilities(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
