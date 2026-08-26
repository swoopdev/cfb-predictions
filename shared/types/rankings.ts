/**
 * Weekly poll rankings as committed to `public/data/{season}/rankings.json`.
 * One entry per ranked team for the most recent poll snapshot fetched by
 * `scripts/fetch-weekly-data.ts` — CFP committee rankings once published,
 * AP Top 25 otherwise (CFP snapshots don't start until ~week 9).
 */
export interface TeamRanking {
  teamId: number
  rank: number
}

export interface RankingsEnvelope {
  season: number
  week: number
  poll: string
  rankings: TeamRanking[]
}
