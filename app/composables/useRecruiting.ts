import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchRecruiting } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/recruiting.json` (one-time
 * fetch, `scripts/fetch-team-data.ts`). Same missing-file tolerance as
 * `useRankings`.
 */
export function useRecruiting(season = 2026) {
  return useQuery({
    queryKey: queryKeys.recruiting(season),
    queryFn: () => fetchRecruiting(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
