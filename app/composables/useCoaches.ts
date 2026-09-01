import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchCoaches } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/coaches.json` (one-time fetch,
 * `scripts/fetch-team-data.ts`). Same missing-file tolerance as `useRankings`.
 */
export function useCoaches(season = 2026) {
  return useQuery({
    queryKey: queryKeys.coaches(season),
    queryFn: () => fetchCoaches(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
