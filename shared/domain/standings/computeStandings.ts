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
 *
 * Frozen and typed `readonly` (WR-05): `StandingsSidebar` calls `includes` on
 * this exact module-scoped array to decide its display order, so a consumer
 * that sorted or spliced it would silently corrupt both the sidebar and the
 * standings computation for the rest of the session.
 */
export const P4_CONFERENCES: readonly ConferenceId[] = Object.freeze(
  Object.keys(CONFERENCE_RULES) as ConferenceId[]
)

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
 *    `resolveConferenceRanking` throws on it, taking the whole standings
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
 * The degraded-path fallback assembly: applied to whatever rows the engine
 * partition did NOT place. Two cases reach it:
 *
 * 1. **The whole conference is absent from `resolvedTiebreakers`** —
 *    `resolveAllConferences` caught a throw for that conference and omitted
 *    it (the per-conference try/catch in `resolveTiebreakers.ts`; still
 *    reachable in principle even though Plan 06-01's guard repair measured it
 *    at 0/400 on the committed slate, because the try/catch itself is
 *    retained). Every row is "leftover" in this case.
 * 2. **A `ConferenceRanking`'s groups do not cover the whole roster** — not
 *    reachable from `resolveConferenceRanking` today (its own termination
 *    argument guarantees `committed.size === teamIds.size` on return), but
 *    defensive robustness against a hand-supplied ranking (Plan 06-05's
 *    manual-decision feature, or a malformed test fixture) that names fewer
 *    teams than the conference actually has. A team the ranking never
 *    mentions must still get a rank — silently dropping a real team from
 *    standings is exactly the failure mode PROJECT.md's core value cares
 *    about most, so this is deliberate, not incidental, coverage.
 *
 * There is no engine partition to read for these rows, so rank grouping
 * falls back to a record-equality relation: sorted by conference win pct,
 * then wins, then losses, then school, then id, and consecutive rows sharing
 * an identical (wins, losses) conference record are grouped into one rank
 * slot with `isTied: true`. Every other row is its own group.
 *
 * This marks NOTHING as tiebreaker-decided — `StandingsTable` (Plan 06-04)
 * reads its "decided by tiebreaker" marker off a `RankGroup`'s
 * `resolvedBy`/`contestedWith`, which does not exist on this path at all (the
 * `ranking` prop passed to the table is `undefined` for an omitted
 * conference), so no marker can render regardless of what `isTied` says here.
 * This is a `groupBy` over the already-sorted list, not a reintroduced
 * closure — there is no seed group to close over when a row was never placed
 * by the engine.
 */
