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
 * Where a team sits in the tiebreaker engine's resolved output: which seed
 * group it belongs to (0 = the championship slot, 1 = the runner-up slot) and
 * its position inside that group. Both are the engine's own answer; nothing in
 * this module may override either.
 */
interface SeedPlacement {
  group: number
  position: number
}

/**
 * The conference's ORDERED, DISJOINT resolved seed groups.
 *
 * **This is the standings layer's ONLY definition of "tied."** It is the
 * engine's OUTPUT, not a reimplementation of the engine's tie-defining
 * predicate: `rules.defineTiedTeams` produced the pool (win percentage for
 * SEC/Big Ten/Big 12, the alternate-schedule-length rule for the ACC) and
 * `resolveTiedGroup` returned `[...winners, ...restResult.order]`. Reading
 * `order` therefore gives this layer the engine's exact verdict with no second
 * copy of any tie predicate anywhere — which is both PROJECT.md's DRY
 * constraint and literally what D-11/D-14 describe.
 *
 * CR-01 (`05-REVIEW.md`) is the record of what happens without this: the old
 * code consulted the resolved order only AFTER win percentage, wins AND losses
 * had all compared equal, so every pair the engine tied on a broader condition
 * never reached the comparison and the resolved order was computed and thrown
 * away. The sidebar could name a different champion than the engine did.
 *
 * Group 0 is `seed1.order` when seed 1 resolved; group 1 is `seed2.order` when
 * seed 2 resolved, minus every id group 0 already claimed. `needsUserInput`
 * seeds contribute no group at all (D-10: Phase 5 shows no pending state), so
 * an unresolved tie falls back to the record convention exactly as before.
 *
 * **`order` is a sequence, NOT a complete tie partition.** The engine's
 * restart branch recurses on a fully REDEFINED pool
 * (`engine.ts:133`), so a team the redefinition does not re-select never
 * appears in `order` at all. That is why the rank grouping below closes over
 * conference record as well as group membership.
 */
function resolvedSeedGroups(
  resolved: ResolvedTiebreakers | undefined,
  conference: ConferenceId
): readonly (readonly TeamId[])[] {
  const championship = resolved?.[conference]
  if (!championship) return []

  const groups: TeamId[][] = []
  const claimed = new Set<TeamId>()

  for (const seed of [championship.seed1, championship.seed2]) {
    if (seed.status !== 'resolved') continue

    const group: TeamId[] = []
    for (const teamId of seed.order) {
      if (claimed.has(teamId)) continue
      claimed.add(teamId)
      group.push(teamId)
    }

    if (group.length > 0) groups.push(group)
  }

  return groups
}

/**
 * A `teamId -> SeedPlacement` lookup over the resolved groups.
 *
 * T-05-03-01: this is a plain Map keyed by whatever ids the engine (or Phase
 * 6, by hand) supplied. Rows are built exclusively from the conference's own
 * roster and only ever *read* this map, so an order naming an unknown or
 * out-of-conference id can neither throw nor inject a phantom standings row.
 */
function seedPlacements(
  groups: readonly (readonly TeamId[])[]
): ReadonlyMap<TeamId, SeedPlacement> {
  const placements = new Map<TeamId, SeedPlacement>()

  groups.forEach((group, groupIndex) => {
    group.forEach((teamId, position) => {
      placements.set(teamId, { group: groupIndex, position })
    })
  })

  return placements
}

/** The conference-record identity two rows must share to be ranked together. */
function recordKey(row: StandingsTeam): string {
  return `${row.confRecord.wins}:${row.confRecord.losses}`
}

