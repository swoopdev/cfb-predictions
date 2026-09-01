/**
 * Season W-L records as committed to `public/data/{season}/records.json`.
 * Weekly cadence (`scripts/fetch-weekly-data.ts`) -- unlike roster/coaches/
 * recruiting, these accumulate as the season is played.
 *
 * CFBD's `/records` response already carries `teamId` directly (unlike SP+/
 * FPI/Elo/talent, which are keyed by team name and need `buildTeamIdByName`)
 * -- `transformRecords` is a straight passthrough, no name resolution.
 */
export interface RecordSplit {
  games: number
  wins: number
  losses: number
  ties: number
}

export interface TeamRecordEntry {
  teamId: number
  expectedWins: number | null
  total: RecordSplit
  conferenceGames: RecordSplit
  homeGames: RecordSplit
  awayGames: RecordSplit
  neutralSiteGames: RecordSplit
}

export interface RecordsEnvelope {
  season: number
  records: TeamRecordEntry[]
}
