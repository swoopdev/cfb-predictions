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
 * `rank` follows standard competition ranking: every team in a rank group
 * shares the same rank number, and the next group's rank skips ahead by the
 * size of the one before it — three teams sharing rank `2` are followed by
 * rank `5`.
 *
 * A rank group is the equivalence closure of two relations (see
 * `computeStandings`): teams the tiebreaker engine placed in the same resolved
 * seed order share a rank (D-11 — the engine's sequence decides their display
 * order but never splits them across rank numbers), and teams with an
 * identical conference record share a rank (D-04). Closing over both is what
 * lets a team the engine's restart redefinition dropped keep the rank of the
 * identical-record team it placed.
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
  /**
   * True when at least one other team in this conference shares `rank`.
   *
   * "Tied" here means exactly "displayed on the same rank number", which for
   * engine-placed teams means the engine defined them as tied for a
   * championship slot BEFORE applying any tiebreaker step (STAND-04) — the
   * step order that separated them lives in `rank`'s row sequence, not here.
   * It is not a claim that the tie is unresolved; an unresolved tie is
   * `needsUserInput` on the engine's own result and is Phase 6's concern
   * (D-10).
   */
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
