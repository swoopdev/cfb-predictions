import type { Game, Team } from '../../types/schedule'
import type { StandingsResult, StandingsTeam } from '../../types/standings'
import type { ConferenceId, TeamId, GameId } from '../tiebreakers/types'
import { deriveConferenceRecords } from '../tiebreakers/records'
import { CONFERENCE_RULES } from '../tiebreakers/rules'
import type { ResolvedTiebreakers } from './resolveTiebreakers'

/**
 * The four power conferences, keyed exactly as `teams.json` spells them.
 * Derived from `CONFERENCE_RULES` rather than re-listed, so P4 membership
 * has exactly one definition in the codebase (PROJECT.md DRY constraint).
 */
export const P4_CONFERENCES = Object.keys(CONFERENCE_RULES) as ConferenceId[]

/**
 * Converts a raw `{ gameId: winningTeamId }` picks object into the
 * `Map<gameId, winnerId>` outcome map the tiebreaker engine consumes.
 *
 * **This is the untrusted-input boundary (threat T-05-SC).** Picks come from
 * localStorage, which the user can hand-edit, and a share link can carry a
 * pick set generated against a different schedule. Two classes of garbage are
 * dropped silently here rather than propagated:
 *
 * 1. A `gameId` that isn't in `games` at all — iterating `games` (not the
 *    picks object) makes this structurally impossible to include.
 * 2. A winner that isn't one of the game's two participants — otherwise
 *    `resolveConferenceChampionship` throws on it, taking the whole standings
 *    sidebar down over one bad localStorage entry.
 *
 * Silent drop (rather than throw) is the correct disposition: a corrupt pick
 * should cost the user that one game's result, not the entire page.
 */
export function toOutcomes(
  games: readonly Game[],
  picks: Readonly<Record<number, number>>
): ReadonlyMap<GameId, TeamId> {
  const outcomes = new Map<GameId, TeamId>()

  for (const game of games) {
    const winnerId = picks[game.id]
    if (winnerId === undefined) continue
    if (winnerId !== game.homeId && winnerId !== game.awayId) continue
    outcomes.set(game.id, winnerId)
  }

  return outcomes
}

/**
 * Returns the games that count toward `conference`'s conference record:
 * flagged `conferenceGame` by the upstream CFBD data (per plan — the flag is
 * authoritative, never re-derived from team conferences) AND played between
 * two members of that conference.
 *
 * Both conditions are required. The flag alone can't attribute a game to a
 * conference, and membership alone would wrongly count a same-conference game
 * that the schedule explicitly marks non-conference (1 such game exists in
 * the committed 2026 slate).
 */
export function conferenceGamesFor(
  games: readonly Game[],
  teamIds: ReadonlySet<TeamId>
): readonly Game[] {
  return games.filter(g => g.conferenceGame && teamIds.has(g.homeId) && teamIds.has(g.awayId))
}

/**
 * Builds a `teamId -> preferred position` lookup from a conference's resolved
 * tiebreaker result, used only to order teams *within* a group that shares an
 * identical conference record.
 *
 * D-04 fixes the rank NUMBER for tied teams (they all show the same one), so
 * the tiebreaker result cannot change ranks — but it can and should decide
 * who appears on top of whom inside the tie, which is what D-11/D-12 mean by
 * Phase 5 consuming Phase 6's resolved ranking.
 */
function tiebreakerPositions(
  resolved: ResolvedTiebreakers | undefined,
  conference: ConferenceId
): ReadonlyMap<TeamId, number> {
  const positions = new Map<TeamId, number>()
  const championship = resolved?.[conference]
  if (!championship) return positions

  for (const seed of [championship.seed1, championship.seed2]) {
    if (seed.status !== 'resolved') continue
    for (const teamId of seed.order) {
      if (!positions.has(teamId)) positions.set(teamId, positions.size)
    }
  }

  return positions
}

/**
 * Computes standings for all four P4 conferences from a slate, a roster, and
 * a set of picks.
 *
 * Pure: no Vue/Nuxt imports, no mutation of any argument. The reactive seam
 * lives entirely in the caller (a `computed()` in the component layer, D-13),
 * which is what lets Phase 6 reuse this untouched.
 *
 * **Record separation (STAND-03).** Conference and overall records are
 * tallied independently and returned as separate W-L pairs, never merged into
 * a win percentage. Overall counts every game a P4 team plays, including
 * non-conference and FCS opponents; conference counts only the games returned
 * by `conferenceGamesFor`.
 *
 * **Ranking (STAND-04, D-04).** Teams sort by conference win percentage
 * (best first), and every team with an identical conference record receives
 * an identical rank via standard competition ranking. Within such a group,
 * `resolvedTiebreakers` decides display order; absent a resolved result the
 * order falls back to school name, which keeps output deterministic.
 *
 * **Scope.** Only P4 teams appear in the output (per the phase boundary), but
 * G5 and FCS opponents still move P4 teams' overall records — they're
 * opponents, not entries.
 *
 * @param games every game in the season (the full committed slate)
 * @param teams every FBS team; non-P4 teams are used as opponents only
 * @param picks `{ gameId: winningTeamId }`, untrusted — validated internally
 * @param resolvedTiebreakers per-conference championship result from
 *   `resolveAllConferences` (Phase 5 baseline) or Phase 6's manually-resolved
 *   equivalent. Optional: standings still compute without it.
 */
