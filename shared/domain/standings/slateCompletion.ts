import type { Game, Team } from '../../types/schedule'
import type { ConferenceId, TeamId } from '../tiebreakers/types'
import { P4_CONFERENCES, conferenceGamesFor } from './computeStandings'

/**
 * Per-conference "is this conference's slate fully picked" map (D-07). Always
 * carries all four P4 conference keys, mirroring `StandingsResult`'s WR-06
 * shape -- a conference is never silently absent from the result.
 */
export type SlateCompletion = Readonly<Record<ConferenceId, boolean>>

/**
 * D-07's completion predicate: a conference's slate is complete when every
 * game in which BOTH teams belong to that conference is picked. Non-
 * conference games -- including a non-conference pick for a team that also
 * plays in this conference -- never affect the answer, because the predicate
 * only ever looks at `conferenceGamesFor`'s output.
 *
 * Calls `conferenceGamesFor` rather than re-deriving "is this a conference
 * game" from the two teams' `conference` fields. Its own docblock records
 * that one 2026 game is same-conference but flagged non-conference by CFBD's
 * source data -- the flag is trusted and never re-derived (DATA-06).
 *
 * **Membership in `picks` is the completion test, not validity.** A pick
 * naming a team that did not actually play in that game (a corrupt or
 * hand-edited localStorage entry) still counts the game as "picked" here --
 * `toOutcomes` is the single validation boundary for pick VALUES, and it
 * drops such an entry downstream, in the engine's input, not here. This
 * predicate only asks "does a key exist for this game id", which is a
 * strictly cheaper and structurally different question. Two boundaries that
 * quietly disagreed about what "picked" means is exactly how upstream layers
 * drift apart, so this is stated once, here, rather than assumed.
 *
 * **Accepted exposure (06-CONTEXT.md D-07, corrected by 06-RESEARCH.md).**
 * This predicate does not freeze the tiebreaker procedure's *inputs* -- only
 * whether the conference's OWN games are picked. The Big 12's `total-wins`
 * step is fed by `deriveOverallWinCount`, which reads the WHOLE season
 * including non-conference and FCS games, so a later non-conference pick can
 * still move that one step's values without ever flipping this predicate.
 * (06-CONTEXT.md's original text additionally claimed the Big 12's
 * cumulative-opponent-win-pct step reads outside the conference too --
 * 06-RESEARCH.md measured that claim FALSE: `evaluateCumulativeOpponentWinPct`
 * receives the conference-scoped records map built from `conferenceGamesFor`'s
 * own output and reads only conference opponents' conference records, so a
 * non-conference pick cannot move it.) D-08's invalidation hash is what
 * absorbs the remaining `total-wins` exposure -- the two decisions are
 * implemented together and neither is sufficient alone.
 */
export function isConferenceSlateComplete(
  games: readonly Game[],
  confTeamIds: ReadonlySet<TeamId>,
  picks: Readonly<Record<number, number>>
): boolean {
  return conferenceGamesFor(games, confTeamIds).every(game => game.id in picks)
}

/**
 * `isConferenceSlateComplete` for all four P4 conferences at once, deriving
 * each conference's membership set the same way `resolveTiebreakers.ts` does
 * -- filtering `teams` on `conference` -- so there is exactly one derivation
 * shape for "which teams belong to this conference" in the codebase.
 *
 * A conference with zero rostered teams reports complete: `conferenceGamesFor`
 * with an empty membership set returns no games (no game can have BOTH teams
 * in an empty set), and `[].every(...)` is vacuously true. Asserted explicitly
 * in tests rather than left as an accident of `Array.prototype.every`.
 */
export function slateCompletionByConference(
  games: readonly Game[],
  teams: readonly Team[],
  picks: Readonly<Record<number, number>>
): SlateCompletion {
  const result = {} as Record<ConferenceId, boolean>
  for (const conference of P4_CONFERENCES) {
    const confTeamIds = new Set<TeamId>(
      teams.filter(t => t.conference === conference).map(t => t.id)
    )
    result[conference] = isConferenceSlateComplete(games, confTeamIds, picks)
  }
  return result
}