/**
 * Partitions a conference's rows into rank components: the equivalence
 * CLOSURE of two relations — "shares a resolved seed group" and "has identical
 * conference wins and losses". Returns arrays of row indices.
 *
 * Both relations are needed, and the closure of the two is what makes D-04 and
 * D-11 hold simultaneously:
 *
 * - Seed membership alone would SPLIT two identical-record teams whenever the
 *   engine's restart redefinition placed one and dropped the other (see
 *   `resolvedSeedGroups`) — identical records on different rank numbers, a
 *   direct D-04 violation, in the exact conference (ACC) that produced every
 *   reproduced CR-01 mismatch.
 * - Record equality alone is the pre-05-03 behaviour, i.e. CR-01 itself.
 *
 * A union-find is used rather than a comparator because a comparator cannot
 * express a closure without risking non-transitivity (T-05-03-02).
 */
function rankComponents(
  rows: readonly StandingsTeam[],
  placements: ReadonlyMap<TeamId, SeedPlacement>
): number[][] {
  const parent = rows.map((_, index) => index)

  const find = (index: number): number => {
    let root = index
    while (parent[root] !== root) root = parent[root]!

    let walk = index
    while (parent[walk] !== root) {
      const next = parent[walk]!
      parent[walk] = root
      walk = next
    }

    return root
  }

  const union = (a: number, b: number): void => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  const firstOfGroup = new Map<number, number>()
  const firstOfRecord = new Map<string, number>()

  rows.forEach((row, index) => {
    const placement = placements.get(row.id)
    if (placement !== undefined) {
      const seenGroup = firstOfGroup.get(placement.group)
      if (seenGroup === undefined) firstOfGroup.set(placement.group, index)
      else union(seenGroup, index)
    }

    const key = recordKey(row)
    const seenRecord = firstOfRecord.get(key)
    if (seenRecord === undefined) firstOfRecord.set(key, index)
    else union(seenRecord, index)
  })

  const byRoot = new Map<number, number[]>()
  for (let index = 0; index < rows.length; index++) {
    const root = find(index)
    const members = byRoot.get(root)
    if (members) members.push(index)
    else byRoot.set(root, [index])
  }

  return [...byRoot.values()]
}

/**
 * Orders two rows INSIDE one rank component. Engine-placed rows lead, in the
 * engine's own sequence; unplaced rows follow, deterministically by school
 * then id.
 *
 * Total order by construction: every placed row has a unique
 * `(group, position)` and every row a unique id, so no two rows ever compare
 * equal.
 */
function compareWithinComponent(
  a: StandingsTeam,
  b: StandingsTeam,
  placements: ReadonlyMap<TeamId, SeedPlacement>
): number {
  const placedA = placements.get(a.id)
  const placedB = placements.get(b.id)

  if ((placedA === undefined) !== (placedB === undefined)) return placedA === undefined ? 1 : -1

  if (placedA !== undefined && placedB !== undefined) {
    if (placedA.group !== placedB.group) return placedA.group - placedB.group
    return placedA.position - placedB.position
  }

  const byName = a.school.localeCompare(b.school)
  if (byName !== 0) return byName

  return a.id - b.id
}

/**
 * Builds a conference's row order CONSTRUCTIVELY — rank components, then a
 * component sort, then a within-component sort, then concatenation. Returns
 * the components in display order, each already internally ordered.
 *
 * Deliberately not a single comparator over all rows (T-05-03-02): a
 * comparator cannot express the component closure without risking
 * non-transitivity, and a non-transitive comparator is undefined behaviour in
 * `Array.prototype.sort`. Every sort here runs over a homogeneous set with a
 * well-defined total order, and no cross-component comparison is ever made.
 *
 * This is also what makes the CR-01 invariant STRUCTURAL rather than
 * incidental: all of `seed1.order` shares group 0, the closure therefore keeps
 * it inside one component, that component's key `(0, 0)` is the global minimum
 * so it leads the table, and placed rows lead it in engine sequence. The
 * indices of `seed1.order` in the finished rows are 0, 1, 2, … and row 0 is
 * always the resolved champion.
 */
