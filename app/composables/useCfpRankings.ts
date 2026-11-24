import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchCfpRankings } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/cfp-rankings.json` -- the latest
 * CFP committee ranking (see `CfpRankingsEnvelope` for why it's separate
 * from `rankings.json`). Same missing-file tolerance as `useRankings`.
 */
export function useCfpRankings(season = 2026) {
  return useQuery({
    queryKey: queryKeys.cfpRankings(season),
    queryFn: () => fetchCfpRankings(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
