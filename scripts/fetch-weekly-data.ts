import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { client, getRankings, getPregameWinProbabilities, getLines, getMedia, getSp, getFpi, getElo, getTeamsAts, getGames, getRecords, getTeamStats, getPlayerSeasonStats } from 'cfbd'

import {
  transformRankings,
  transformWinProbabilities,
  transformBettingLines,
  transformMedia,
  transformTeamRatings,
  transformGame,
  transformRecords,
  transformTeamStats,
  transformPlayerStats,
  buildTeamIdByName,
  RawPollWeekSchema,
  reportGameFailures,
  type RosterPlayerOutput
} from './lib/schemas'
import { computeScheduleHash } from './lib/schedule-hash'

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
  console.error('Usage: pnpm fetch-weekly-data <season>')
  process.exit(1)
}

client.setConfig({
  headers: { Authorization: `Bearer ${apiKey}` }
})

// `/rankings` with no `week` returns every poll snapshot published so far
// this season. The last entry is the most recent week — that's the one we
// want, since this script runs weekly and always wants "current" rankings.
const { data: rawWeeks, error: rankingsError } = await getRankings({ query: { year: season } })
if (rankingsError || !rawWeeks || rawWeeks.length === 0) {
  console.error(`Failed to fetch rankings from CFBD: ${rankingsError ? JSON.stringify(rankingsError) : '(no data returned)'}`)
  process.exit(1)
}

const latestWeek = RawPollWeekSchema.parse(rawWeeks[rawWeeks.length - 1])
const rankingsOutput = transformRankings(latestWeek)
if (!rankingsOutput) {
  console.error(`No AP or CFP committee poll found for season ${season}, week ${latestWeek.week} — refusing to overwrite committed data.`)
  process.exit(1)
}
const week = rankingsOutput.week

const { data: rawWinProbs, error: wpError } = await getPregameWinProbabilities({ query: { year: season, week } })
if (wpError || !rawWinProbs) {
  console.error(`Failed to fetch pregame win probabilities from CFBD: ${wpError ? JSON.stringify(wpError) : '(no data returned)'}`)
  process.exit(1)
}

const winProbabilitiesOutput = {
  season,
  week,
  probabilities: transformWinProbabilities(rawWinProbs)
}

const { data: rawBettingGames, error: linesError } = await getLines({ query: { year: season, week } })
if (linesError || !rawBettingGames) {
  console.error(`Failed to fetch betting lines from CFBD: ${linesError ? JSON.stringify(linesError) : '(no data returned)'}`)
  process.exit(1)
}

const bettingLinesOutput = {
  season,
  week,
  lines: transformBettingLines(rawBettingGames)
}

// Re-fetches the full season's games (not just `week`) so `completed` /
// `homePoints` / `awayPoints` refresh for every game that finished since the
// last run, not only the current week's — CFBD backfills final scores
// against a game's original week number, not "this week". Core data (gates
// the whole run) rather than the soft-fail enrichment below: picks locking
// and score display both depend on it.
const { data: rawGames, error: gamesError } = await getGames({ query: { year: season, classification: 'fbs' } })
if (gamesError || !rawGames) {
  console.error(`Failed to fetch games from CFBD: ${gamesError ? JSON.stringify(gamesError) : '(no data returned)'}`)
  process.exit(1)
}
if (rawGames.length === 0) {
  console.error(`CFBD returned 0 games for season ${season} — refusing to overwrite committed data.`)
  process.exit(1)
}
const gameFailures = reportGameFailures(rawGames)
if (gameFailures.length > 0) {
  console.error(JSON.stringify(gameFailures, null, 2))
  process.exit(1)
}
const games = rawGames.map(raw => transformGame(raw))
const scheduleHash = computeScheduleHash(games.map(g => g.id))
const gamesOutput = { season, scheduleHash, games }

// Everything below is enrichment for the collapsible game-detail panel, not
// core pick/standings data — a flaky endpoint here shouldn't block the
// rankings/win-probabilities/lines fetch above from committing. Each source
// warns and falls back to an empty list instead of hard-failing the script.
async function fetchOrWarn<T>(label: string, fn: () => Promise<{ data?: T[], error?: unknown }>): Promise<T[]> {
  const { data, error } = await fn()
  if (error || !data) {
    console.warn(`Failed to fetch ${label} from CFBD (continuing without it): ${error ? JSON.stringify(error) : '(no data returned)'}`)
    return []
  }
  return data
}

