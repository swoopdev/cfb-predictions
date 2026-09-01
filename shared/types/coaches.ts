/**
 * Coaches as committed to `public/data/{season}/coaches.json`. Fetched once
 * (`scripts/fetch-team-data.ts`) -- CFBD's `/coaches` returns a coach's full
 * season-by-season history regardless of the requested year, so re-fetching
 * weekly would buy nothing new mid-season.
 *
 * One row per team: `currentSeason` is the coach's `CoachSeason` entry
 * matching the fetch's target year (`null` if, for some reason, the current
 * coach has no entry for that year yet -- an early-season edge case).
 * `careerRecord` sums every season in the coach's full history, at any
 * school, not just the current team's tenure.
 */
export interface CoachEntry {
  teamId: number
  firstName: string
  lastName: string
  currentSeason: { year: number, wins: number, losses: number, ties: number } | null
  careerRecord: { wins: number, losses: number, ties: number, firstYear: number, lastYear: number }
}

export interface CoachesEnvelope {
  season: number
  coaches: CoachEntry[]
}
