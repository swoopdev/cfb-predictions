import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '~/utils/queryKeys'
import { fetchGamesEnvelope } from '~/utils/fetchSchedule'

/**
 * Sole read path into `public/data/{season}/games.json` for this phase and
 * every phase after it (PROJECT.md DRY constraint). Returns the full
 * `{ season, scheduleHash, games }` envelope unchanged so `scheduleHash`
 * survives for Phase 8's share-link fingerprint check. `staleTime`/`gcTime`
 * are `Infinity` — this data never changes within a session.
 */
export function useGames(season = 2026) {
  return useQuery({
    queryKey: queryKeys.games(season),
    queryFn: () => fetchGamesEnvelope(season),
    staleTime: Infinity,
    gcTime: Infinity
  })
}
