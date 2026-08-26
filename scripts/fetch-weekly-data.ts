import { mkdir, writeFile } from 'node:fs/promises'
import { client, getRankings, getPregameWinProbabilities } from 'cfbd'

import { transformRankings, transformWinProbabilities, RawPollWeekSchema } from './lib/schemas'

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

const { data: rawWinProbs, error: wpError } = await getPregameWinProbabilities({
  query: { year: season, week: rankingsOutput.week }
})
if (wpError || !rawWinProbs) {
  console.error(`Failed to fetch pregame win probabilities from CFBD: ${wpError ? JSON.stringify(wpError) : '(no data returned)'}`)
  process.exit(1)
}

const winProbabilitiesOutput = {
  season,
  week: rankingsOutput.week,
  probabilities: transformWinProbabilities(rawWinProbs)
}

const outDir = `public/data/${season}`
await mkdir(outDir, { recursive: true })

await writeFile(`${outDir}/rankings.json`, JSON.stringify(rankingsOutput, null, 2))
await writeFile(`${outDir}/win-probabilities.json`, JSON.stringify(winProbabilitiesOutput, null, 2))

console.log(
  `Fetched ${rankingsOutput.rankings.length} rankings (${rankingsOutput.poll}, week ${rankingsOutput.week}) `
  + `and ${winProbabilitiesOutput.probabilities.length} win probabilities.`
)
