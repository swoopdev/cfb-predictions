/**
 * Season-cumulative team stat totals as committed to
 * `public/data/{season}/team-stats.json`. Weekly cadence -- these accumulate
 * game by game.
 *
 * CFBD's `/stats/season` returns one flat row per `statName` per team (keyed
 * by team NAME, resolved via `buildTeamIdByName` like SP+/FPI/Elo). This
 * shape pivots that into one row per team, `stats` keyed by CFBD's own
 * `statName` strings verbatim (e.g. `totalYards`, `sacks`, `turnovers`) --
 * deliberately not hand-enumerated into named fields, since CFBD does not
 * document a fixed, stable set of `statName` values and a team missing a
 * given stat this week should not require a schema change.
 */
export interface TeamStatsEntry {
  teamId: number
  /** Keyed by CFBD's `statName`. Most values are numeric; a few (e.g. possession time) are formatted strings on the wire. */
  stats: Record<string, number | string>
}

export interface TeamStatsEnvelope {
  season: number
  week: number
  teamStats: TeamStatsEntry[]
}
