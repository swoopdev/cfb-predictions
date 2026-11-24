import type { Game } from './schedule'

/**
 * Postseason games (bowls and CFP rounds) as committed to
 * `public/data/{season}/postseason-games.json`. Kept out of `games.json` so
 * CFBD's postseason week numbering (which restarts at 1) never collides with
 * the regular-season week pages, and so adding bowls never changes the
 * share-link `scheduleHash`.
 *
 * `notes` is CFBD's free-text game label (e.g. "College Football Playoff
 * First Round"); the bracket matches CFP games by their two participants,
 * not by parsing it.
 */
export interface PostseasonGame extends Game {
  notes: string | null
}

export interface PostseasonGamesEnvelope {
  season: number
  games: PostseasonGame[]
}
