import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchOddsBaseline } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/odds-baseline.json`, the nightly
 * no-picks odds. Missing-file tolerant: without it the worker simply
 * computes the default view too.
 */
export function useOddsBaseline(season = 2026) {
  return useQuery({
    queryKey: queryKeys.oddsBaseline(season),
    queryFn: () => fetchOddsBaseline(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
