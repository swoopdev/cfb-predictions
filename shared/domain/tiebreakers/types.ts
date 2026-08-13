/**
 * A CFBD team id. Kept as a distinct alias (not a bare `number`) so every
 * tiebreaker function signature below documents its own intent at a glance.
 */
export type TeamId = number

/**
 * A CFBD game id.
 */
export type GameId = number

/**
 * The four power conferences this phase's tiebreaker engine resolves
 * championship participants for (PROJECT.md's stated v1 scope — G5
 * conferences are pickable but have no standings/tiebreaker UI).
 */
export type ConferenceId = 'SEC' | 'Big Ten' | 'Big 12' | 'ACC'

/**
 * The minimal game shape the tiebreaker engine needs. Deliberately NOT
 * importing `GameOutput` from `scripts/lib/schemas.ts` -- `shared/domain/`
 * must stay decoupled from the `scripts/` directory, which is a one-time
 * build-time fetch tool, not app runtime code. `Game` is structurally
 * compatible with `GameOutput` (a subset of its fields), so Phase 2/4/5
 * callers can pass a real fetched `GameOutput` value directly wherever a
 * `Game` is expected, with no cast and no adapter layer required.
 */
export interface Game {
  id: GameId
  homeId: TeamId
  awayId: TeamId
  conferenceGame: boolean
}

/**
 * The frozen, best-to-worst raw-win-percentage ordering of a conference's
 * teams, grouped into buckets: `bucket.length > 1` means those teams are
 * tied on raw win percentage at that slot. Computed once per
 * `resolveConferenceChampionship` call and passed as a plain value into
 * every step evaluator -- this is the direct fix for PITFALLS.md Pitfall
 * 4's circularity trap ("resolving a tie for 1st requires resolving the
 * tie for 4th"). Never recomputed mid-procedure.
 */
export type BaseOrdering = readonly TeamId[][]
