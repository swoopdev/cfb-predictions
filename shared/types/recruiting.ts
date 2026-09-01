/**
 * Recruiting class rankings as committed to `public/data/{season}/recruiting.json`.
 * Fetched once (`scripts/fetch-team-data.ts`) -- a signing class's rank for a
 * given year is fixed once national signing day passes, same reasoning as
 * `talent.json`'s composite score (which this complements: talent is roster
 * strength overall, this is one class's rank).
 */
export interface RecruitingRankEntry {
  teamId: number
  rank: number
  points: number
}

export interface RecruitingEnvelope {
  season: number
  recruiting: RecruitingRankEntry[]
}
