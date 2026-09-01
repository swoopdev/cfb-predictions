import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchRecords } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/records.json` (weekly fetch).
 * Same missing-file tolerance as `useRankings`. Note: the committed file
 * carries every classification CFBD returns (FBS/FCS/D2/...), not just FBS
 * -- callers look up by the FBS teamIds from `useTeams` and ignore the rest.
 */
export function useRecords(season = 2026) {
  return useQuery({
    queryKey: queryKeys.records(season),
    queryFn: () => fetchRecords(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
