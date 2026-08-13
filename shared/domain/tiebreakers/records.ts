import type { Game, GameId, TeamId } from './types'

/**
 * A team's aggregated conference-games-only record. `gamesPlayed` is kept
 * explicit (never derived ad hoc downstream) and `winPct` is always
 * NaN-safe -- see `winPctSafe` below, which is PITFALLS.md Pitfall 4's
 * direct fix ("resolving a tie for 1st requires resolving the tie for
 * 4th" starts with a NaN winPct poisoning a comparison it shouldn't).
 */
export interface ConferenceRecord {
  teamId: TeamId
  wins: number
  losses: number
  gamesPlayed: number
  winPct: number
  beat: ReadonlySet<TeamId>
  lostTo: ReadonlySet<TeamId>
  opponents: ReadonlySet<TeamId>
}

/**
 * Returns `wins / gamesPlayed`, or exactly `0` (never `NaN`) when
 * `gamesPlayed === 0`. Every winPct computation in this module routes
 * through this helper -- direct fix for PITFALLS.md Pitfall 4's
 * NaN-poisoning warning ("0/0 must never silently become NaN and then
 * propagate through every downstream comparison").
 */
function winPctSafe(wins: number, gamesPlayed: number): number {
  return gamesPlayed === 0 ? 0 : wins / gamesPlayed
}

/**
 * Derives a per-team conference record from a conference's games and a
 * complete outcome map. `teamIds` is the conference's full membership --
 * supplying it (rather than inferring membership from `conferenceGames`
 * alone) guarantees every member gets a zero-value entry even if they
 * appear in zero of the supplied games (e.g. a bye week or an
 * incompletely-picked slate).
 *
 * This is the DRY seam Phase 5's standings engine must import rather than
 * re-deriving conference win/loss tallying (PROJECT.md's DRY constraint,
 * RESEARCH.md's "Don't Hand-Roll" table).
 *
 * Caller-contract assumption: every game in `conferenceGames` is assumed
 * to have a corresponding entry in `outcomes`. This pure function does not
 * validate that assumption or throw on a missing entry (`outcomes.get`
 * simply returns `undefined`, and neither team is credited for that game)
 * -- the entry-point validation boundary for a caller-supplied incomplete
 * `outcomes` map belongs to `resolveConferenceChampionship` (Plan 03-03),
 * not here.
 */
export function deriveConferenceRecords(
  conferenceGames: readonly Game[],
  outcomes: ReadonlyMap<GameId, TeamId>,
  teamIds: ReadonlySet<TeamId>
): ReadonlyMap<TeamId, ConferenceRecord> {
  const wins = new Map<TeamId, number>()
  const losses = new Map<TeamId, number>()
  const beat = new Map<TeamId, Set<TeamId>>()
  const lostTo = new Map<TeamId, Set<TeamId>>()
  const opponents = new Map<TeamId, Set<TeamId>>()

  for (const teamId of teamIds) {
    wins.set(teamId, 0)
    losses.set(teamId, 0)
    beat.set(teamId, new Set())
    lostTo.set(teamId, new Set())
    opponents.set(teamId, new Set())
  }

  for (const game of conferenceGames) {
    const winnerId = outcomes.get(game.id)
    if (winnerId === undefined) continue

    const loserId = winnerId === game.homeId ? game.awayId : game.homeId

    wins.set(winnerId, (wins.get(winnerId) ?? 0) + 1)
    losses.set(loserId, (losses.get(loserId) ?? 0) + 1)

    beat.get(winnerId)?.add(loserId)
    lostTo.get(loserId)?.add(winnerId)
    opponents.get(winnerId)?.add(loserId)
    opponents.get(loserId)?.add(winnerId)
  }

  const records = new Map<TeamId, ConferenceRecord>()
  for (const teamId of teamIds) {
    const teamWins = wins.get(teamId) ?? 0
    const teamLosses = losses.get(teamId) ?? 0
    const gamesPlayed = teamWins + teamLosses
    records.set(teamId, {
      teamId,
      wins: teamWins,
      losses: teamLosses,
      gamesPlayed,
      winPct: winPctSafe(teamWins, gamesPlayed),
      beat: beat.get(teamId) ?? new Set(),
      lostTo: lostTo.get(teamId) ?? new Set(),
      opponents: opponents.get(teamId) ?? new Set()
    })
  }

  return records
}
