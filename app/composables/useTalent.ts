import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchTalent } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/talent.json`. One-time,
 * season-scoped data (written by `scripts/fetch-data.ts`, not the weekly
 * job) but same missing-file tolerance as `useRankings`.
 */
export function useTalent(season = 2026) {
  return useQuery({
    queryKey: queryKeys.talent(season),
    queryFn: () => fetchTalent(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
