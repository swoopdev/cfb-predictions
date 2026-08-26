/**
 * Team/Game shapes as committed to `public/data/{season}/{teams,games}.json`.
 *
 * Deliberately NOT imported from `scripts/lib/schemas.ts` (`TeamOutput`/
 * `GameOutput`): that file lives on `tsconfig.scripts.json`'s program only,
 * and `TeamOutput` lacks the `logo` field the fetch script bolts on after
 * `transformTeam` runs. Redeclaring here is the single DRY source for the
 * app layer (PROJECT.md's team-lookup constraint), consumed via Nuxt 4's
 * `shared/` auto-import scope (`#shared/types/schedule`).
 */
export interface Team {
  id: number
  school: string
  mascot: string | null
  abbreviation: string | null
  conference: string
  classification: string | null
  color: string
  alternateColor: string
  logo: string
}

export interface Game {
  id: number
  week: number
  seasonType: string
  homeId: number
  homeTeam: string
  awayId: number
  awayTeam: string
  conferenceGame: boolean
  neutralSite: boolean
  /** Joins against `venues.json`'s `id` for the game-detail modal's venue row. */
  venueId: number | null
}
