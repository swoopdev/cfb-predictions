import { mkdir, writeFile } from 'node:fs/promises'
import { client, getFbsTeams, getGames } from 'cfbd'

import { reportRequiredFieldFailures, transformTeam, transformGame, type TeamOutput } from './lib/schemas'
import { vendorLogo, buildCoverageReport, type CoverageEntryInput } from './lib/coverage'
import { computeScheduleHash } from './lib/schedule-hash'

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

const { data: rawTeams, error: teamsError } = await getFbsTeams({ query: { year: season } })
if (teamsError || !rawTeams) {
  console.error('Failed to fetch teams from CFBD:', teamsError ?? '(no data returned)')
  process.exit(1)
}
if (rawTeams.length === 0) {
  console.error(`CFBD returned 0 teams for season ${season} — refusing to overwrite committed data.`)
  process.exit(1)
}

const { data: rawGames, error: gamesError } = await getGames({ query: { year: season, classification: 'fbs' } })
if (gamesError || !rawGames) {
  console.error('Failed to fetch games from CFBD:', gamesError ?? '(no data returned)')
  process.exit(1)
}
if (rawGames.length === 0) {
  console.error(`CFBD returned 0 games for season ${season} — refusing to overwrite committed data.`)
  process.exit(1)
}

const failures = reportRequiredFieldFailures(rawTeams)
if (failures.length > 0) {
  console.error(JSON.stringify(failures, null, 2))
  process.exit(1)
}

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

const outDir = `public/data/${season}`
await mkdir(outDir, { recursive: true })

await writeFile(`${outDir}/teams.json`, JSON.stringify({ season, teams }, null, 2))
await writeFile(`${outDir}/games.json`, JSON.stringify({ season, scheduleHash, games }, null, 2))
await writeFile(`${outDir}/coverage.json`, JSON.stringify(coverage, null, 2))

console.log(`Fetched ${teams.length} teams, ${games.length} games. Logos missing: ${coverage.summary.logosMissing}`)
