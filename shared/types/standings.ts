/**
 * Standings shapes produced by `shared/domain/standings/computeStandings.ts`
 * and consumed by the standings UI (Phase 5) and the tiebreaker UI (Phase 6).
 *
 * Deliberately separate from `shared/domain/tiebreakers/records.ts`'s
 * `ConferenceRecord`: that one is the tiebreaker engine's internal working
 * shape (win pct, beat/lostTo/opponents sets) and exists to feed step
 * evaluators. This one is the *display* contract — the minimum a standings
 * row needs — and is intentionally free of engine internals so the UI never
 * grows a dependency on tiebreaker mechanics.
 */

/**
 * A win/loss pair. Used for BOTH the overall (season-wide) record and the
 * conference-games-only record; PROJECT.md's core value depends on those two
 * staying distinct measurement axes, never collapsed into a single number or
 * a win percentage (D-07/D-08).
 */
export interface ConferenceRecord {
  wins: number
  losses: number
}

/**
 * One row of a conference's standings table.
 *
 * `rank` follows standard competition ranking (D-04): every team with an
 * identical conference record shares the same rank number, and the next
 * distinct record's rank skips ahead by the size of the tied group — three
 * teams tied at 6-2 all show `2`, and the next team shows `5`.
 */
export interface StandingsTeam {
  id: number
  school: string
  conference: string
  /** Season-wide record across every game, conference and non-conference. */
  overallRecord: ConferenceRecord
  /** Conference-games-only record. Drives `rank`. */
  confRecord: ConferenceRecord
  rank: number
  /** True when at least one other team in this conference shares `rank`. */
  isTied: boolean
}

/**
 * Standings for every P4 conference, keyed by conference name exactly as it
 * appears in `teams.json` (`'SEC' | 'Big Ten' | 'Big 12' | 'ACC'`). Every P4
 * conference is always present, even when no picks have been made — an
 * unpicked season yields every team at 0-0.
 */
export type StandingsResult = {
  [confName: string]: StandingsTeam[]
}
