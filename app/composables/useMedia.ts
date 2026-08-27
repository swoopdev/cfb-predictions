import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchMedia } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/media.json`. Same missing-file
 * tolerance as `useRankings` -- the file only exists once the weekly fetch
 * workflow has run at least once for the season.
 */
export function useMedia(season = 2026) {
  return useQuery({
    queryKey: queryKeys.media(season),
    queryFn: () => fetchMedia(season),
    retry: false,
    throwOnError: false,
    staleTime: Infinity,
    gcTime: Infinity
  })
}
