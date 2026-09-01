import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { client, getRoster, getCoaches, getTeamRecruitingRankings } from 'cfbd'

import {
  transformRoster,
  transformCoaches,
  transformRecruiting,
  buildTeamIdByName
} from './lib/schemas'

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
  console.error('Usage: pnpm fetch-team-data <season>')
  process.exit(1)
}

client.setConfig({
  headers: { Authorization: `Bearer ${apiKey}` }
})

// Season-scoped but roster/coaches/recruiting are all one-time fetches (like
// venues.json/talent.json in fetch-data.ts) -- none of these change mid-season,
// so there's no weekly-cadence reason to re-fetch them. Requires teams.json to
// already be committed (fetch-data.ts's output) for the name -> teamId join.
const teamsFile = JSON.parse(await readFile(`public/data/${season}/teams.json`, 'utf-8')) as { teams: { id: number, school: string }[] }
const teamIdByName = buildTeamIdByName(teamsFile.teams)

const { data: rawRoster, error: rosterError } = await getRoster({ query: { year: season, classification: 'fbs' } })
if (rosterError || !rawRoster) {
  console.error(`Failed to fetch roster from CFBD: ${rosterError ? JSON.stringify(rosterError) : '(no data returned)'}`)
  process.exit(1)
}

// No `year` filter -- CFBD truncates a coach's `seasons` array to just the
// requested year when one is passed, which would silently break
// `transformCoaches`'s career-total sum (verified against the live API:
// `{team: 'Eastern Michigan'}` alone returns Chris Creighton's full 13-season
// history; adding `year: 2026` would return only the 2026 entry). Fetching
// every coach's full history and filtering to `season` client-side in
// `transformCoaches` is the only way to get an accurate `careerRecord`.
const { data: rawCoaches, error: coachesError } = await getCoaches({})
if (coachesError || !rawCoaches) {
  console.error(`Failed to fetch coaches from CFBD: ${coachesError ? JSON.stringify(coachesError) : '(no data returned)'}`)
  process.exit(1)
}

const { data: rawRecruiting, error: recruitingError } = await getTeamRecruitingRankings({ query: { year: season } })
if (recruitingError || !rawRecruiting) {
  console.error(`Failed to fetch recruiting rankings from CFBD: ${recruitingError ? JSON.stringify(recruitingError) : '(no data returned)'}`)
  process.exit(1)
}

const roster = transformRoster(rawRoster, teamIdByName)
const coaches = transformCoaches(rawCoaches, season)
const recruiting = transformRecruiting(rawRecruiting, teamIdByName)

const outDir = `public/data/${season}`
await mkdir(outDir, { recursive: true })

await writeFile(`${outDir}/roster.json`, JSON.stringify({ season, roster }, null, 2))
await writeFile(`${outDir}/coaches.json`, JSON.stringify({ season, coaches }, null, 2))
await writeFile(`${outDir}/recruiting.json`, JSON.stringify({ season, recruiting }, null, 2))

console.log(
  `Fetched ${roster.length} roster entries, ${coaches.length} coaches, and ${recruiting.length} recruiting rankings.`
)
