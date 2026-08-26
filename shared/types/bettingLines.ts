/**
 * Weekly betting lines as committed to
 * `public/data/{season}/betting-lines.json`. CFBD returns one entry per
 * provider per game (DraftKings, Bovada, etc.) -- `scripts/fetch-weekly-
 * data.ts` picks a single preferred line per game (`pickLine` in
 * `scripts/lib/schemas.ts`) and resolves it to which side is favored
 * (`pickFavoredSide`) -- so this is already the display-ready shape, not the
 * raw CFBD response. Not every game has a published line -- lookups by
 * `gameId` must be `undefined`-safe, same as rankings/win-probabilities.
 */
export interface BettingLine {
  gameId: number
  /** `'even'` means a pick 'em -- render "Pick 'em" for both teams, not a spread number. */
  favored: 'home' | 'away' | 'even'
  /** Positive magnitude (e.g. `14.5`), meaningless when `favored` is `'even'`. */
  spread: number
}

export interface BettingLinesEnvelope {
  season: number
  week: number
  lines: BettingLine[]
}
