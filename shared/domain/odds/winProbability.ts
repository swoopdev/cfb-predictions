/**
 * The ONE place a single game's win probability is decided (PROJECT.md's
 * DRY constraint extended to odds): the Monte Carlo simulator, the exact
 * title-game path enumerator, the CFP bracket's "Sim the rest" and the
 * playoff title odds all read win probabilities through this module.
 *
 * Source precedence, per the 2026-11-23 design decision:
 * 1. CFBD's pregame win probability -- derived from the betting line, so it
 *    is the sharpest number available. Only published for the current week.
 * 2. SP+ rating gap plus home field, through a normal CDF. Calibrated on
 *    the 695 completed 2026 FBS-vs-FBS games: the best in-sample fit was
 *    3.75 points of home field with sigma 15 (Brier 0.153, vs 0.160 for
 *    Elo). The ratings are end-of-period ratings (they already "know" the
 *    games being scored), so the constants below are deliberately a little
 *    more conservative than that in-sample optimum.
 * 3. FBS vs. FCS with no line: the FBS team at 95% (the 2026 FBS team won
 *    95.3% of its 127 completed games against FCS opponents).
 */

export const SP_HOME_FIELD_POINTS = 3
export const SP_MARGIN_SIGMA = 16
export const FBS_VS_FCS_WIN_PROBABILITY = 0.95
const MIN_PROBABILITY = 0.01
const MAX_PROBABILITY = 0.99

export interface WinProbabilityGame {
  id: number
  homeId: number
  awayId: number
  neutralSite: boolean
}

export interface WinProbabilityInputs {
  /** CFBD pregame home win probability keyed by game id (betting-line derived). */
  pregame: ReadonlyMap<number, number>
  /** SP+ overall rating keyed by team id. FBS teams only -- a missing team is treated as FCS. */
  spRatings: ReadonlyMap<number, number>
}

/** Abramowitz-Stegun 7.1.26 erf approximation (max error ~1.5e-7) -- plenty for a win probability. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return sign * y
}

export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

function clamp(p: number): number {
  return Math.min(MAX_PROBABILITY, Math.max(MIN_PROBABILITY, p))
}

/**
 * Probability that team `a` beats team `b`, from SP+ alone. `aHosts` adds
 * home field to `a`; pass `false` for a neutral site. Either rating missing
 * means that side is an FCS team.
 */
export function ratingWinProbability(
  inputs: WinProbabilityInputs,
  aId: number,
  bId: number,
  aHosts: boolean
): number {
  const aSp = inputs.spRatings.get(aId)
  const bSp = inputs.spRatings.get(bId)
  if (aSp === undefined && bSp === undefined) return 0.5
  if (aSp === undefined) return 1 - FBS_VS_FCS_WIN_PROBABILITY
  if (bSp === undefined) return FBS_VS_FCS_WIN_PROBABILITY
  const margin = aSp - bSp + (aHosts ? SP_HOME_FIELD_POINTS : 0)
  return clamp(normalCdf(margin / SP_MARGIN_SIGMA))
}

/** Home team's probability of winning a scheduled game, per the precedence above. */
export function homeWinProbability(inputs: WinProbabilityInputs, game: WinProbabilityGame): number {
  const pregame = inputs.pregame.get(game.id)
  if (pregame !== undefined && Number.isFinite(pregame)) return clamp(pregame)
  return ratingWinProbability(inputs, game.homeId, game.awayId, !game.neutralSite)
}

/** Neutral-site matchup the schedule doesn't contain yet (conference title games, CFP quarterfinals onward). */
export function neutralWinProbability(inputs: WinProbabilityInputs, aId: number, bId: number): number {
  return ratingWinProbability(inputs, aId, bId, false)
}

/**
 * Tie-break proxy for the one step the app cannot compute: each
 * conference's final, ranking-based tiebreaker (SportSource Analytics'
 * team rating, or the SEC's capped scoring margin). Simulations and path
 * enumeration need SOME deterministic answer there, so they fall back to
 * SP+ (higher is better); the UI labels every result that depended on it.
 */
export function tiebreakProxy(inputs: WinProbabilityInputs, teamId: number): number {
  return inputs.spRatings.get(teamId) ?? -100
}
