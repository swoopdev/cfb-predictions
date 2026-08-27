/**
 * Static venue directory as committed to `public/data/{season}/venues.json`
 * -- fetched once by `scripts/fetch-data.ts`, not refreshed weekly (stadium
 * details don't change mid-season). Joined against `weather.json`'s
 * `venueId` on the frontend to attach venue details to a game.
 */
export interface VenueInfo {
  id: number
  name: string | null
  city: string | null
  state: string | null
  capacity: number | null
  grass: boolean | null
  dome: boolean | null
}

export interface VenuesEnvelope {
  season: number
  venues: VenueInfo[]
}
