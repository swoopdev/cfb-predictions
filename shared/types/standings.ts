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

import type { ConferenceId } from '../domain/tiebreakers/types'

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
 * D-01: a rank group is exactly one `RankGroup` emitted by
 * `resolveConferenceRanking` (`shared/domain/tiebreakers/engine.ts`) — never
 * a display-layer relation. Standard competition ranking is unchanged, but
 * the tie definition is now the engine's own ordered partition and nothing
 * else: two teams with an identical conference record land on DIFFERENT
 * ranks whenever the published procedure separated them, and share a rank
 * only when a `RankGroup.teams` array holds more than one team, i.e. the
 * procedure genuinely could not separate them. This supersedes Phase 5's
 * D-04, which grouped ranks by the equivalence closure of "same resolved
 * seed group" and "identical conference W-L" — a relation this phase deletes
 * because it hid the exact defect that forced the reversal: an ACC table
 * rendering `1 Boston College 6-2` above `1 Duke 7-2`, two different records
 * sharing a rank number.
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
   * True when the tiebreaker procedure could not separate this team from at
   * least one other team sharing `rank`.
   *
   * D-01/D-05: `isTied` now means the procedure was genuinely unable to
   * separate the group — it is no longer merely "displayed on the same rank
   * number" (Phase 5's weaker claim, which conflated "the engine defined
   * them as tied for a slot" with "the procedure could not order them"). A
   * false value means every rank above and below this row is either this
   * team's own solitary rank or was earned against real contention
   * (`resolvedBy: 'tiebreaker'` — see `RankGroup.contestedWith`), never a
   * database-id ordering standing in for a tiebreaker result.
   */
  isTied: boolean
}

/**
 * Standings for every P4 conference, keyed by conference name exactly as it
 * appears in `teams.json` (`'SEC' | 'Big Ten' | 'Big 12' | 'ACC'`).
 *
 * WR-06 (deferred from Phase 5): tightened from a loose string index
 * signature to `Record<ConferenceId, ...>` so the type itself expresses
 * "every P4 conference is always present" — `computeStandings` always
 * returns all four keys, even for an entirely unpicked season (every team at
 * 0-0) or a conference with zero rostered members (`[]`). The not-yet-computed
 * state (games/teams still loading) is `undefined` at the call site, held by
 * `useStandings`, never an empty `{}` that would satisfy this type by
 * accident.
 */
export type StandingsResult = Readonly<Record<ConferenceId, readonly StandingsTeam[]>>
