import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchTeams } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/teams.json` for this phase and
 * every phase after it (PROJECT.md DRY constraint). `staleTime`/`gcTime`
 * are `Infinity` — this data never changes within a session.
 */
export function useTeams(season = 2026) {
  return useQuery({
    queryKey: queryKeys.teams(season),
    queryFn: () => fetchTeams(season),
    staleTime: Infinity,
    gcTime: Infinity
  })
}
