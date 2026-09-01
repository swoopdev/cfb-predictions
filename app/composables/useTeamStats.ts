import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchTeamStats } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/team-stats.json` (weekly
 * fetch). Same missing-file tolerance as `useRankings`. A team absent from
 * this file simply hasn't finished a game yet -- not an error state.
 */
export function useTeamStats(season = 2026) {
  return useQuery({
    queryKey: queryKeys.teamStats(season),
    queryFn: () => fetchTeamStats(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
