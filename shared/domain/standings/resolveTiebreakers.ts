import type { Game, Team } from '../../types/schedule'
import type { ChampionshipResult, ConferenceId, TeamId } from '../tiebreakers/types'
import { resolveConferenceChampionship } from '../tiebreakers/engine'
import { P4_CONFERENCES, conferenceGamesFor, toOutcomes } from './computeStandings'

/**
 * Every P4 conference's championship resolution, keyed by conference name.
 * `Partial` because a conference is omitted when its resolution throws (see
 * `resolveAllConferences`) — consumers must treat a missing key as "no
 * tiebreaker information", not as an error.
 */
export type ResolvedTiebreakers = Partial<Record<ConferenceId, ChampionshipResult>>

/**
 * Runs Phase 3's tiebreaker engine once per P4 conference and collects the
 * results.
 *
 * This orchestration lives in `shared/domain/` rather than in the week page's
 * `<script setup>` deliberately: Phase 6 needs the identical per-conference
 * setup (membership set, conference-game filter, validated outcome map, FBS
 * id set for the Big 12's total-wins step) to offer manual tie resolution.
 * Duplicating it in a component would violate PROJECT.md's "tiebreaker logic
 * has exactly one implementation, consumed through composables" constraint.
 *
 * Pure and framework-free, same as `computeStandings`.
 *
 * **Failure isolation.** `resolveConferenceChampionship` throws on malformed
 * input and its recursion guards throw on an engine invariant violation. A
 * throw is caught per conference and that conference is simply omitted, so
 * one conference's bad state can never blank out the other three's standings.
 * `computeStandings` degrades to record-order ranking for the missing entry.
 *
 * @param games every game in the season (the full committed slate)
 * @param teams every FBS team
 * @param picks `{ gameId: winningTeamId }`, untrusted — validated by `toOutcomes`
 */
export function resolveAllConferences(
  games: readonly Game[],
  teams: readonly Team[],
  picks: Readonly<Record<number, number>>
): ResolvedTiebreakers {
  const outcomes = toOutcomes(games, picks)
  // Any team present in teams.json is FBS; anything else on the slate (127
  // games' worth of FCS opponents) is not. Needed for the Big 12's one-FCS-
  // win cap.
  const knownFbsTeamIds = new Set<TeamId>(teams.map(t => t.id))

  const resolved: ResolvedTiebreakers = {}

  for (const conference of P4_CONFERENCES) {
    const confTeamIds = new Set<TeamId>(
      teams.filter(t => t.conference === conference).map(t => t.id)
    )
    if (confTeamIds.size === 0) continue

    try {
      resolved[conference] = resolveConferenceChampionship(
        conference,
        conferenceGamesFor(games, confTeamIds),
        outcomes,
        confTeamIds,
        games,
        knownFbsTeamIds
      )
    } catch {
      // Omit this conference; standings fall back to pure record ordering.
    }
  }

  return resolved
}
