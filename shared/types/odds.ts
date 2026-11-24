import type { SeasonOdds } from '../domain/odds/simulate'
import type { ConferencePaths } from '../domain/odds/paths'

/**
 * `public/data/{season}/odds-baseline.json`, written by
 * `scripts/compute-odds.ts` in the daily data workflow: simulated odds and
 * exact title-game paths for the real season with no user picks, so the
 * default view renders instantly instead of waiting on the Web Worker.
 */
export interface OddsBaselineEnvelope {
  season: number
  /** `modelFingerprint` of the inputs it was computed from. */
  fingerprint: string
  generatedAt: string
  odds: SeasonOdds
  paths: ConferencePaths[]
}
