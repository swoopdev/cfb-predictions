import { $fetch } from 'ofetch'
import type { Game, Team } from '#shared/types/schedule'
import type { RankingsEnvelope } from '#shared/types/rankings'
import type { WinProbabilitiesEnvelope } from '#shared/types/winProbability'
import type { BettingLinesEnvelope } from '#shared/types/bettingLines'
import type { MediaEnvelope } from '#shared/types/media'
import type { TeamRatingsEnvelope } from '#shared/types/teamRatings'
import type { VenuesEnvelope } from '#shared/types/venues'
import type { TalentEnvelope } from '#shared/types/talent'

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

/**
 * `rankings.json`/`win-probabilities.json` are written weekly by
 * `scripts/fetch-weekly-data.ts` and may not exist yet for a season that
 * hasn't had its first weekly fetch run — callers must treat a fetch
 * failure here as "no rankings/win-probability data available" rather than
 * a hard error.
 */
export async function fetchRankings(season: number): Promise<RankingsEnvelope> {
  return await $fetch<RankingsEnvelope>(`/data/${season}/rankings.json`)
}

export async function fetchWinProbabilities(season: number): Promise<WinProbabilitiesEnvelope> {
  return await $fetch<WinProbabilitiesEnvelope>(`/data/${season}/win-probabilities.json`)
}

export async function fetchBettingLines(season: number): Promise<BettingLinesEnvelope> {
  return await $fetch<BettingLinesEnvelope>(`/data/${season}/betting-lines.json`)
}

export async function fetchMedia(season: number): Promise<MediaEnvelope> {
  return await $fetch<MediaEnvelope>(`/data/${season}/media.json`)
}

export async function fetchTeamRatings(season: number): Promise<TeamRatingsEnvelope> {
  return await $fetch<TeamRatingsEnvelope>(`/data/${season}/team-ratings.json`)
}

/**
 * `venues.json`/`talent.json` are one-time, season-scoped fetches (written
 * by `scripts/fetch-data.ts`, not the weekly job) but share the same
 * missing-file tolerance as the weekly datasets above.
 */
export async function fetchVenues(season: number): Promise<VenuesEnvelope> {
  return await $fetch<VenuesEnvelope>(`/data/${season}/venues.json`)
}

export async function fetchTalent(season: number): Promise<TalentEnvelope> {
  return await $fetch<TalentEnvelope>(`/data/${season}/talent.json`)
}
