import { readFile, writeFile } from 'node:fs/promises'
import { createSeasonModel, EMPTY_SCENARIO, seasonModelDataFrom } from '../shared/domain/odds/seasonModel'
import { simulateSeason } from '../shared/domain/odds/simulate'
import { enumerateTitleGamePaths } from '../shared/domain/odds/paths'
import { modelFingerprint } from '../shared/domain/odds/fingerprint'
import { P4_CONFERENCES } from '../shared/domain/standings/computeStandings'
import type { OddsBaselineEnvelope } from '../shared/types/odds'

/**
 * Nightly baseline odds: runs the same simulation and exact path
 * enumeration the app's Web Worker runs, for the real season with no user
 * picks, and commits the result as `odds-baseline.json` so the default
 * view renders instantly. Reads only the committed `public/data/{season}/`
 * files -- no API key, no network.
 *
 * Usage: pnpm compute-odds <season> [sims]
 */

const season = Number(process.argv[2])
const sims = Number(process.argv[3] ?? 10000)
if (!Number.isInteger(season) || !Number.isInteger(sims) || sims <= 0) {
  console.error('Usage: pnpm compute-odds <season> [sims]')
  process.exit(1)
}

const dir = `public/data/${season}`

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(`${dir}/${file}`, 'utf-8')) as T
  } catch {
    return null
  }
}

const gamesFile = await readJson<{ games: never[] }>('games.json')
const teamsFile = await readJson<{ teams: never[] }>('teams.json')
if (!gamesFile || !teamsFile) {
  console.error(`games.json/teams.json missing under ${dir} -- run pnpm fetch-data ${season} first.`)
  process.exit(1)
}

const data = seasonModelDataFrom({
  season,
  games: gamesFile.games,
  teams: teamsFile.teams,
  winProbabilities: await readJson('win-probabilities.json'),
  teamRatings: await readJson('team-ratings.json'),
  cfpRankings: await readJson('cfp-rankings.json'),
  rankings: await readJson('rankings.json'),
  postseason: await readJson('postseason-games.json')
})

const started = performance.now()
const model = createSeasonModel(data)
const odds = simulateSeason(model, EMPTY_SCENARIO, sims, season)
const paths = P4_CONFERENCES.map(conference => enumerateTitleGamePaths(model, EMPTY_SCENARIO, conference))

const out: OddsBaselineEnvelope = {
  season,
  fingerprint: modelFingerprint(data),
  generatedAt: new Date().toISOString(),
  odds,
  paths
}

await writeFile(`${dir}/odds-baseline.json`, JSON.stringify(out))

const seconds = ((performance.now() - started) / 1000).toFixed(1)
const exact = paths.filter(p => p.mode === 'exact').map(p => p.conference)
console.log(`Simulated ${sims} seasons (${odds.openGames} open games) in ${seconds}s; exact title-game paths for ${exact.length ? exact.join(', ') : 'no conference yet'}.`)
