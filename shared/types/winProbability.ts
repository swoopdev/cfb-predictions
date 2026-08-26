/**
 * Weekly pregame win probabilities as committed to
 * `public/data/{season}/win-probabilities.json`. One entry per game with a
 * published CFBD pregame model estimate — not every game has one (e.g. FCS
 * matchups), so lookups by `gameId` must be `undefined`-safe.
 */
export interface GameWinProbability {
  gameId: number
  homeWinProbability: number
}

export interface WinProbabilitiesEnvelope {
  season: number
  week: number
  probabilities: GameWinProbability[]
}
