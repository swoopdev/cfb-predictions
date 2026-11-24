import type { SeasonModelData } from './seasonModel'

/**
 * Bump whenever the odds/committee model itself changes (constants,
 * tiebreak proxy, simulation rules): the baseline is keyed on this too, so
 * a deploy with a new model never serves a baseline computed by the old
 * one -- the app recomputes live until the next nightly run.
 */
export const ODDS_MODEL_VERSION = 2

/**
 * A short hash of every model input that changes daily (final scores,
 * rankings, ratings, lines). The nightly baseline in `odds-baseline.json`
 * carries one; the app only uses that baseline when its own freshly loaded
 * data hashes the same, so a stale baseline can never be shown as current.
 */
export function modelFingerprint(data: SeasonModelData): string {
  const parts: string[] = [`v${ODDS_MODEL_VERSION}`, String(data.season)]
  for (const g of data.games) {
    parts.push(`${g.id}:${g.homeId}:${g.awayId}:${g.completed ? `${g.homePoints}-${g.awayPoints}` : '_'}`)
  }
  parts.push(`cfp:${data.cfpRankings?.week ?? '-'}:${(data.cfpRankings?.rankings ?? []).map(r => `${r.teamId}=${r.rank}`).join(',')}`)
  parts.push(`ap:${data.apRankings?.week ?? '-'}:${(data.apRankings?.rankings ?? []).map(r => `${r.teamId}=${r.rank}`).join(',')}`)
  parts.push(`wp:${data.pregame.map(p => `${p.gameId}=${p.homeWinProbability.toFixed(3)}`).join(',')}`)
  parts.push(`sp:${data.spRatings.map(r => `${r.teamId}=${r.spRating === null ? '-' : r.spRating.toFixed(1)}`).join(',')}`)
  parts.push(`post:${data.postseasonGames.map(g => `${g.id}:${g.completed ? `${g.homePoints}-${g.awayPoints}` : '_'}`).join(',')}`)

  const s = parts.join('|')
  let h1 = 0x811C9DC5
  let h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x5BD1E995) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}
