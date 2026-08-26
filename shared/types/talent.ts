/**
 * Static recruiting talent composite as committed to
 * `public/data/{season}/talent.json` -- fetched once by
 * `scripts/fetch-data.ts`, not refreshed weekly (a team's roster talent
 * composite is fixed for the season once rosters are set).
 */
export interface TeamTalentEntry {
  teamId: number
  talent: number
}

export interface TalentEnvelope {
  season: number
  talent: TeamTalentEntry[]
}
