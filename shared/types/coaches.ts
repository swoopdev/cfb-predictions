/**
 * Coaches as committed to `public/data/{season}/coaches.json`. Fetched once
 * (`scripts/fetch-team-data.ts`) -- CFBD's `/coaches` returns a coach's full
 * season-by-season history when queried with no `year` filter, so
 * re-fetching weekly would buy nothing new mid-season.
 *
 * One row per team, identified by which coach has a season entry matching
 * the fetch's target year. `careerRecord` sums every season in the coach's
 * full history, at any school, not just the current team's tenure.
 *
 * Deliberately carries no "this season" record: CFBD's `/coaches` win/loss
 * counts for the current season lag `/games`/`/records` (verified against
 * the live API -- a completed, recorded win still read 0-0 here). The team
 * page's record card, sourced from `records.json`, is the accurate number.
 */
export interface CoachEntry {
  teamId: number
  firstName: string
  lastName: string
  careerRecord: { wins: number, losses: number, ties: number, firstYear: number, lastYear: number }
}

export interface CoachesEnvelope {
  season: number
  coaches: CoachEntry[]
}
