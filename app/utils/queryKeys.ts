/**
 * Single query-key factory consumed by every composable that reads the
 * committed schedule/team datasets (this phase and every phase after it —
 * PROJECT.md's DRY constraint). Stable, hierarchical keys under a shared
 * `['season', season]` prefix so `teams`/`games` never collide.
 */
export const queryKeys = {
  teams: (season: number) => ['season', season, 'teams'] as const,
  games: (season: number) => ['season', season, 'games'] as const,
  rankings: (season: number) => ['season', season, 'rankings'] as const,
  winProbabilities: (season: number) => ['season', season, 'winProbabilities'] as const,
  bettingLines: (season: number) => ['season', season, 'bettingLines'] as const,
  media: (season: number) => ['season', season, 'media'] as const,
  teamRatings: (season: number) => ['season', season, 'teamRatings'] as const,
  venues: (season: number) => ['season', season, 'venues'] as const,
  talent: (season: number) => ['season', season, 'talent'] as const
}