function orderedComponents(
  rows: readonly StandingsTeam[],
  placements: ReadonlyMap<TeamId, SeedPlacement>,
  confWinPct: ReadonlyMap<TeamId, number>
): StandingsTeam[][] {
  const components = rankComponents(rows, placements).map((indices) => {
    // The best (group, position) over the component's placed rows, if any.
    let best: SeedPlacement | undefined
    for (const index of indices) {
      const placement = placements.get(rows[index]!.id)
      if (placement === undefined) continue
      if (
        best === undefined
        || placement.group < best.group
        || (placement.group === best.group && placement.position < best.position)
      ) {
        best = placement
      }
    }

    // A component with NO placed row was formed by record equality alone, so
    // every member shares one conference record and this sample speaks for the
    // whole component. (Components that DO contain a placed row never consult
    // these three fields.)
    const sample = rows[indices[0]!]!

    return {
      best,
      pct: confWinPct.get(sample.id) ?? 0,
      wins: sample.confRecord.wins,
      losses: sample.confRecord.losses,
      members: indices
        .map(index => rows[index]!)
        .sort((a, b) => compareWithinComponent(a, b, placements))
    }
  })

  components.sort((a, b) => {
    // Components the engine placed lead the table, ordered by the engine.
    if ((a.best === undefined) !== (b.best === undefined)) return a.best === undefined ? 1 : -1

    if (a.best !== undefined && b.best !== undefined) {
      if (a.best.group !== b.best.group) return a.best.group - b.best.group
      return a.best.position - b.best.position
    }

    // Everyone the engine did not place keeps the display convention. The
    // engine only ever opines on the two championship slots and has no view on
    // 5th versus 6th place, so two grouping rules coexist by design.
    if (a.pct !== b.pct) return b.pct - a.pct
    if (a.wins !== b.wins) return b.wins - a.wins
    return a.losses - b.losses
  })

  return components.map(component => component.members)
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
 * **Ranking (STAND-04, D-04, D-11).** Rows are partitioned into rank
 * components — the equivalence closure of "shares a resolved seed group" and
 * "has identical conference wins and losses" — and every row in a component
 * carries the same rank number under standard competition ranking (a component
 * of three starting at rank 2 is followed by rank 5).
 *
 * Components the tiebreaker engine placed lead the table in the engine's own
 * order, so the resolved champion is always row 0 and a resolved seed order is
 * never inverted. Everything the engine did not place keeps the display
 * convention below them: conference win percentage, then wins, then losses,
 * then school name, then id.
 *
 * One consequence is deliberate and worth stating for Phase 6: an UNPLACED
 * team sharing an exact conference record with a placed team is hoisted next
 * to it and inherits its rank, ahead of unplaced teams with better records.
 * That is D-04 winning over the record convention on purpose — two teams at
 * 2-1 on different rank numbers is a defect a user can see, whereas the hoist
 * is invisible unless you are comparing against a team the engine
 * deliberately excluded.
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

  const standings: StandingsResult = {}

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
    const confWinPct = new Map<TeamId, number>(
      confTeams.map(t => [t.id, confRecords.get(t.id)?.winPct ?? 0])
    )

    const placements = seedPlacements(resolvedSeedGroups(resolvedTiebreakers, conference))

    const rows: StandingsTeam[] = confTeams.map((team) => {
      const conf = confRecords.get(team.id)
      const overall = overallRecords.get(team.id)
      return {
        id: team.id,
        school: team.school,
        conference: team.conference,
        overallRecord: { wins: overall?.wins ?? 0, losses: overall?.losses ?? 0 },
        confRecord: { wins: conf?.wins ?? 0, losses: conf?.losses ?? 0 },
        // Placeholders; assigned after the components are ordered.
        rank: 0,
        isTied: false
      }
    })

    const ordered: StandingsTeam[] = []
    for (const component of orderedComponents(rows, placements, confWinPct)) {
      // Standard competition ranking: every row in a component shares one plus
      // the index of that component's first row. Components are contiguous by
      // construction, so ranks are non-decreasing down the table and no two
      // rows with identical conference records can carry different ranks.
      const rank = ordered.length + 1
      for (const row of component) {
        row.rank = rank
        row.isTied = component.length > 1
        ordered.push(row)
      }
    }

    standings[conference] = ordered
  }

  return standings
}
