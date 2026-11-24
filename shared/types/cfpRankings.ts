import type { TeamRanking } from './rankings'

/**
 * The most recent CFP selection committee ranking, as committed to
 * `public/data/{season}/cfp-rankings.json` by `scripts/fetch-weekly-data.ts`.
 *
 * Kept separate from `rankings.json` on purpose: that file always holds the
 * newest poll week CFBD has, which is the AP poll for the two days between
 * Sunday's AP release and Tuesday's committee release. The playoff bracket
 * and the committee model need the latest COMMITTEE ranking even when it is
 * a week older than the AP poll.
 *
 * `week` is `null` (and `rankings` empty) before the committee's first
 * ranking of the season is published.
 */
export interface CfpRankingsEnvelope {
  season: number
  week: number | null
  rankings: TeamRanking[]
}
