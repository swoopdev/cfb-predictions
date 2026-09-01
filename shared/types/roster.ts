/**
 * Roster as committed to `public/data/{season}/roster.json`. Fetched once
 * (`scripts/fetch-team-data.ts`) like `talent.json`/`venues.json` -- rosters
 * don't change mid-season. Deliberately NOT rendered as its own team-page
 * list (2026-09-01 decision): the only consumer is the stat-leaders module,
 * which joins a leader's `playerId` back to this file for jersey/position.
 */
export interface RosterPlayerEntry {
  /** CFBD's roster ids are opaque strings, unlike every other numeric id in this app. */
  id: string
  teamId: number
  firstName: string
  lastName: string
  position: string | null
  jersey: number | null
  height: number | null
  weight: number | null
}

export interface RosterEnvelope {
  season: number
  roster: RosterPlayerEntry[]
}
