import { $fetch } from 'ofetch'
import type { Game, Team } from '#shared/types/schedule'

/**
 * `$fetch` is imported explicitly from `ofetch` (rather than relying on
 * Nuxt's auto-imported global) so this module is directly unit-testable in
 * a plain vitest run via `vi.mock('ofetch', ...)`.
 */

interface TeamsEnvelope {
  season: number
  teams: Team[]
}

export interface GamesEnvelope {
  season: number
  scheduleHash: string
  games: Game[]
}

/**
 * `teams.json` is a `{ season, teams: [...] }` envelope, never a bare array
 * (RESEARCH.md Pitfall 2) — returns the unwrapped `.teams` array.
 */
export async function fetchTeams(season: number): Promise<Team[]> {
  const res = await $fetch<TeamsEnvelope>(`/data/${season}/teams.json`)
  return res.teams
}

/**
 * `games.json` is a `{ season, scheduleHash, games: [...] }` envelope.
 * Returns the FULL envelope unchanged (does not unwrap `.games` here) —
 * `scheduleHash` must survive so Phase 8's share-link fingerprint check can
 * read it from the same composable's raw query data.
 */
export async function fetchGamesEnvelope(season: number): Promise<GamesEnvelope> {
  return await $fetch<GamesEnvelope>(`/data/${season}/games.json`)
}
