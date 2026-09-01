/**
 * Player season stats as committed to `public/data/{season}/player-stats.json`.
 * Weekly cadence -- these accumulate game by game.
 *
 * CFBD's `/stats/player/season` returns one flat row per player per
 * `category`/`statType` (e.g. category `"passing"`, statType `"YDS"`).
 * Verbatim passthrough plus team-name resolution and roster-jersey/position
 * enrichment -- deliberately NOT pre-aggregated into "leaders" here. Which
 * category/statType combinations are worth surfacing as a team's stat
 * leaders is a display decision, not a fetch-transform one; that
 * aggregation lives in `app/utils/statLeaders.ts` as a pure, independently
 * testable function over this array.
 */
export interface PlayerStatEntry {
  playerId: string
  player: string
  teamId: number
  position: string
  category: string
  statType: string
  /** Numeric on the wire for nearly every stat; kept as `string | number` since CFBD does not guarantee it (e.g. `"0-0"`-style fields on some categories). */
  stat: number | string
  /** Resolved from `roster.json` by `playerId` -- `null` when the player isn't on the committed roster (mid-season transfer, walk-on added after the one-time roster fetch). */
  jersey: number | null
}

export interface PlayerStatsEnvelope {
  season: number
  week: number
  playerStats: PlayerStatEntry[]
}
