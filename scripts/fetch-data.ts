import { mkdir, writeFile } from 'node:fs/promises'
import { client, getFbsTeams, getGames, getVenues, getTalent } from 'cfbd'

import { transformTeam, transformGame, transformVenues, transformTalent, buildTeamIdByName, type TeamOutput } from './lib/schemas'
import { vendorLogo, buildCoverageReport, type CoverageEntryInput } from './lib/coverage'
import { computeScheduleHash } from './lib/schedule-hash'
import { fetchSourceData } from './lib/fetch-source'

type TeamOutputWithLogo = TeamOutput & { logo: string }

try {
  process.loadEnvFile('.env')
} catch {
  // .env may not exist yet — the explicit key check below surfaces that clearly
}

const apiKey = process.env.CFBD_API_KEY
if (!apiKey) {
  console.error('CFBD_API_KEY not set in .env')
  process.exit(1)
}

const season = Number(process.argv[2])
if (!Number.isInteger(season)) {
  console.error('Usage: pnpm fetch-data <season>')
  process.exit(1)
}

client.setConfig({
  headers: { Authorization: `Bearer ${apiKey}` }
})

const sourceResult = await fetchSourceData(season, {
  fetchTeams: () => getFbsTeams({ query: { year: season } }),
  fetchGames: () => getGames({ query: { year: season, classification: 'fbs' } })
})
if (!sourceResult.ok) {
  console.error(sourceResult.reason)
  process.exit(1)
}
const { rawTeams, rawGames } = sourceResult

const teams: TeamOutputWithLogo[] = []
const coverageEntries: CoverageEntryInput[] = []

for (const raw of rawTeams) {
  const core = transformTeam(raw)
  const rawLogo = (raw as { logos?: string[] | null }).logos?.[0]
  const result = await vendorLogo(core.id, rawLogo)

  teams.push({
    ...core,
    logo: result.status === 'ok' ? result.path : '/logos/placeholder.svg'
  })

  coverageEntries.push({
    id: core.id,
    school: core.school,
    requiredFieldsOk: true,
    missingFields: [],
    logoStatus: result.status
  })
}

const games = rawGames.map(raw => transformGame(raw))

const scheduleHash = computeScheduleHash(games.map(g => g.id))

const coverage = buildCoverageReport(season, coverageEntries)

// Venues/talent are one-time, season-scoped fetches (stadiums don't move,
// roster talent composites are fixed once rosters are set) — unlike
// rankings/win-probabilities/lines/media/weather/team-ratings, these never
// need scripts/fetch-weekly-data.ts's Monday cadence. Soft-fail: this
// script's hard-fail gate (fetchSourceData above) is reserved for
// teams/games, the data everything else in the app depends on — a flaky
// venues/talent endpoint shouldn't block that from committing.
const { data: rawVenues, error: venuesError } = await getVenues()
if (venuesError || !rawVenues) {
  console.warn(`Failed to fetch venues from CFBD (continuing without it): ${venuesError ? JSON.stringify(venuesError) : '(no data returned)'}`)
}
const { data: rawTalent, error: talentError } = await getTalent({ query: { year: season } })
if (talentError || !rawTalent) {
  console.warn(`Failed to fetch talent from CFBD (continuing without it): ${talentError ? JSON.stringify(talentError) : '(no data returned)'}`)
}

const teamIdByName = buildTeamIdByName(teams)
const venuesOutput = { season, venues: transformVenues(rawVenues ?? []) }
const talentOutput = { season, talent: transformTalent(rawTalent ?? [], teamIdByName) }

const outDir = `public/data/${season}`
await mkdir(outDir, { recursive: true })

await writeFile(`${outDir}/teams.json`, JSON.stringify({ season, teams }, null, 2))
await writeFile(`${outDir}/games.json`, JSON.stringify({ season, scheduleHash, games }, null, 2))
await writeFile(`${outDir}/coverage.json`, JSON.stringify(coverage, null, 2))
await writeFile(`${outDir}/venues.json`, JSON.stringify(venuesOutput, null, 2))
await writeFile(`${outDir}/talent.json`, JSON.stringify(talentOutput, null, 2))

console.log(
  `Fetched ${teams.length} teams, ${games.length} games. Logos missing: ${coverage.summary.logosMissing}. `
  + `${venuesOutput.venues.length} venues, ${talentOutput.talent.length} talent ratings.`
)
