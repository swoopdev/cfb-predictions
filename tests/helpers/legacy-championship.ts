import type {
  ConferenceId,
  RankGroup,
  TeamId,
  TerminalReason,
  TiebreakerResult
} from '../../shared/domain/tiebreakers/types'
import { championshipFor, resolveConferenceRanking } from '../../shared/domain/tiebreakers/engine'

/**
 * Test-only reproduction of the pre-Plan-06-03 combined two-seed engine entry
 * point's return shape (`{ conference, seed1, seed2 }`, each a
 * `TiebreakerResult`), built on top of `resolveConferenceRanking` +
 * `championshipFor`.
 *
 * The old entry point and its legacy result type are deleted from `shared/`
 * in Plan 06-03 (D-03/D-12 -- one championship shape, not two). The
 * pre-Phase-6 conference test suites (`tests/tiebreakers-{sec,bigten,big12,
 * acc,engine}.test.ts`) assert against that exact seed1/seed2 shape at ~90
 * call sites; reproducing it here (test-only, never imported by `shared/` or
 * `app/`) lets those assertions stay as written rather than all being
 * rewritten to `ConferenceRanking.groups`, while still satisfying DRY -- one
 * adapter, not one per file.
 */
export interface LegacyChampionship {
  conference: ConferenceId
  seed1: TiebreakerResult
  seed2: TiebreakerResult
}

function toResult(group: RankGroup | undefined): TiebreakerResult {
  if (group === undefined) {
    return { status: 'resolved', order: [], trace: [] }
  }
  if (group.resolvedBy === 'unresolved') {
    return {
      status: 'needsUserInput',
      tiedTeams: group.teams,
      reason: group.terminalReason as TerminalReason,
      trace: group.trace
    }
  }
  return { status: 'resolved', order: group.teams, trace: group.trace }
}

/**
 * Resolves a conference's #1 and #2 championship spots by reading
 * `groups[0]`/`groups[1]` off the full N-seed ranking. If seed 1 is
 * `needsUserInput`, seed 2 is set to the SAME result object (both spots
 * blocked on the same manual decision) -- the exact legacy invariant the
 * deleted engine entry point preserved.
 */
export function resolveChampionship(
  conference: ConferenceId,
  conferenceGames: readonly { id: number, homeId: TeamId, awayId: TeamId, conferenceGame: boolean }[],
  outcomes: ReadonlyMap<number, TeamId>,
  teamIds: ReadonlySet<TeamId>,
  allSeasonGames?: readonly { id: number, homeId: TeamId, awayId: TeamId, conferenceGame: boolean }[],
  knownFbsTeamIds?: ReadonlySet<TeamId>
): LegacyChampionship {
  const ranking = resolveConferenceRanking(
    conference,
    conferenceGames,
    outcomes,
    teamIds,
    allSeasonGames,
    knownFbsTeamIds
  )
  const { seed1: seed1Group, seed2: seed2Group } = championshipFor(ranking)

  const seed1 = toResult(seed1Group)
  const seed2 = seed1.status === 'needsUserInput' ? seed1 : toResult(seed2Group)

  return { conference, seed1, seed2 }
}