function fallbackOrder(
  rows: readonly StandingsTeam[],
  confWinPct: ReadonlyMap<TeamId, number>
): StandingsTeam[][] {
  const sorted = [...rows].sort((a, b) => {
    // `?? 0` is unreachable, not merely untested: `confWinPct` (built by the
    // caller, below) always maps EVERY `confTeams` id, and `rows`/`leftover`
    // are themselves derived from `confTeams`, so `a.id`/`b.id` are always
    // present. Kept as a type-safety fallback for `Map.get`'s `T | undefined`
    // return, not a reachable runtime path -- coverage-gate closed via
    // `/* v8 ignore next 2 */` rather than a test that can never execute it.
    /* v8 ignore next 2 */
    const pctA = confWinPct.get(a.id) ?? 0
    const pctB = confWinPct.get(b.id) ?? 0
    if (pctA !== pctB) return pctB - pctA
    if (a.confRecord.wins !== b.confRecord.wins) return b.confRecord.wins - a.confRecord.wins
    if (a.confRecord.losses !== b.confRecord.losses) return a.confRecord.losses - b.confRecord.losses
    const byName = a.school.localeCompare(b.school)
    if (byName !== 0) return byName
    return a.id - b.id
  })

  const groups: StandingsTeam[][] = []
  for (const row of sorted) {
    const current = groups.at(-1)
    const leader = current?.[0]
    if (
      leader
      && leader.confRecord.wins === row.confRecord.wins
      && leader.confRecord.losses === row.confRecord.losses
    ) {
      current.push(row)
    } else {
      groups.push([row])
    }
  }

  return groups
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
 * **Ranking (D-01, TIE-08).** Rows come from a direct, constructive walk over
 * `resolvedTiebreakers[conference].groups` — the engine's own ordered
 * partition, and nothing else. For each `RankGroup` in order, every team in
 * `group.teams` gets the same rank (`ordered.length + 1`, standard
 * competition ranking — a group of three starting at rank 2 is followed by
 * rank 5) and `isTied` set from whether the group holds more than one team.
 * There is no comparator and no second tie relation: D-01 supersedes Phase
 * 5's D-04, which ranked rows by the equivalence closure of "shares a
 * resolved seed group" and "has identical conference W-L" — a relation this
 * phase deletes entirely, because closing over conference record is exactly
 * what let the ACC render `1 Boston College 6-2` above `1 Duke 7-2` (two
 * different records sharing a rank).
 *
 * A group of two or more is the procedure's own statement that it could not
 * separate those teams — never a display-layer guess. Identical conference
 * records no longer imply a shared rank; only the engine's own partition
 * does.
 *
 * **Fallback.** Any row the engine partition did not place — the whole
 * conference is absent from `resolvedTiebreakers` (the per-conference
 * try/catch in `resolveTiebreakers.ts` omitted it), or a hand-supplied
 * ranking under-covers the roster — falls through to `fallbackOrder`, the
 * record-ordering convention: conference win percentage, then wins, then
 * losses, then school name, then id, with identical-record rows grouped and
 * marked tied. Nothing on that path is presented as tiebreaker-decided.
 *
 * **Scope.** Only P4 teams appear in the output (per the phase boundary), but
 * G5 and FCS opponents still move P4 teams' overall records — they're
 * opponents, not entries.
 *
 * @param games every game in the season (the full committed slate)
 * @param teams every FBS team; non-P4 teams are used as opponents only
 * @param picks `{ gameId: winningTeamId }`, untrusted — validated internally
 * @param resolvedTiebreakers per-conference `ConferenceRanking` from
 *   `resolveAllConferences`. Optional: standings still compute without it,
 *   falling all the way through to `fallbackOrder` for every conference.
 */
export function computeStandings(
  games: readonly Game[],
  teams: readonly Team[],
  picks: Readonly<Record<number, number>>,
  resolvedTiebreakers?: ResolvedTiebreakers
): StandingsResult {
  const outcomes = toOutcomes(games, picks)

  const p4Teams = teams.filter(t => (P4_CONFERENCES as readonly string[]).includes(t.conference))
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

  const standings = {} as Record<ConferenceId, readonly StandingsTeam[]>

  for (const conference of P4_CONFERENCES) {
    const confTeams = p4Teams.filter(t => t.conference === conference)
    const confTeamIds = new Set<TeamId>(confTeams.map(t => t.id))

    const confRecords = deriveConferenceRecords(
      conferenceGamesFor(games, confTeamIds),
      outcomes,
      confTeamIds
    )

    // WR-02: the AUTHORITATIVE win percentage, read straight off the
    // `ConferenceRecord` that `computeBaseOrdering` itself buckets on. The
    // standings layer keeps no second implementation and derives no
    // played-games denominator of its own — that duplicate is how this layer
    // drifted away from the engine and produced CR-01.
    // `?.winPct ?? 0` below is unreachable, not merely untested:
    // `deriveConferenceRecords` seeds every id in the `teamIds` set it is
    // given (records.ts's own loop, before any game is processed), and
    // `confTeamIds`/`p4TeamIds` ARE `confTeams`/`p4Teams`' id sets by
    // construction, so `confRecords.get(t.id)`/`overallRecords.get(team.id)`
    // below are always defined. Kept as a type-safety fallback for
    // `Map.get`'s `T | undefined` return (and because `ranking.groups` is a
    // hand-suppliable Plan 06-05 input elsewhere in this file, so defensive
    // coding is this file's own established convention), not a reachable
    // runtime path here -- closed via `v8 ignore` rather than a test that
    // can never execute it.
    /* v8 ignore next 2 */
    const confWinPct = new Map<TeamId, number>(
      confTeams.map(t => [t.id, confRecords.get(t.id)?.winPct ?? 0])
    )

    const rows: StandingsTeam[] = confTeams.map((team) => {
      const conf = confRecords.get(team.id)
      const overall = overallRecords.get(team.id)
      return {
        id: team.id,
        school: team.school,
        conference: team.conference,
        /* v8 ignore next 2 */
        overallRecord: { wins: overall?.wins ?? 0, losses: overall?.losses ?? 0 },
        confRecord: { wins: conf?.wins ?? 0, losses: conf?.losses ?? 0 },
        // Placeholders; assigned after the groups are walked.
        rank: 0,
        isTied: false
      }
    })

    // T-05-03-01: rows are keyed exclusively off the conference's own
    // roster, and `ranking.groups` is only ever READ, so a group naming an
    // unknown or out-of-conference id can neither throw nor materialise a
    // phantom row -- `rowById.get` simply returns undefined and the id is
    // dropped.
    const rowById = new Map<TeamId, StandingsTeam>(rows.map(row => [row.id, row]))
    const ranking = resolvedTiebreakers?.[conference]
    const placed = new Set<TeamId>()

    const groups: StandingsTeam[][] = []

    if (ranking) {
      for (const group of ranking.groups) {
        const members = group.teams
          .map(teamId => rowById.get(teamId))
          .filter((row): row is StandingsTeam => row !== undefined && !placed.has(row.id))
        if (members.length === 0) continue
        for (const row of members) placed.add(row.id)
        groups.push(members)
      }
    }

    // Any row the engine partition did not place (the whole conference was
    // absent, or -- not reachable from the real engine, but defensive
    // against a hand-supplied ranking -- a group list under-covers the
    // roster) falls through to the record-ordering convention.
    const leftover = rows.filter(row => !placed.has(row.id))
    if (leftover.length > 0) {
      groups.push(...fallbackOrder(leftover, confWinPct))
    }

    const ordered: StandingsTeam[] = []
    for (const group of groups) {
      // Standard competition ranking: every row in a group shares one plus
      // the index of that group's first row. Groups are contiguous by
      // construction (constructive assembly -- walk the groups, concatenate
      // -- never a comparator over all rows, preserving the non-transitivity
      // property Phase 5 recorded as load-bearing), so ranks are
      // non-decreasing down the table.
      const rank = ordered.length + 1
      for (const row of group) {
        row.rank = rank
        row.isTied = group.length > 1
        ordered.push(row)
      }
    }

    standings[conference] = ordered
  }

  return standings
}
