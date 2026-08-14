/**
 * Single query-key factory consumed by every composable that reads the
 * committed schedule/team datasets (this phase and every phase after it —
 * PROJECT.md's DRY constraint). Stable, hierarchical keys under a shared
 * `['season', season]` prefix so `teams`/`games` never collide.
 */
export const queryKeys = {
  teams: (season: number) => ['season', season, 'teams'] as const,
  games: (season: number) => ['season', season, 'games'] as const
}
