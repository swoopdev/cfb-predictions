import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchTeamRatings } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/team-ratings.json` (SP+, FPI,
 * Elo, ATS record merged per team). Same missing-file tolerance as
 * `useRankings`.
 */
export function useTeamRatings(season = 2026) {
  return useQuery({
    queryKey: queryKeys.teamRatings(season),
    queryFn: () => fetchTeamRatings(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
