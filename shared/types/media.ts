/**
 * Weekly broadcast info as committed to `public/data/{season}/media.json`.
 * Not every game has a published outlet yet when this runs -- lookups by
 * `gameId` must be `undefined`-safe, same as the other weekly datasets.
 */
export interface GameMediaInfo {
  gameId: number
  mediaType: string
  outlet: string
  /** ISO 8601 kickoff time -- ignore when `isStartTimeTBD` is true, CFBD still populates it with a placeholder. */
  startTime: string
  isStartTimeTBD: boolean
}

export interface MediaEnvelope {
  season: number
  week: number
  media: GameMediaInfo[]
}
