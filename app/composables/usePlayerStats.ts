import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchPlayerStats } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/player-stats.json` (weekly
 * fetch). Same missing-file tolerance as `useRankings`. Consumed by
 * `app/utils/statLeaders.ts` to derive a team's stat leaders -- this
 * composable never filters/aggregates itself.
 */
export function usePlayerStats(season = 2026) {
  return useQuery({
    queryKey: queryKeys.playerStats(season),
    queryFn: () => fetchPlayerStats(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
