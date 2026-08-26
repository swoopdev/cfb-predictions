import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchRankings } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/rankings.json`. That file may
 * not exist yet (first weekly fetch hasn't run for the season) — `retry:
 * false` avoids hammering a 404, and callers read `query.data` as
 * possibly-`undefined` rather than treating a fetch failure as fatal.
 */
export function useRankings(season = 2026) {
  return useQuery({
    queryKey: queryKeys.rankings(season),
    queryFn: () => fetchRankings(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
