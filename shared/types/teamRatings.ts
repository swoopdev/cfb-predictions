/**
 * Weekly team power ratings as committed to
 * `public/data/{season}/team-ratings.json`. One row per team merging four
 * CFBD sources (SP+, FPI, Elo, against-the-spread record) -- all four are
 * season-cumulative (no per-week snapshot from CFBD, `getFpi`/`getTeamsAts`
 * don't even take a `week` param), so this refreshes weekly but each field
 * reflects "as of right now," not a specific week. A team missing from one
 * source (e.g. an FCS team with no SP+ rating) still gets a row with that
 * field `null` -- never drop the whole row for a partial match.
 */
export interface TeamRatingEntry {
  teamId: number
  spRating: number | null
  spRanking: number | null
  fpi: number | null
  /** National FPI rank, from CFBD's nested `resumeRanks.fpi` -- not the same field as `fpi` itself. */
  fpiRanking: number | null
  elo: number | null
  atsWins: number | null
  atsLosses: number | null
  atsPushes: number | null
}

export interface TeamRatingsEnvelope {
  season: number
  week: number
  ratings: TeamRatingEntry[]
}