const rawMedia = await fetchOrWarn('media', () => getMedia({ query: { year: season, week } }))
const rawSp = await fetchOrWarn('SP+ ratings', () => getSp({ query: { year: season } }))
const rawFpi = await fetchOrWarn('FPI ratings', () => getFpi({ query: { year: season } }))
const rawElo = await fetchOrWarn('Elo ratings', () => getElo({ query: { year: season, week } }))
const rawAts = await fetchOrWarn('ATS records', () => getTeamsAts({ query: { year: season } }))
const rawRecords = await fetchOrWarn('records', () => getRecords({ query: { year: season } }))
const rawTeamStats = await fetchOrWarn('team stats', () => getTeamStats({ query: { year: season, classification: 'fbs' } }))
const rawPlayerStats = await fetchOrWarn('player season stats', () => getPlayerSeasonStats({ query: { year: season } }))

// SP+/FPI/Elo/team-stats/player-stats are keyed by team name on the wire —
// resolved back to our canonical teamId via the already-committed
// teams.json, same source CFBD's own school names come from.
const teamsFile = JSON.parse(await readFile(`public/data/${season}/teams.json`, 'utf-8')) as { teams: { id: number, school: string }[] }
const teamIdByName = buildTeamIdByName(teamsFile.teams)

// Player-stats jersey enrichment reads the one-time roster.json
// (`fetch-team-data.ts`'s output) rather than requiring it -- a team page
// still works without jerseys (falls back to `null`) if that script hasn't
// been run yet, same soft-fail posture as the rest of this block.
let jerseyByPlayerId = new Map<string, number | null>()
try {
  const rosterFile = JSON.parse(await readFile(`public/data/${season}/roster.json`, 'utf-8')) as { roster: RosterPlayerOutput[] }
  jerseyByPlayerId = new Map(rosterFile.roster.map(p => [p.id, p.jersey]))
} catch {
  console.warn('roster.json not found (continuing without jersey enrichment) — run `pnpm fetch-team-data` first for that.')
}

const mediaOutput = { season, week, media: transformMedia(rawMedia) }
const teamRatingsOutput = { season, week, ratings: transformTeamRatings(rawSp, rawFpi, rawElo, rawAts, teamIdByName) }
const recordsOutput = { season, records: transformRecords(rawRecords) }
const teamStatsOutput = { season, week, teamStats: transformTeamStats(rawTeamStats, teamIdByName) }
const playerStatsOutput = { season, week, playerStats: transformPlayerStats(rawPlayerStats, teamIdByName, jerseyByPlayerId) }

const outDir = `public/data/${season}`
await mkdir(outDir, { recursive: true })

await writeFile(`${outDir}/rankings.json`, JSON.stringify(rankingsOutput, null, 2))
await writeFile(`${outDir}/win-probabilities.json`, JSON.stringify(winProbabilitiesOutput, null, 2))
await writeFile(`${outDir}/betting-lines.json`, JSON.stringify(bettingLinesOutput, null, 2))
await writeFile(`${outDir}/media.json`, JSON.stringify(mediaOutput, null, 2))
await writeFile(`${outDir}/team-ratings.json`, JSON.stringify(teamRatingsOutput, null, 2))
await writeFile(`${outDir}/games.json`, JSON.stringify(gamesOutput, null, 2))
await writeFile(`${outDir}/records.json`, JSON.stringify(recordsOutput, null, 2))
await writeFile(`${outDir}/team-stats.json`, JSON.stringify(teamStatsOutput, null, 2))
await writeFile(`${outDir}/player-stats.json`, JSON.stringify(playerStatsOutput, null, 2))

const completedCount = games.filter(g => g.completed).length

console.log(
  `Fetched ${rankingsOutput.rankings.length} rankings (${rankingsOutput.poll}, week ${week}), `
  + `${winProbabilitiesOutput.probabilities.length} win probabilities, `
  + `${bettingLinesOutput.lines.length} betting lines, `
  + `${mediaOutput.media.length} media entries, `
  + `${teamRatingsOutput.ratings.length} team ratings, `
  + `${games.length} games (${completedCount} completed), `
  + `${recordsOutput.records.length} team records, `
  + `${teamStatsOutput.teamStats.length} team stat rows, `
  + `and ${playerStatsOutput.playerStats.length} player stat rows.`
)
