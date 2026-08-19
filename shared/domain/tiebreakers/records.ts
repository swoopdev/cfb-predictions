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
 * `outcomes` map belongs to `resolveConferenceRanking` (Plan 03-03; the
 * conference's combined two-seed entry point before Plan 06-03 renamed and
 * extended it to a full 1..N ranking), not here.
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
    // Every `?? 0` / `?? new Set()` below is unreachable, not merely
    // untested: the seeding loop above (`for (const teamId of teamIds)`,
    // before any game is processed) sets an entry in `wins`/`losses`/
    // `beat`/`lostTo`/`opponents` for EVERY id in this exact same `teamIds`
    // set, so every `.get(teamId)` in THIS loop is always defined. Kept as a
    // type-safety fallback for `Map.get`'s `T | undefined` return, not a
    // reachable runtime path -- closed via `v8 ignore` rather than a test
    // that can never execute it.
    /* v8 ignore next 2 */
    const teamWins = wins.get(teamId) ?? 0
    const teamLosses = losses.get(teamId) ?? 0
    const gamesPlayed = teamWins + teamLosses
    records.set(teamId, {
      teamId,
      wins: teamWins,
      losses: teamLosses,
      gamesPlayed,
      winPct: winPctSafe(teamWins, gamesPlayed),
      /* v8 ignore next 3 */
      beat: beat.get(teamId) ?? new Set(),
      lostTo: lostTo.get(teamId) ?? new Set(),
      opponents: opponents.get(teamId) ?? new Set()
    })
  }

  return records
}

/**
 * Counts each team's total wins across every supplied game (conference AND
 * non-conference), capping wins credited against non-FBS opponents (any
 * team id not present in `knownFbsTeamIds`) at `fcsWinCap` per team --
 * additional FCS wins beyond the cap add zero further credit. This is the
 * Big 12's own policy, verbatim: "Only one win against a team from the
 * NCAA Football Championship Subdivision or lower division will be
 * counted annually."
 *
 * This helper is scoped ONLY to the Big 12's `total-wins` tiebreaker step
 * (RESEARCH.md Open Question 3's resolution: "total number of wins in a
 * 12-game season" is a genuinely season-wide count, the one exception
 * among all four conferences' steps to the rule that every tiebreaker
 * step is conference-games-only). It is NOT part of the shared
 * conference-scoped `ConferenceRecord` contract -- Phase 5's standings
 * engine must not call this for its own overall win totals; that is a
 * different, uncapped count.
 */
export function deriveOverallWinCount(
  allSeasonGames: readonly Game[],
  outcomes: ReadonlyMap<GameId, TeamId>,
  knownFbsTeamIds: ReadonlySet<TeamId>,
  fcsWinCap: number = 1
): ReadonlyMap<TeamId, number> {
  const totalWins = new Map<TeamId, number>()
  const fcsWinsCredited = new Map<TeamId, number>()

  for (const game of allSeasonGames) {
    const winnerId = outcomes.get(game.id)
    if (winnerId === undefined) continue

    const loserId = winnerId === game.homeId ? game.awayId : game.homeId

    if (knownFbsTeamIds.has(loserId)) {
      totalWins.set(winnerId, (totalWins.get(winnerId) ?? 0) + 1)
      continue
    }

    const creditedSoFar = fcsWinsCredited.get(winnerId) ?? 0
    if (creditedSoFar < fcsWinCap) {
      totalWins.set(winnerId, (totalWins.get(winnerId) ?? 0) + 1)
      fcsWinsCredited.set(winnerId, creditedSoFar + 1)
    }
  }

  return totalWins
}