export function computeStandings(
  games: readonly Game[],
  teams: readonly Team[],
  picks: Readonly<Record<number, number>>,
  resolvedTiebreakers?: ResolvedTiebreakers
): StandingsResult {
  const outcomes = toOutcomes(games, picks)

  const p4Teams = teams.filter(t => (P4_CONFERENCES as string[]).includes(t.conference))
  const p4TeamIds = new Set<TeamId>(p4Teams.map(t => t.id))

  // Overall records tallied ONCE across the whole slate for every P4 team.
  // `deriveConferenceRecords` is a generic (games, outcomes, teamIds) tallier
  // despite its conference-scoped name — reusing it here is deliberate: its
  // own docblock names Phase 5's standings engine as the caller that must
  // import it rather than re-derive win/loss counting (PROJECT.md DRY).
  // Opponents outside `p4TeamIds` (G5, FCS) are simply absent from the
  // result, which is exactly the desired "counts against P4, doesn't appear"
  // behaviour.
  const overallRecords = deriveConferenceRecords(games, outcomes, p4TeamIds)

  const standings: StandingsResult = {}

  for (const conference of P4_CONFERENCES) {
    const confTeams = p4Teams.filter(t => t.conference === conference)
    const confTeamIds = new Set<TeamId>(confTeams.map(t => t.id))

    const confRecords = deriveConferenceRecords(
      conferenceGamesFor(games, confTeamIds),
      outcomes,
      confTeamIds
    )

    const positions = tiebreakerPositions(resolvedTiebreakers, conference)

    const rows: StandingsTeam[] = confTeams.map((team) => {
      const conf = confRecords.get(team.id)
      const overall = overallRecords.get(team.id)
      return {
        id: team.id,
        school: team.school,
        conference: team.conference,
        overallRecord: { wins: overall?.wins ?? 0, losses: overall?.losses ?? 0 },
        confRecord: { wins: conf?.wins ?? 0, losses: conf?.losses ?? 0 },
        // Placeholders; assigned after sorting.
        rank: 0,
        isTied: false
      }
    })

    rows.sort((a, b) => {
      // Primary: conference win percentage, best first. 0-0 and 0-8 both have
      // a 0 percentage (`winPctSafe` never yields NaN), which is why wins and
      // losses are separate subsequent keys rather than assumed redundant.
      const pctA = winPct(a.confRecord.wins, a.confRecord.losses)
      const pctB = winPct(b.confRecord.wins, b.confRecord.losses)
      if (pctA !== pctB) return pctB - pctA

      if (a.confRecord.wins !== b.confRecord.wins) return b.confRecord.wins - a.confRecord.wins
      if (a.confRecord.losses !== b.confRecord.losses) return a.confRecord.losses - b.confRecord.losses

      // Identical conference records from here down — these three keys only
      // decide display order inside a tie, never the rank number.
      const posA = positions.get(a.id) ?? Number.POSITIVE_INFINITY
      const posB = positions.get(b.id) ?? Number.POSITIVE_INFINITY
      if (posA !== posB) return posA - posB

      const byName = a.school.localeCompare(b.school)
      if (byName !== 0) return byName

      return a.id - b.id
    })

    assignRanks(rows)
    standings[conference] = rows
  }

  return standings
}

/**
 * NaN-safe win percentage. Mirrors `winPctSafe` in the tiebreaker engine's
 * `records.ts` (0 games played yields exactly `0`, never `NaN`) — that module
 * keeps its copy private, and a 0/0 leaking through as NaN here would poison
 * every comparison in the sort above.
 */
function winPct(wins: number, losses: number): number {
  const played = wins + losses
  return played === 0 ? 0 : wins / played
}

/**
 * Assigns standard competition ranks in place over an already-sorted array.
 * Consecutive teams with an identical conference record share the first
 * team's rank, and the following distinct record resumes at its own index
 * (D-04: three teams at 6-2 all show `2`, next team shows `5`).
 *
 * Safe to key off adjacency: the sort orders by win percentage, then wins,
 * then losses, so any two teams with the same W-L are necessarily adjacent.
 */
function assignRanks(rows: StandingsTeam[]): void {
  let currentRank = 0

  rows.forEach((row, index) => {
    const previous = rows[index - 1]
    const sameAsPrevious
      = previous !== undefined
        && previous.confRecord.wins === row.confRecord.wins
        && previous.confRecord.losses === row.confRecord.losses

    if (!sameAsPrevious) currentRank = index + 1
    row.rank = currentRank
  })

  const rankCounts = new Map<number, number>()
  for (const row of rows) rankCounts.set(row.rank, (rankCounts.get(row.rank) ?? 0) + 1)
  for (const row of rows) row.isTied = (rankCounts.get(row.rank) ?? 0) > 1
}
