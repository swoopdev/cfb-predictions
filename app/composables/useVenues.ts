import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchVenues } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/venues.json`. One-time,
 * season-scoped data (written by `scripts/fetch-data.ts`, not the weekly
 * job) but same missing-file tolerance as `useRankings`.
 */
export function useVenues(season = 2026) {
  return useQuery({
    queryKey: queryKeys.venues(season),
    queryFn: () => fetchVenues(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
